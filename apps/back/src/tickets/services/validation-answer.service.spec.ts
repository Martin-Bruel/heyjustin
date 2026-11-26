import { MessagingGateway } from '../../messaging/index.js';
import {
  type NewPennylaneSupplier,
  PennylaneApiError,
  type PennylaneInvoicesService,
  type PennylaneSuppliersService,
  type SupplierInvoiceImport,
} from '../../pennylane/index.js';
import { Extraction, type ExtractedSupplier } from '../../receipts/index.js';
import type { User } from '../../users/index.js';
import { SourceMessage } from '../models/source-message.js';
import { Ticket } from '../models/ticket.js';
import { TicketFile } from '../models/ticket-file.js';
import {
  fakeCompanies,
  fakeUsers,
  inMemoryTickets,
  RecordingStrategy,
} from '../testing/ticket-fakes.js';
import { ImportTicketService } from './import-ticket.service.js';
import { TicketNotifierService } from './ticket-notifier.service.js';
import { TicketReactionService } from './ticket-reaction.service.js';
import { ValidationAnswerService } from './validation-answer.service.js';

// --- Fakes: only the edges (database, Pennylane, the messaging app) ---

/** Pennylane is an edge: faked by its services (their own spec fakes HTTP). */
function fakePennylane(
  options: {
    importError?: PennylaneApiError;
    uploadError?: PennylaneApiError;
    /** the invoice a previous attempt left, found by external reference */
    existingInvoice?: number;
  } = {},
) {
  const created: NewPennylaneSupplier[] = [];
  const imports: SupplierInvoiceImport[] = [];
  let uploads = 0;
  const suppliers = {
    list: async () => [],
    create: async (_token: string, supplier: NewPennylaneSupplier) => {
      created.push(supplier);
      return { id: 99, ...supplier };
    },
  } satisfies Record<keyof PennylaneSuppliersService, unknown>;
  const invoices = {
    uploadFile: async () => {
      uploads++;
      if (options.uploadError) throw options.uploadError;
      return 10;
    },
    importSupplierInvoice: async (
      _token: string,
      invoice: SupplierInvoiceImport,
    ) => {
      imports.push(invoice);
      if (options.importError) throw options.importError;
      return 20;
    },
    findByExternalReference: async () => options.existingInvoice ?? null,
  } satisfies Record<keyof PennylaneInvoicesService, unknown>;
  return {
    suppliers: suppliers as unknown as PennylaneSuppliersService,
    invoices: invoices as unknown as PennylaneInvoicesService,
    created,
    imports,
    uploads: () => uploads,
  };
}

// --- Setup ---

const alice: User = {
  id: 'u1',
  companyId: 'c1',
  channel: 'DISCORD',
  externalId: 'discord-alice',
};
const bob: User = { ...alice, id: 'u2', externalId: 'discord-bob' };

const easyJet: ExtractedSupplier = {
  name: 'easyJet Airline Company Limited',
  vatNumber: 'GB745360068',
  registrationNumber: null,
  known: { id: '7', name: 'easyJet' },
};
const newSupplier: ExtractedSupplier = {
  name: 'Boulangerie Paul',
  vatNumber: 'FR40123456789',
  registrationNumber: '123456789',
  known: null,
};

const extractionWith = (
  supplier: ExtractedSupplier = easyJet,
  vatRateBasisPoints: number | null = 2000,
) =>
  new Extraction({
    supplier,
    issuedOn: new Date('2026-11-20'),
    totalCents: 1200,
    vatCents: 200,
    vatRateBasisPoints,
    currency: 'EUR',
  });

const RECAP = 'recap-1';

async function setup(
  extraction = extractionWith(),
  pennylaneOptions: Parameters<typeof fakePennylane>[0] = {},
) {
  const tickets = inMemoryTickets();
  const discord = new RecordingStrategy();
  const notifier = new TicketNotifierService(
    new MessagingGateway([discord]),
    fakeUsers([alice, bob]),
  );
  const reactions = new TicketReactionService(tickets.repository, notifier);
  const pennylane = fakePennylane(pennylaneOptions);
  const importTicket = new ImportTicketService(
    tickets.repository,
    fakeCompanies('company-token'),
    pennylane.suppliers,
    pennylane.invoices,
    reactions,
  );
  const service = new ValidationAnswerService(
    tickets.repository,
    importTicket,
    notifier,
    reactions,
  );

  // a ticket whose recap was sent (no reaction yet)
  const ticket = Ticket.create({
    id: 't1',
    companyId: 'c1',
    userId: alice.id,
    source: new SourceMessage('DISCORD', 'm1'),
  });
  ticket.recordExtraction(extraction);
  await tickets.repository.add(
    ticket,
    new TicketFile('application/pdf', 'r.pdf', Buffer.from('pdf')),
  );

  return {
    service,
    importTicket,
    tickets,
    discord,
    pennylane,
    stored: () => tickets.stored('t1')!,
  };
}

const unavailable = (path: string) =>
  new PennylaneApiError('unavailable', { method: 'POST', path, status: 503 });

// --- Tests ---

describe('ValidationAnswerService', () => {
  it('imports a validated receipt to its existing supplier', async () => {
    const { service, stored, pennylane, discord } = await setup();

    await service.answer(alice, 'validate', 't1', RECAP);

    expect(stored().state).toMatchObject({
      status: 'PENDING_MATCH',
      pennylane: { supplierId: '7', invoiceId: '20' },
    });
    expect(pennylane.created).toEqual([]);
    expect(pennylane.imports).toEqual([
      {
        fileAttachmentId: 10,
        supplierId: 7,
        issuedOn: new Date('2026-11-20'),
        totalCents: 1200,
        vatCents: 200,
        currency: 'EUR',
        vatRate: 'FR_200',
        incomplete: false,
        externalReference: 't1',
      },
    ]);
    // the recap loses its buttons at once, then shows the outcome
    expect(discord.edits.map((e) => e.messageId)).toEqual([RECAP, RECAP]);
    expect(discord.edits[0].text).toContain('⏳ Importing into Pennylane…');
    expect(discord.edits[1].text).toContain('📥 Imported into Pennylane.');
    expect(discord.edits[1].text).toContain('Supplier: easyJet');
    expect(discord.edits.every((e) => !e.buttons?.length)).toBe(true);
    // 🕓 once in Pennylane, until the bank transaction
    expect(discord.reactions.map((r) => r.emoji)).toEqual(['🕓']);
  });

  it('creates a new supplier with the identifiers read', async () => {
    const { service, stored, pennylane } = await setup(
      extractionWith(newSupplier),
    );

    await service.answer(alice, 'validate', 't1', RECAP);

    expect(pennylane.created).toEqual([
      {
        name: 'Boulangerie Paul',
        vatNumber: 'FR40123456789',
        regNo: '123456789',
      },
    ]);
    expect(pennylane.imports[0].supplierId).toBe(99);
    expect(stored().state).toMatchObject({
      status: 'PENDING_MATCH',
      pennylane: { supplierId: '99' },
    });
  });

  it('imports a rate Pennylane does not know as incomplete', async () => {
    const { service, pennylane } = await setup(extractionWith(easyJet, 1900));

    await service.answer(alice, 'validate', 't1', RECAP);

    expect(pennylane.imports[0]).toMatchObject({
      vatRate: 'mixed',
      incomplete: true,
    });
  });

  it('cancels without importing', async () => {
    const { service, stored, pennylane, discord } = await setup();

    await service.answer(alice, 'cancel', 't1', RECAP);

    expect(stored().status).toBe('CANCELLED');
    expect(pennylane.uploads()).toBe(0);
    expect(discord.edits).toHaveLength(1);
    expect(discord.edits[0].text).toContain('🚫 Cancelled.');
    expect(discord.reactions.map((r) => r.emoji)).toEqual(['🚫']);
  });

  it('imports once on a double click', async () => {
    const { service, pennylane, stored } = await setup();

    await Promise.all([
      service.answer(alice, 'validate', 't1', RECAP),
      service.answer(alice, 'validate', 't1', RECAP),
    ]);

    expect(pennylane.imports).toHaveLength(1);
    expect(stored().status).toBe('PENDING_MATCH');
  });

  it("ignores a click on another user's ticket, or an answered one", async () => {
    const { service, stored, pennylane, discord } = await setup();

    await service.answer(bob, 'validate', 't1', RECAP);
    await service.answer(alice, 'validate', 'unknown', RECAP);
    expect(stored().status).toBe('AWAITING_VALIDATION');

    await service.answer(alice, 'cancel', 't1', RECAP);
    await service.answer(alice, 'validate', 't1', RECAP);

    expect(stored().status).toBe('CANCELLED');
    expect(pennylane.uploads()).toBe(0);
    expect(discord.edits).toHaveLength(1);
  });

  it('fails the ticket when Pennylane is down, keeping the supplier created', async () => {
    const { service, stored, discord, pennylane } = await setup(
      extractionWith(newSupplier),
      { uploadError: unavailable('/file_attachments') },
    );

    await service.answer(alice, 'validate', 't1', RECAP);

    expect(stored().state).toMatchObject({
      status: 'FAILED',
      reason: 'Pennylane unavailable',
    });
    expect(pennylane.created).toHaveLength(1);
    expect(discord.edits.at(-1)?.text).toContain(
      '❌ Not imported: Pennylane unavailable. Please send the receipt again.',
    );
    expect(discord.reactions.map((r) => r.emoji)).toEqual(['❌']);
  });

  it('does not create the supplier again when the import is run again', async () => {
    const { importTicket, tickets, stored, pennylane } = await setup(
      extractionWith(newSupplier),
    );
    // a previous attempt stopped after creating the supplier
    const ticket = stored();
    ticket.startImport();
    ticket.recordImportSupplier('99');
    await tickets.repository.save(ticket);

    await importTicket.import(stored());

    expect(pennylane.created).toEqual([]);
    expect(pennylane.imports[0].supplierId).toBe(99);
    expect(stored().status).toBe('PENDING_MATCH');
  });

  it('reuses the invoice a previous attempt created', async () => {
    const { service, stored } = await setup(extractionWith(), {
      importError: new PennylaneApiError('rejected', {
        method: 'POST',
        path: '/supplier_invoices/import',
        status: 422,
        details: { message: 'External reference has already been taken' },
      }),
      existingInvoice: 31,
    });

    await service.answer(alice, 'validate', 't1', RECAP);

    expect(stored().state).toMatchObject({
      status: 'PENDING_MATCH',
      pennylane: { invoiceId: '31' },
    });
  });

  it('fails on a rejected import with no invoice behind it', async () => {
    const { service, stored } = await setup(extractionWith(), {
      importError: new PennylaneApiError('rejected', {
        method: 'POST',
        path: '/supplier_invoices/import',
        status: 422,
      }),
    });

    await service.answer(alice, 'validate', 't1', RECAP);

    expect(stored().state).toMatchObject({
      status: 'FAILED',
      reason: 'Pennylane rejected the request',
    });
  });
});
