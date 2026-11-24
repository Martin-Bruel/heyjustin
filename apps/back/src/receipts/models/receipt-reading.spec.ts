import { InvalidExtractionError } from '../errors/invalid-extraction.error.js';
import { ReceiptRejectedError } from '../errors/receipt-rejected.error.js';
import { type ReceiptReading, toExtraction } from './receipt-reading.js';

const now = new Date('2026-11-24T10:00:00Z');

function reading(overrides: Partial<ReceiptReading> = {}): ReceiptReading {
  return {
    documentKind: 'receipt',
    receiptCount: 1,
    supplierName: 'Acme',
    issuedOn: '2026-11-01',
    totalAmount: 1234.56,
    vatAmount: 205.76,
    vatRates: [20],
    currency: 'EUR',
    ...overrides,
  };
}

function rejection(overrides: Partial<ReceiptReading>): string {
  try {
    toExtraction(reading(overrides), now);
  } catch (error) {
    expect(error).toBeInstanceOf(ReceiptRejectedError);
    return (error as Error).message;
  }
  throw new Error('expected a rejection');
}

describe('toExtraction', () => {
  it('converts amounts to cents and the date to UTC midnight', () => {
    const extraction = toExtraction(reading(), now);

    expect(extraction).toMatchObject({
      supplierName: 'Acme',
      totalCents: 123456,
      vatCents: 20576,
      currency: 'EUR',
    });
    expect(extraction.issuedOn.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });

  it('rounds amounts that are not exact in binary', () => {
    expect(
      toExtraction(reading({ totalAmount: 19.99, vatAmount: 3.33 }), now),
    ).toMatchObject({ totalCents: 1999, vatCents: 333 });
  });

  it('accepts invoices, a receipt without VAT, and normalizes text fields', () => {
    const extraction = toExtraction(
      reading({
        documentKind: 'invoice',
        vatAmount: 0,
        vatRates: [],
        supplierName: '  Acme  ',
        currency: 'eur',
      }),
      now,
    );
    expect(extraction).toMatchObject({
      supplierName: 'Acme',
      vatCents: 0,
      currency: 'EUR',
    });
  });

  it('accepts the same VAT rate printed on several lines', () => {
    expect(() =>
      toExtraction(reading({ vatRates: [20, 20] }), now),
    ).not.toThrow();
  });

  it.each([
    [{ documentKind: 'credit_note' as const }, /credit notes and refunds/],
    [{ totalAmount: -10 }, /credit notes and refunds/],
    [{ documentKind: 'not_a_receipt' as const }, /not a receipt/],
    [{ documentKind: 'unreadable' as const }, /not readable/],
    [{ receiptCount: 2 }, /several receipts/],
    [{ receiptCount: 0 }, /not readable/],
    [{ vatRates: [5.5, 20] }, /several VAT rates/],
    [{ supplierName: null }, /supplier is missing/],
    [{ supplierName: '  ' }, /supplier is missing/],
    [{ totalAmount: null }, /total is missing/],
    [{ totalAmount: 0, vatAmount: 0 }, /total is zero/],
    [{ vatAmount: null }, /VAT is missing/],
    [{ issuedOn: null }, /date is missing/],
    [{ issuedOn: '01/11/2026' }, /date is missing/],
    [{ issuedOn: '2026-02-30' }, /date is missing/],
    [{ issuedOn: '2026-11-26' }, /date is in the future/],
    [{ currency: null }, /currency is missing/],
    [{ currency: '€' }, /currency is missing/],
  ])('rejects %o', (overrides, reason) => {
    expect(rejection(overrides)).toMatch(reason);
  });

  it('accepts a date of tomorrow (time zones)', () => {
    expect(() =>
      toExtraction(reading({ issuedOn: '2026-11-25' }), now),
    ).not.toThrow();
  });

  it('keeps the domain invariants of Extraction', () => {
    expect(() =>
      toExtraction(reading({ totalAmount: 10, vatAmount: 20 }), now),
    ).toThrow(InvalidExtractionError);
  });

  it('never puts the read data in the reason', () => {
    expect(
      rejection({ supplierName: 'Acme', vatRates: [5.5, 20] }),
    ).not.toMatch(/Acme|5\.5/);
  });
});
