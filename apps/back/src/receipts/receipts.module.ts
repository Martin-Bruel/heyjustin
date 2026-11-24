import { Module } from '@nestjs/common';
import { AiModule } from '../ai/index.js';
import { ReceiptReaderService } from './services/receipt-reader.service.js';

/**
 * Receipts: what a receipt is and how it is read (schema, prompt, the rules
 * deciding what is accepted). Owns Extraction. Stateless: tickets keeps the
 * lifecycle and the persistence.
 *
 * Imports ai only; never tickets (it takes any document, e.g. a TicketFile).
 */
@Module({
  imports: [AiModule],
  providers: [ReceiptReaderService],
  exports: [ReceiptReaderService],
})
export class ReceiptsModule {}
