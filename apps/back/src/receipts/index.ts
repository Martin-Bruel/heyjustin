/** Public API of the receipts module: other modules import from here only. */
export { InvalidExtractionError } from './errors/invalid-extraction.error.js';
export { ReceiptRejectedError } from './errors/receipt-rejected.error.js';
export {
  type ExtractedSupplier,
  Extraction,
  type ExtractionProps,
  type KnownSupplierRef,
} from './models/extraction.js';
export type { KnownSupplier } from './models/supplier-identifiers.js';
export { ReceiptsModule } from './receipts.module.js';
export { ReceiptReaderService } from './services/receipt-reader.service.js';
