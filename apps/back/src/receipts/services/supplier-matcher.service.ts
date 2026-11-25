import { Injectable } from '@nestjs/common';
import type { KnownSupplierRef } from '../models/extraction.js';
import {
  type KnownSupplier,
  type SupplierIdentifiers,
  supplierIdentifiersOf,
} from '../models/supplier-identifiers.js';

/**
 * Which of the company's suppliers issued a receipt (a domain service: it
 * relates the receipt to the company's suppliers, and belongs to neither).
 *
 * Identifiers decide first: they are certain, the AI's choice is not. The
 * AI's choice is kept only when it is one of the suppliers sent, and when no
 * identifier printed on the receipt contradicts it.
 */
@Injectable()
export class SupplierMatcherService {
  /** The matched supplier, `null` for a new one. */
  match(
    read: SupplierIdentifiers,
    aiChoice: string | null,
    knownSuppliers: readonly KnownSupplier[],
  ): KnownSupplierRef | null {
    // the accounting tool may store them with spaces or in lower case
    const known = knownSuppliers.map((supplier) => ({
      ...supplier,
      ...supplierIdentifiersOf(supplier.vatNumber, supplier.registrationNumber),
    }));

    const byIdentifier =
      uniqueBy(
        known,
        (supplier) => !!read.vatNumber && supplier.vatNumber === read.vatNumber,
      ) ??
      uniqueBy(
        known,
        (supplier) =>
          !!read.registrationNumber &&
          supplier.registrationNumber === read.registrationNumber,
      );
    if (byIdentifier) return refOf(byIdentifier);

    const chosen = known.find((supplier) => supplier.id === aiChoice);
    if (!chosen || contradicts(read, chosen)) return null;
    return refOf(chosen);
  }
}

/** A printed identifier that differs from the supplier's own. */
function contradicts(
  read: SupplierIdentifiers,
  supplier: SupplierIdentifiers,
): boolean {
  const differs = (printed: string | null, stored: string | null) =>
    !!printed && !!stored && printed !== stored;
  return (
    differs(read.vatNumber, supplier.vatNumber) ||
    differs(read.registrationNumber, supplier.registrationNumber)
  );
}

/** The only supplier matching, `undefined` if none or several. */
function uniqueBy(
  known: readonly KnownSupplier[],
  matches: (supplier: KnownSupplier) => boolean,
): KnownSupplier | undefined {
  const found = known.filter(matches);
  return found.length === 1 ? found[0] : undefined;
}

function refOf(supplier: KnownSupplier): KnownSupplierRef {
  return { id: supplier.id, name: supplier.name };
}
