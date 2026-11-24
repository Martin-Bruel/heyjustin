/**
 * The document was read, but cannot become a ticket (not a receipt, credit
 * note, several VAT rates…). The message is kept as the ticket failure
 * reason: it never contains data read from the document.
 */
export class ReceiptRejectedError extends Error {
  constructor(message: string) {
    super(`Receipt rejected: ${message}`);
    this.name = 'ReceiptRejectedError';
  }
}
