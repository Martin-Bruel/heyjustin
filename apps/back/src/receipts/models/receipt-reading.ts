import { z } from 'zod';
import { ReceiptRejectedError } from '../errors/receipt-rejected.error.js';
import { Extraction } from './extraction.js';

/**
 * What the AI answers for a document: the facts printed on it, not decisions.
 * Kept apart from Extraction on purpose: this shape guides the model (amounts
 * in currency units, nullable fields so it can say "not readable" instead of
 * guessing), Extraction keeps the domain rules. `toExtraction` decides.
 *
 * A flat object at the root: some providers handle a union poorly in
 * structured output.
 */
export const receiptReadingSchema = z.object({
  documentKind: z
    .enum(['receipt', 'invoice', 'credit_note', 'not_a_receipt', 'unreadable'])
    .describe(
      'receipt or invoice: a purchase. credit_note: a refund, credit note or negative total. ' +
        'not_a_receipt: any other document or picture. unreadable: a receipt whose key fields cannot be read.',
    ),
  receiptCount: z
    .number()
    .int()
    .describe(
      'Number of distinct receipts or invoices visible in the document.',
    ),
  supplierName: z
    .string()
    .nullable()
    .describe(
      'Name of the merchant or company that issued the document, as printed. Not the customer.',
    ),
  issuedOn: z.string().nullable().describe('Issue date, formatted YYYY-MM-DD.'),
  totalAmount: z
    .number()
    .nullable()
    .describe('Total paid, VAT included, in currency units (12.50, not 1250).'),
  vatAmount: z
    .number()
    .nullable()
    .describe(
      'Total VAT, in currency units. 0 when the document states no VAT.',
    ),
  vatRates: z
    .array(z.number())
    .describe(
      'Every distinct VAT rate printed, in percent (20 for 20%). Empty when none is printed.',
    ),
  currency: z
    .string()
    .nullable()
    .describe('ISO 4217 code of the amounts, e.g. EUR for €.'),
});

export type ReceiptReading = z.infer<typeof receiptReadingSchema>;

/** Calendar dates are stored at UTC midnight (see ticket-messages.ts). */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const ISO_CURRENCY = /^[A-Z]{3}$/;
/** A receipt dated tomorrow can be a time zone difference, not further. */
const FUTURE_TOLERANCE_MS = 24 * 60 * 60 * 1000;

/**
 * Turns the AI answer into an Extraction, or throws a ReceiptRejectedError
 * with a reason that never contains the document's data.
 */
export function toExtraction(
  reading: ReceiptReading,
  now: Date = new Date(),
): Extraction {
  switch (reading.documentKind) {
    case 'receipt':
    case 'invoice':
      break;
    case 'credit_note':
      throw new ReceiptRejectedError(
        'credit notes and refunds are not supported',
      );
    case 'not_a_receipt':
      throw new ReceiptRejectedError('the document is not a receipt');
    case 'unreadable':
      throw new ReceiptRejectedError('the receipt is not readable');
  }
  if (reading.receiptCount > 1) {
    throw new ReceiptRejectedError('the document contains several receipts');
  }
  // a receipt in which the model sees no receipt: a contradiction, not data
  if (reading.receiptCount < 1) {
    throw new ReceiptRejectedError('the receipt is not readable');
  }
  if (new Set(reading.vatRates).size > 1) {
    throw new ReceiptRejectedError('several VAT rates are not supported');
  }

  const supplierName = reading.supplierName?.trim();
  if (!supplierName) throw missing('supplier');
  if (reading.totalAmount === null) throw missing('total');
  if (reading.vatAmount === null) throw missing('VAT');
  if (reading.totalAmount < 0 || reading.vatAmount < 0) {
    throw new ReceiptRejectedError(
      'credit notes and refunds are not supported',
    );
  }
  if (reading.totalAmount === 0) {
    throw new ReceiptRejectedError('the total is zero');
  }

  const issuedOn = parseDate(reading.issuedOn);
  if (issuedOn.getTime() > now.getTime() + FUTURE_TOLERANCE_MS) {
    throw new ReceiptRejectedError('the date is in the future');
  }

  const currency = reading.currency?.trim().toUpperCase() ?? '';
  if (!ISO_CURRENCY.test(currency)) throw missing('currency');

  // Extraction checks VAT ≤ total
  return new Extraction(
    supplierName,
    issuedOn,
    toCents(reading.totalAmount),
    toCents(reading.vatAmount),
    currency,
  );
}

function parseDate(value: string | null): Date {
  const match = value ? ISO_DATE.exec(value.trim()) : null;
  if (!match) throw missing('date');
  const [, year, month, day] = match.map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // rejects 2026-02-30, which Date.UTC would roll over to March
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw missing('date');
  }
  return date;
}

function toCents(amount: number): number {
  return Math.round(amount * 100);
}

function missing(field: string): ReceiptRejectedError {
  return new ReceiptRejectedError(`the ${field} is missing or not readable`);
}
