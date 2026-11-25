import { Injectable } from '@nestjs/common';
import { type AiDocument, DocumentReaderService } from '../../ai/index.js';
import type { Extraction } from '../models/extraction.js';
import {
  readSupplierIdentifiers,
  receiptReadingSchema,
  toExtraction,
} from '../models/receipt-reading.js';
import type { KnownSupplier } from '../models/supplier-identifiers.js';
import { RECEIPT_READING_PROMPT } from './receipt-reading.prompt.js';
import { SupplierMatcherService } from './supplier-matcher.service.js';

/**
 * Above this, the list is not sent to the AI: ~15 tokens per supplier, and a
 * model picks less reliably in a very long list. Identifiers (VAT number,
 * SIREN) still match against every supplier, in code.
 */
export const MAX_SUPPLIERS_SENT = 1_000;

/**
 * Reads a receipt in one AI call (the facts printed on it, and which known
 * supplier issued it), then decides in code: the supplier
 * (SupplierMatcherService), then the receipt rules (toExtraction).
 * The provider and model come from the ai module: nothing here depends on them.
 */
@Injectable()
export class ReceiptReaderService {
  constructor(
    private readonly documentReaderService: DocumentReaderService,
    private readonly supplierMatcherService: SupplierMatcherService,
  ) {}

  /**
   * A complete extraction, or throws: DocumentReadError (the AI failed),
   * ReceiptRejectedError or InvalidExtractionError (the receipt is refused).
   * Every message is safe to keep as a failure reason: no data of the document.
   */
  async read(
    document: AiDocument,
    knownSuppliers: readonly KnownSupplier[],
  ): Promise<Extraction> {
    const reading = await this.documentReaderService.read({
      document,
      schema: receiptReadingSchema,
      schemaName: 'receipt',
      instructions: RECEIPT_READING_PROMPT,
      context:
        knownSuppliers.length > 0 && knownSuppliers.length <= MAX_SUPPLIERS_SENT
          ? formatKnownSuppliers(knownSuppliers)
          : undefined,
      label: 'receipt-reading',
    });
    const knownSupplier = this.supplierMatcherService.match(
      readSupplierIdentifiers(reading),
      reading.matchedSupplierId,
      knownSuppliers,
    );
    return toExtraction(reading, knownSupplier);
  }
}

/** One compact line per supplier: `id | name | VAT number | SIREN`. */
function formatKnownSuppliers(suppliers: readonly KnownSupplier[]): string {
  const lines = suppliers.map((supplier) =>
    [
      supplier.id,
      // a name is data: no line break can start a new "instruction"
      supplier.name.replace(/\s+/g, ' ').trim(),
      supplier.vatNumber ?? '',
      supplier.registrationNumber ?? '',
    ].join(' | '),
  );
  return ['Known suppliers (id | name | VAT number | SIREN):', ...lines].join(
    '\n',
  );
}
