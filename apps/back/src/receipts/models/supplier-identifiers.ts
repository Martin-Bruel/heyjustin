import type { KnownSupplierRef } from './extraction.js';

/** What identifies a supplier for sure, normalized; `null` when unknown. */
export interface SupplierIdentifiers {
  /** Intra-EU VAT number, e.g. `FR12345678901` */
  vatNumber: string | null;
  /** French SIREN, 9 digits */
  registrationNumber: string | null;
}

/** A supplier the company already has, with what identifies it. */
export interface KnownSupplier extends KnownSupplierRef, SupplierIdentifiers {}

const VAT_NUMBER = /^[A-Z]{2}[0-9A-Z]{2,13}$/;
/** FR + 2-character key + SIREN. */
const FRENCH_VAT_NUMBER = /^FR[0-9A-Z]{2}(\d{9})$/;

/**
 * The identifiers as printed or stored (spaces, dots, lower case), normalized.
 * Malformed ones are dropped: a wrong identifier is worse than none.
 */
export function supplierIdentifiersOf(
  vatNumber: string | null,
  registrationNumber: string | null,
): SupplierIdentifiers {
  const vat = normalizeVatNumber(vatNumber);
  return {
    vatNumber: vat,
    registrationNumber: normalizeRegistrationNumber(registrationNumber, vat),
  };
}

/** `fr 12 345 678 901` → `FR12345678901`; `null` if it is not one. */
function normalizeVatNumber(value: string | null): string | null {
  const normalized = value?.toUpperCase().replace(/[\s.-]/g, '') ?? '';
  return VAT_NUMBER.test(normalized) ? normalized : null;
}

/**
 * The SIREN (9 digits): printed as is, as a SIRET (14 digits, SIREN + 5),
 * or inside a French VAT number. `null` otherwise.
 */
function normalizeRegistrationNumber(
  value: string | null,
  vatNumber: string | null,
): string | null {
  const digits = value?.replace(/[\s.-]/g, '') ?? '';
  if (/^\d{9}$/.test(digits)) return digits;
  if (/^\d{14}$/.test(digits)) return digits.slice(0, 9);
  return (vatNumber && FRENCH_VAT_NUMBER.exec(vatNumber)?.[1]) ?? null;
}
