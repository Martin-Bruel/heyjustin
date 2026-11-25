/**
 * The parts of the Pennylane API v2 we use, as Pennylane sends them
 * (snake_case, ids as numbers, amounts as strings). Services turn them into
 * the plain types they return.
 */

/** Cursor-based list (`next_cursor` is null on the last page). */
export interface PennylanePage<T> {
  items: T[];
  has_more: boolean;
  next_cursor: string | null;
}

export interface PennylaneSupplierBody {
  id: number;
  name: string;
  vat_number?: string | null;
  /** SIREN */
  reg_no?: string | null;
}

export interface PennylaneFileAttachmentBody {
  id: number;
}

export interface PennylaneSupplierInvoiceBody {
  id: number;
}

export interface PennylaneMeBody {
  company: { id: number; name: string };
  scopes?: string[];
}

/** `filter` query parameter: ANDed conditions. */
export interface PennylaneFilter {
  field: string;
  operator:
    | 'eq'
    | 'not_eq'
    | 'lt'
    | 'lteq'
    | 'gt'
    | 'gteq'
    | 'in'
    | 'not_in'
    | 'start_with';
  value: string | string[];
}
