import type {
  DocumentReaderService,
  ReadDocumentRequest,
} from '../../ai/index.js';
import { ReceiptRejectedError } from '../errors/receipt-rejected.error.js';
import {
  type ReceiptReading,
  receiptReadingSchema,
} from '../models/receipt-reading.js';
import { RECEIPT_READING_PROMPT } from './receipt-reading.prompt.js';
import { ReceiptReaderService } from './receipt-reader.service.js';

const document = {
  data: Buffer.from('pdf bytes'),
  mimeType: 'application/pdf',
  filename: null,
};

const reading: ReceiptReading = {
  documentKind: 'receipt',
  receiptCount: 1,
  supplierName: 'Acme',
  issuedOn: '2026-11-01',
  totalAmount: 12.5,
  vatAmount: 2.08,
  vatRates: [20],
  currency: 'EUR',
};

/** The ai module is the edge: faked by the answer it would return. */
function setup(answer: ReceiptReading) {
  const requests: ReadDocumentRequest<typeof receiptReadingSchema>[] = [];
  const documentReader = {
    read: async (request: ReadDocumentRequest<typeof receiptReadingSchema>) => {
      requests.push(request);
      return answer;
    },
  } satisfies Record<keyof DocumentReaderService, unknown>;
  const service = new ReceiptReaderService(
    documentReader as unknown as DocumentReaderService,
  );
  return { service, requests };
}

describe('ReceiptReaderService', () => {
  it('reads the document with the receipt schema and prompt', async () => {
    const { service, requests } = setup(reading);

    const extraction = await service.read(document);

    expect(extraction).toMatchObject({
      supplierName: 'Acme',
      totalCents: 1250,
      vatCents: 208,
      currency: 'EUR',
    });
    expect(requests).toEqual([
      expect.objectContaining({
        document,
        schema: receiptReadingSchema,
        instructions: RECEIPT_READING_PROMPT,
      }),
    ]);
  });

  it('applies the receipt rules to the answer', async () => {
    const { service } = setup({ ...reading, vatRates: [5.5, 20] });

    await expect(service.read(document)).rejects.toThrow(ReceiptRejectedError);
  });
});
