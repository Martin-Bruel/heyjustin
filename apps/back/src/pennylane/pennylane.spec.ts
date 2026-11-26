import { Logger } from '@nestjs/common';
import { ResilienceTimeoutError } from '@nestjs/resilience';
import { PennylaneApiError } from './errors/pennylane-api.error.js';
import { PennylaneClient } from './pennylane.client.js';
import { frenchVatRate } from './pennylane-vat-rate.js';
import { PennylaneAccountService } from './services/pennylane-account.service.js';
import { PennylaneInvoicesService } from './services/pennylane-invoices.service.js';
import { PennylaneSuppliersService } from './services/pennylane-suppliers.service.js';

const BASE_URL = 'https://pennylane.test/api/external/v2';
const TOKEN = 'company-token';

/** The real client, without waiting between retries. */
class InstantClient extends PennylaneClient {
  readonly waits: number[] = [];
  protected override waitBeforeRetry(ms: number): number {
    this.waits.push(ms);
    return 0;
  }
}

interface SentRequest {
  method: string;
  url: URL;
  headers: Headers;
  body: RequestInit['body'];
}

/** Replaces fetch: answers in order, records what was sent. */
function fakePennylane(...responses: Response[]) {
  const sent: SentRequest[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((input: URL, init: RequestInit) => {
      sent.push({
        method: init.method ?? 'GET',
        url: new URL(input),
        headers: new Headers(init.headers),
        body: init.body,
      });
      const response = responses.shift();
      if (!response) throw new Error('unexpected request');
      return Promise.resolve(response);
    }),
  );
  const client = new InstantClient({ baseUrl: BASE_URL });
  return { client, sent };
}

const json = (status: number, body: unknown, headers?: HeadersInit) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });

const page = <T>(items: T[], next_cursor: string | null = null) =>
  json(200, { items, has_more: next_cursor !== null, next_cursor });

async function failureOf(
  promise: Promise<unknown>,
): Promise<PennylaneApiError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(PennylaneApiError);
    return error as PennylaneApiError;
  }
  throw new Error('expected a failure');
}

describe('Pennylane', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'debug').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe('client', () => {
    it('sends the token as a bearer and the filter as JSON', async () => {
      const { client, sent } = fakePennylane(page([]));

      await client.listAll(TOKEN, {
        path: '/suppliers',
        query: {
          filter: [{ field: 'name', operator: 'start_with', value: 'Acme' }],
        },
      });

      expect(sent[0].url.pathname).toBe('/api/external/v2/suppliers');
      expect(sent[0].headers.get('authorization')).toBe('Bearer company-token');
      expect(JSON.parse(sent[0].url.searchParams.get('filter')!)).toEqual([
        { field: 'name', operator: 'start_with', value: 'Acme' },
      ]);
      expect(sent[0].url.searchParams.get('limit')).toBe('100');
    });

    it('follows the cursor until the last page', async () => {
      const { client, sent } = fakePennylane(
        page([{ id: 1 }], 'next'),
        page([{ id: 2 }]),
      );

      await expect(
        client.listAll(TOKEN, { path: '/suppliers' }),
      ).resolves.toEqual([{ id: 1 }, { id: 2 }]);
      expect(sent[1].url.searchParams.get('cursor')).toBe('next');
    });

    it('waits as told by a 429, then retries', async () => {
      const { client, sent } = fakePennylane(
        json(429, { error: 'Rate limit exceeded' }, { 'retry-after': '2' }),
        json(200, { ok: true }),
      );

      await client.request(TOKEN, { method: 'GET', path: '/me' });

      expect(sent).toHaveLength(2);
      expect(client.waits).toEqual([2_000]);
    });

    it('gives up after a few 429', async () => {
      const tooMany = () => json(429, {}, { 'retry-after': '1' });
      const { client } = fakePennylane(
        tooMany(),
        tooMany(),
        tooMany(),
        tooMany(),
      );

      const error = await failureOf(
        client.request(TOKEN, { method: 'GET', path: '/me' }),
      );
      expect(error.failure).toBe('rateLimited');
    });

    it('does not retry a 5xx: the write may have happened', async () => {
      const { client, sent } = fakePennylane(json(502, {}));

      const error = await failureOf(
        client.request(TOKEN, { method: 'POST', path: '/suppliers', json: {} }),
      );
      expect(error.failure).toBe('unavailable');
      expect(sent).toHaveLength(1);
    });

    it.each([
      [401, 'unauthorized'],
      [403, 'forbidden'],
      [404, 'notFound'],
      [409, 'conflict'],
      [422, 'rejected'],
    ] as const)('maps HTTP %s to %s', async (status, failure) => {
      const { client } = fakePennylane(json(status, { error: 'x', status }));

      const error = await failureOf(
        client.request(TOKEN, { method: 'GET', path: '/me' }),
      );
      expect(error.failure).toBe(failure);
    });

    it('keeps the code and field of a validation error, never the payload or the token', async () => {
      const { client } = fakePennylane(
        json(400, {
          message: 'Invalid value',
          code: 'NotEnumInclude',
          field: 'invoice_lines.0.vat_rate',
          payload: 'Acme 12.50',
        }),
      );

      const error = await failureOf(
        client.request(TOKEN, { method: 'POST', path: '/x', json: {} }),
      );

      expect(error.toLogFields()).toEqual({
        failure: 'rejected',
        method: 'POST',
        path: '/x',
        status: 400,
        code: 'NotEnumInclude',
        field: 'invoice_lines.0.vat_rate',
        message: 'Invalid value',
      });
      expect(JSON.stringify(error.toLogFields())).not.toMatch(
        /Acme|company-token/,
      );
      expect(error.message).toBe('Pennylane rejected the request');
    });

    it('reports a network failure as unavailable', async () => {
      vi.stubGlobal('fetch', () =>
        Promise.reject(new TypeError('fetch failed')),
      );
      const client = new InstantClient({ baseUrl: BASE_URL });

      const error = await failureOf(
        client.request(TOKEN, { method: 'GET', path: '/me' }),
      );
      expect(error.failure).toBe('unavailable');
    });

    it('stops calling Pennylane while it keeps failing (circuit breaker)', async () => {
      const { client, sent } = fakePennylane(
        ...Array.from({ length: 10 }, () => json(503, {})),
      );
      const get = () => client.request(TOKEN, { method: 'GET', path: '/me' });

      for (let call = 0; call < 10; call++) await failureOf(get());
      const error = await failureOf(get());

      expect(error.failure).toBe('unavailable');
      expect(sent).toHaveLength(10); // the 11th call never left
    });

    it('does not open the breaker on 4xx: they are about one request', async () => {
      const { client, sent } = fakePennylane(
        ...Array.from({ length: 11 }, () => json(401, {})),
      );

      for (let call = 0; call < 11; call++) {
        const error = await failureOf(
          client.request(TOKEN, { method: 'GET', path: '/me' }),
        );
        expect(error.failure).toBe('unauthorized');
      }
      expect(sent).toHaveLength(11);
    });

    it('aborts a request that takes too long', async () => {
      vi.useFakeTimers();
      try {
        vi.stubGlobal(
          'fetch',
          (_url: URL, init: RequestInit) =>
            new Promise((_, reject) =>
              init.signal?.addEventListener('abort', () =>
                reject(init.signal?.reason),
              ),
            ),
        );
        const client = new InstantClient({ baseUrl: BASE_URL });

        const pending = failureOf(
          client.request(TOKEN, { method: 'GET', path: '/me' }),
        );
        await vi.advanceTimersByTimeAsync(30_000);
        const error = await pending;

        expect(error.failure).toBe('unavailable');
        expect(error.cause).toBeInstanceOf(ResilienceTimeoutError);
      } finally {
        vi.useRealTimers();
      }
    });

    it('never logs the token nor the query', async () => {
      const { client } = fakePennylane(page([]));
      const debug = vi.spyOn(Logger.prototype, 'debug');

      await client.listAll(TOKEN, {
        path: '/suppliers',
        query: {
          filter: [{ field: 'name', operator: 'start_with', value: 'Acme' }],
        },
      });

      expect(JSON.stringify(debug.mock.calls)).not.toMatch(
        /company-token|Acme/,
      );
    });
  });

  describe('suppliers', () => {
    it('lists every supplier with its identifiers', async () => {
      const { client } = fakePennylane(
        page([{ id: 1, name: 'easyJet', vat_number: 'GB745360068' }], 'next'),
        page([{ id: 2, name: 'Acme', vat_number: '', reg_no: '123456789' }]),
      );

      await expect(
        new PennylaneSuppliersService(client).list(TOKEN),
      ).resolves.toEqual([
        { id: 1, name: 'easyJet', vatNumber: 'GB745360068', regNo: null },
        { id: 2, name: 'Acme', vatNumber: null, regNo: '123456789' },
      ]);
    });

    it('creates a supplier, with its identifiers only when known', async () => {
      const { client, sent } = fakePennylane(
        json(201, { id: 3, name: 'Acme' }),
        json(201, { id: 4, name: 'Beta', reg_no: '123456789' }),
      );
      const suppliers = new PennylaneSuppliersService(client);

      await suppliers.create(TOKEN, {
        name: 'Acme',
        vatNumber: null,
        regNo: null,
      });
      await suppliers.create(TOKEN, {
        name: 'Beta',
        vatNumber: 'FR40123456789',
        regNo: '123456789',
      });

      expect(sent.map((request) => JSON.parse(request.body as string))).toEqual(
        [
          { name: 'Acme' },
          { name: 'Beta', vat_number: 'FR40123456789', reg_no: '123456789' },
        ],
      );
    });
  });

  describe('invoices', () => {
    const invoice = {
      fileAttachmentId: 10,
      supplierId: 20,
      issuedOn: new Date('2026-11-01T00:00:00Z'),
      totalCents: 1250,
      vatCents: 208,
      currency: 'EUR',
      vatRate: 'FR_200' as const,
      incomplete: false,
      externalReference: 'ticket-1',
    };

    it('uploads the file as multipart, with a default name', async () => {
      const { client, sent } = fakePennylane(json(201, { id: 10 }));

      await expect(
        new PennylaneInvoicesService(client).uploadFile(TOKEN, {
          data: Buffer.from('jpeg bytes'),
          mimeType: 'image/jpeg',
          filename: null,
        }),
      ).resolves.toBe(10);

      const file = (sent[0].body as FormData).get('file') as File;
      expect(file.name).toBe('receipt.jpg');
      expect(file.type).toBe('image/jpeg');
      expect(Buffer.from(await file.arrayBuffer()).toString()).toBe(
        'jpeg bytes',
      );
    });

    it('refuses a file type Pennylane does not accept, without calling it', async () => {
      const { client, sent } = fakePennylane();

      const error = await failureOf(
        new PennylaneInvoicesService(client).uploadFile(TOKEN, {
          data: Buffer.from(''),
          mimeType: 'image/heic',
          filename: 'IMG_1.HEIC',
        }),
      );
      expect(error.failure).toBe('unsupportedFile');
      expect(sent).toHaveLength(0);
    });

    it('imports the invoice with amounts as decimal strings', async () => {
      const { client, sent } = fakePennylane(json(201, { id: 30 }));

      await expect(
        new PennylaneInvoicesService(client).importSupplierInvoice(
          TOKEN,
          invoice,
        ),
      ).resolves.toBe(30);

      expect(sent[0].url.pathname).toBe(
        '/api/external/v2/supplier_invoices/import',
      );
      expect(JSON.parse(sent[0].body as string)).toEqual({
        file_attachment_id: 10,
        supplier_id: 20,
        date: '2026-11-01',
        deadline: '2026-11-01',
        currency: 'EUR',
        currency_amount: '12.50',
        currency_tax: '2.08',
        currency_amount_before_tax: '10.42',
        invoice_lines: [
          {
            currency_amount: '12.50',
            currency_tax: '2.08',
            vat_rate: 'FR_200',
          },
        ],
        import_as_incomplete: false,
        external_reference: 'ticket-1',
      });
    });

    it('retries while the uploaded file is not ready (409)', async () => {
      const { client, sent } = fakePennylane(
        json(409, { error: 'File not ready', status: 409 }),
        json(201, { id: 30 }),
      );

      await new PennylaneInvoicesService(client).importSupplierInvoice(
        TOKEN,
        invoice,
      );

      expect(sent).toHaveLength(2);
      expect(client.waits).toEqual([2_000]);
    });

    it('finds an invoice by its external reference', async () => {
      const { client, sent } = fakePennylane(page([{ id: 30 }]), page([]));
      const invoices = new PennylaneInvoicesService(client);

      expect(await invoices.findByExternalReference(TOKEN, 'ticket-1')).toBe(
        30,
      );
      expect(await invoices.findByExternalReference(TOKEN, 'ticket-2')).toBe(
        null,
      );
      expect(sent[0].url.pathname).toBe('/api/external/v2/supplier_invoices');
      expect(JSON.parse(sent[0].url.searchParams.get('filter')!)).toEqual([
        { field: 'external_reference', operator: 'eq', value: 'ticket-1' },
      ]);
    });
  });

  describe('account', () => {
    it('reads the company of the token and the missing scopes', async () => {
      const { client } = fakePennylane(
        json(200, {
          user: null,
          company: { id: 7, name: 'Acme SAS' },
          scopes: ['suppliers:all', 'transactions:all', 'file_attachments:all'],
        }),
      );

      const account = await new PennylaneAccountService(client).whoAmI(TOKEN);

      expect(account).toMatchObject({ companyId: 7, companyName: 'Acme SAS' });
      expect(PennylaneAccountService.missingScopes(account)).toEqual([
        'supplier_invoices:all',
      ]);
    });
  });

  describe('VAT rates', () => {
    it.each([
      [2000, 'FR_200'],
      [1000, 'FR_100'],
      [550, 'FR_55'],
      [210, 'FR_21'],
      [0, 'exempt'],
    ])('maps %s basis points to %s', (rate, code) => {
      expect(frenchVatRate(rate)).toBe(code);
    });

    it.each([1900, 700, null])('has no French code for %s', (rate) => {
      expect(frenchVatRate(rate)).toBeNull();
    });
  });
});
