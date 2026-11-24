import { InvalidExtractionError } from '../errors/invalid-extraction.error.js';

/** Data read from the receipt. Amounts are in cents, VAT included in the total. */
export class Extraction {
  constructor(
    readonly supplierName: string,
    readonly issuedOn: Date,
    readonly totalCents: number,
    readonly vatCents: number,
    readonly currency: string,
  ) {
    if (totalCents < 0) {
      throw new InvalidExtractionError('total must not be negative');
    }
    if (vatCents < 0) {
      throw new InvalidExtractionError('VAT must not be negative');
    }
    if (vatCents > totalCents) {
      throw new InvalidExtractionError('VAT must not exceed the total');
    }
  }
}
