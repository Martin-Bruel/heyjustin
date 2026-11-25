import { InvalidExtractionError } from '../errors/invalid-extraction.error.js';

/** 100% in basis points. */
const MAX_VAT_RATE = 10_000;

/** A supplier the company already has (in its accounting tool). */
export interface KnownSupplierRef {
  id: string;
  name: string;
}

/** Who issued the receipt. */
export interface ExtractedSupplier {
  /** As printed on the receipt. */
  name: string;
  /** Intra-EU VAT number, normalized (`FR12345678901`), when printed. */
  vatNumber: string | null;
  /** French SIREN (9 digits), when printed or derived from a French VAT number. */
  registrationNumber: string | null;
  /** The existing supplier it was matched with; `null`: a new supplier. */
  known: KnownSupplierRef | null;
}

export interface ExtractionProps {
  supplier: ExtractedSupplier;
  issuedOn: Date;
  /** VAT included. */
  totalCents: number;
  vatCents: number;
  /** 2000 = 20%, 550 = 5.5%; `null` when the receipt prints none. */
  vatRateBasisPoints: number | null;
  currency: string;
}

/** Data read from the receipt. Amounts are in cents, VAT included in the total. */
export class Extraction {
  readonly supplier: ExtractedSupplier;
  readonly issuedOn: Date;
  readonly totalCents: number;
  readonly vatCents: number;
  readonly vatRateBasisPoints: number | null;
  readonly currency: string;

  constructor(props: ExtractionProps) {
    const { totalCents, vatCents, vatRateBasisPoints } = props;
    if (totalCents < 0) {
      throw new InvalidExtractionError('total must not be negative');
    }
    if (vatCents < 0) {
      throw new InvalidExtractionError('VAT must not be negative');
    }
    if (vatCents > totalCents) {
      throw new InvalidExtractionError('VAT must not exceed the total');
    }
    if (
      vatRateBasisPoints !== null &&
      !(
        Number.isInteger(vatRateBasisPoints) &&
        vatRateBasisPoints >= 0 &&
        vatRateBasisPoints <= MAX_VAT_RATE
      )
    ) {
      throw new InvalidExtractionError('VAT rate must be between 0 and 100%');
    }
    this.supplier = props.supplier;
    this.issuedOn = props.issuedOn;
    this.totalCents = totalCents;
    this.vatCents = vatCents;
    this.vatRateBasisPoints = vatRateBasisPoints;
    this.currency = props.currency;
  }
}
