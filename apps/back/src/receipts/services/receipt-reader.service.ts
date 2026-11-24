import { Injectable } from '@nestjs/common';
import { type AiDocument, DocumentReaderService } from '../../ai/index.js';
import type { Extraction } from '../models/extraction.js';
import {
  receiptReadingSchema,
  toExtraction,
} from '../models/receipt-reading.js';
import { RECEIPT_READING_PROMPT } from './receipt-reading.prompt.js';

/**
 * Reads a receipt in one AI call (the facts printed on it), then applies the
 * receipt rules in code (toExtraction). The provider and model come from the
 * ai module: nothing here depends on them.
 */
@Injectable()
export class ReceiptReaderService {
  constructor(private readonly documentReaderService: DocumentReaderService) {}

  /**
   * A complete extraction, or throws: DocumentReadError (the AI failed),
   * ReceiptRejectedError or InvalidExtractionError (the receipt is refused).
   * Every message is safe to keep as a failure reason: no data of the document.
   */
  async read(document: AiDocument): Promise<Extraction> {
    const reading = await this.documentReaderService.read({
      document,
      schema: receiptReadingSchema,
      schemaName: 'receipt',
      instructions: RECEIPT_READING_PROMPT,
      label: 'receipt-reading',
    });
    return toExtraction(reading);
  }
}
