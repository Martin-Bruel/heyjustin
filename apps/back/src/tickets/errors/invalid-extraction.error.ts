export class InvalidExtractionError extends Error {
  constructor(message: string) {
    super(`Invalid extraction: ${message}`);
    this.name = 'InvalidExtractionError';
  }
}
