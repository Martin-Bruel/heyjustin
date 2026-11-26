import { Injectable } from '@nestjs/common';
import { PennylaneApiError } from '../errors/pennylane-api.error.js';
import { PennylaneClient } from '../pennylane.client.js';
import type {
  PennylaneFileAttachmentBody,
  PennylanePage,
  PennylaneSupplierInvoiceBody,
} from '../pennylane.types.js';
import type { PennylaneVatRate } from '../pennylane-vat-rate.js';

export interface PennylaneFile {
  data: Buffer;
  mimeType: string;
  filename: string | null;
}

/** A supplier invoice to import, amounts in cents of `currency`. */
export interface SupplierInvoiceImport {
  fileAttachmentId: number;
  supplierId: number;
  issuedOn: Date;
  totalCents: number;
  vatCents: number;
  currency: string;
  vatRate: PennylaneVatRate;
  /** Imported as incomplete, for the accountant to finish (e.g. an unknown VAT rate). */
  incomplete: boolean;
  /** Our id for this invoice, to find it again in Pennylane. */
  externalReference: string;
}

/** What Pennylane accepts as an attachment (max 100 MB). */
const ACCEPTED_FILE_TYPES: ReadonlyMap<string, string> = new Map([
  ['application/pdf', 'pdf'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png'],
  ['image/tiff', 'tiff'],
  ['image/bmp', 'bmp'],
  ['image/gif', 'gif'],
]);

/** Supplier invoices: the file, then the invoice that refers to it. */
@Injectable()
export class PennylaneInvoicesService {
  constructor(private readonly pennylaneClient: PennylaneClient) {}

  static accepts(mimeType: string): boolean {
    return ACCEPTED_FILE_TYPES.has(mimeType);
  }

  /** Uploads the receipt; the id is used by `importSupplierInvoice`. */
  async uploadFile(token: string, file: PennylaneFile): Promise<number> {
    const extension = ACCEPTED_FILE_TYPES.get(file.mimeType);
    if (!extension) {
      throw new PennylaneApiError('unsupportedFile', {
        method: 'POST',
        path: '/file_attachments',
      });
    }
    const form = new FormData();
    form.append(
      'file',
      new Blob([new Uint8Array(file.data)], { type: file.mimeType }),
      file.filename ?? `receipt.${extension}`,
    );
    const attachment =
      await this.pennylaneClient.request<PennylaneFileAttachmentBody>(token, {
        method: 'POST',
        path: '/file_attachments',
        form,
      });
    return attachment.id;
  }

  /** The id of the imported supplier invoice. */
  async importSupplierInvoice(
    token: string,
    invoice: SupplierInvoiceImport,
  ): Promise<number> {
    const date = isoDate(invoice.issuedOn);
    const amounts = {
      currency_amount: amountOf(invoice.totalCents),
      currency_tax: amountOf(invoice.vatCents),
    };
    const imported =
      await this.pennylaneClient.request<PennylaneSupplierInvoiceBody>(token, {
        method: 'POST',
        path: '/supplier_invoices/import',
        json: {
          file_attachment_id: invoice.fileAttachmentId,
          supplier_id: invoice.supplierId,
          date,
          // a receipt is paid when issued
          deadline: date,
          currency: invoice.currency,
          ...amounts,
          currency_amount_before_tax: amountOf(
            invoice.totalCents - invoice.vatCents,
          ),
          invoice_lines: [{ ...amounts, vat_rate: invoice.vatRate }],
          import_as_incomplete: invoice.incomplete,
          external_reference: invoice.externalReference,
        },
        // the uploaded file may not be processed yet
        retryOnConflict: true,
      });
    return imported.id;
  }

  /**
   * The supplier invoice imported with this `external_reference`, if any.
   * Pennylane refuses a second import with the same one (422 "External
   * reference has already been taken"): after a timeout or a crash, this
   * finds the invoice the first attempt created.
   */
  async findByExternalReference(
    token: string,
    externalReference: string,
  ): Promise<number | null> {
    const page = await this.pennylaneClient.request<
      PennylanePage<PennylaneSupplierInvoiceBody>
    >(token, {
      method: 'GET',
      path: '/supplier_invoices',
      query: {
        filter: [
          {
            field: 'external_reference',
            operator: 'eq',
            value: externalReference,
          },
        ],
        limit: 1,
      },
    });
    return page.items[0]?.id ?? null;
  }
}

/** Calendar dates are stored at UTC midnight. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** 1250 → "12.50": Pennylane wants amounts as decimal strings. */
function amountOf(cents: number): string {
  if (!Number.isSafeInteger(cents) || cents < 0) {
    throw new RangeError('amount must be a non-negative integer of cents');
  }
  return `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}
