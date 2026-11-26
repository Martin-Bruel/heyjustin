import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  PennylaneAccountService,
  PennylaneApiError,
  PennylaneInvoicesService,
  PennylaneModule,
  PennylaneSuppliersService,
} from '../../src/pennylane/index.js';
// not public (the module exports services only): to read an invoice back
import { PennylaneClient } from '../../src/pennylane/pennylane.client.js';

/**
 * Against a real Pennylane sandbox: `npm run test:e2e`. Checks what the
 * import relies on and the docs leave unclear (decision 013). Every run
 * creates a supplier and invoices in the sandbox company, named
 * `heyjustin-test-<run>`.
 *
 * PENNYLANE_SANDBOX_TOKEN, never a production token: these tests write.
 * Skipped without it.
 */
const token = process.env.PENNYLANE_SANDBOX_TOKEN?.trim() ?? '';

const run = `heyjustin-test-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}`;

/** The parts of a supplier invoice read back here. */
interface SupplierInvoiceBody {
  id: number;
  external_reference: string | null;
  currency_amount: string;
  currency_tax: string;
  supplier: { id: number } | null;
  /** `complete`, or `validation_needed` when imported as incomplete */
  accounting_status: string;
}

/**
 * A one-page PDF with its own text: a different file each time, so
 * Pennylane's duplicate file detection, if any, does not interfere.
 */
function receiptPdf(text: string): Buffer {
  const content = `BT /F1 12 Tf 72 720 Td (${text}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(pdf.length);
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  pdf += offsets
    .map((o) => `${String(o).padStart(10, '0')} 00000 n \n`)
    .join('');
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf, 'latin1');
}

/** Pennylane's answer, for the test output: what it said, never what we sent. */
function describeFailure(error: unknown): string {
  return error instanceof PennylaneApiError
    ? JSON.stringify(error.toLogFields())
    : String(error);
}

describe.skipIf(!token)('Pennylane sandbox', () => {
  let moduleRef: TestingModule;
  let account: PennylaneAccountService;
  let suppliers: PennylaneSuppliersService;
  let invoices: PennylaneInvoicesService;
  let client: PennylaneClient;
  let supplierId: number;

  beforeAll(async () => {
    // the real module and its config (PENNYLANE_BASE_URL, from .env if set)
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        PennylaneModule,
      ],
    }).compile();
    account = moduleRef.get(PennylaneAccountService);
    suppliers = moduleRef.get(PennylaneSuppliersService);
    invoices = moduleRef.get(PennylaneInvoicesService);
    client = moduleRef.get(PennylaneClient);
  });

  afterAll(async () => {
    await moduleRef?.close();
  });

  const upload = (label: string) =>
    invoices.uploadFile(token, {
      data: receiptPdf(`${run} ${label}`),
      mimeType: 'application/pdf',
      filename: null,
    });

  const importInvoice = async (
    label: string,
    overrides: Partial<
      Parameters<PennylaneInvoicesService['importSupplierInvoice']>[1]
    > = {},
  ) =>
    invoices.importSupplierInvoice(token, {
      fileAttachmentId: await upload(label),
      supplierId,
      issuedOn: new Date('2026-11-20T00:00:00Z'),
      totalCents: 1200,
      vatCents: 200,
      currency: 'EUR',
      vatRate: 'FR_200',
      incomplete: false,
      externalReference: `${run}-${label}`,
      ...overrides,
    });

  const readInvoice = (id: number) =>
    client.request<SupplierInvoiceBody>(token, {
      method: 'GET',
      path: `/supplier_invoices/${id}`,
    });

  it('the token has the scopes the import needs', async () => {
    const me = await account.whoAmI(token);
    console.info(
      `sandbox company: ${me.companyName}, scopes: ${me.scopes.join(', ') || '(not listed)'}`,
    );
    expect(PennylaneAccountService.missingScopes(me)).toEqual([]);
  });

  it('creates a supplier with a name only', async () => {
    const supplier = await suppliers.create(token, {
      name: run,
      vatNumber: null,
      regNo: null,
    });
    supplierId = supplier.id;
    expect(supplier.name).toBe(run);

    const listed = await suppliers.list(token);
    expect(listed.map((s) => s.id)).toContain(supplierId);
  });

  it('imports a receipt at 20 % right after its upload', async () => {
    const id = await importInvoice('fr200');

    const invoice = await readInvoice(id);
    expect(invoice).toMatchObject({
      external_reference: `${run}-fr200`,
      supplier: { id: supplierId },
      accounting_status: 'complete',
    });
    expect(Number(invoice.currency_amount)).toBe(12);
    expect(Number(invoice.currency_tax)).toBe(2);
  });

  it('finds an invoice by its external reference', async () => {
    const id = await importInvoice('lookup');

    expect(await invoices.findByExternalReference(token, `${run}-lookup`)).toBe(
      id,
    );
    expect(
      await invoices.findByExternalReference(token, `${run}-missing`),
    ).toBeNull();
  });

  it('accepts a foreign rate as mixed, imported as incomplete', async () => {
    const id = await importInvoice('mixed', {
      // 19 %, a German rate
      totalCents: 1190,
      vatCents: 190,
      vatRate: 'mixed',
      incomplete: true,
    }).catch((error: unknown) => {
      throw new Error(`mixed refused: ${describeFailure(error)}`);
    });

    expect(await readInvoice(id)).toMatchObject({
      external_reference: `${run}-mixed`,
      accounting_status: 'validation_needed',
    });
  });

  it('refuses a second invoice with the same external reference', async () => {
    const externalReference = `${run}-duplicate`;
    await importInvoice('duplicate-1', { externalReference });

    const second = importInvoice('duplicate-2', { externalReference });

    // what ImportTicketService relies on to find the first one back
    await expect(second).rejects.toBeInstanceOf(PennylaneApiError);
    await expect(second).rejects.toMatchObject({ failure: 'rejected' });
  });
});
