/**
 * Public API of the ai module: other modules import from here only, never
 * from @nestjs/ai or the provider SDKs directly.
 */
export { AiModule } from './ai.module.js';
export {
  type AiDocument,
  DocumentReaderService,
  type ReadDocumentRequest,
} from './document-reader.service.js';
export {
  DOCUMENT_READ_FAILURES,
  DocumentReadError,
  type DocumentReadFailure,
} from './errors/document-read.error.js';
