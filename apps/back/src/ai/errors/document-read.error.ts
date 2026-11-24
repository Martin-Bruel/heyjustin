/** Why a document could not be read: fixed reasons, safe to store and show. */
export const DOCUMENT_READ_FAILURES = {
  invalidAnswer: 'AI answer did not match the expected format',
  budgetExceeded: 'AI call exceeded its budget',
  providerUnavailable: 'AI provider unavailable',
  /** a 4xx other than 408/409/429: our request is wrong (model, schema, file) */
  requestRejected: 'AI provider rejected the request',
  /** the provider cannot read this kind of file (e.g. a PDF on a local server) */
  unsupportedDocument: 'Document type not supported by the AI provider',
  unexpected: 'AI call failed unexpectedly',
} as const;

export type DocumentReadFailure = keyof typeof DOCUMENT_READ_FAILURES;

/**
 * The AI could not read a document. The message is one of the fixed reasons
 * above: never the model's answer nor the provider's message, which can hold
 * the document's data.
 */
export class DocumentReadError extends Error {
  constructor(readonly failure: DocumentReadFailure) {
    super(DOCUMENT_READ_FAILURES[failure]);
    this.name = 'DocumentReadError';
  }
}
