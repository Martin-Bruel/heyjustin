import { Injectable } from '@nestjs/common';
import type { Extraction } from '../models/extraction.js';
import type { TicketFile } from '../models/ticket-file.js';

/**
 * Reads the receipt data from a file.
 *
 * TODO: implement with @nestjs/ai (structured output into an Extraction).
 * The AI provider is chosen there, not here: no port needed.
 */
@Injectable()
export class InvoiceExtractorService {
  /**
   * Returns a complete extraction, or throws when the document cannot be read.
   * The error message is kept as the ticket failure reason.
   */
  async extract(_file: TicketFile): Promise<Extraction> {
    throw new Error('Invoice extraction is not implemented yet');
  }
}
