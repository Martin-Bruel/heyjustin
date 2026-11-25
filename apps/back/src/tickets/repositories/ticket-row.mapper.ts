import type { Prisma, Ticket as TicketRow } from '../../prisma/index.js';
import { Extraction } from '../../receipts/index.js';
import { PennylaneInfo } from '../models/pennylane-info.js';
import { SourceMessage } from '../models/source-message.js';
import { Ticket } from '../models/ticket.js';
import type {
  TicketState,
  TicketStateOf,
  TicketStatus,
} from '../models/ticket-state.js';
import { InconsistentTicketRowError } from './inconsistent-ticket-row.error.js';

/**
 * Conversion between the flat `Ticket` table and the domain `Ticket`.
 * The table keeps every column nullable; the domain state union decides which
 * ones are filled for a given status.
 */

/** Domain → row: flattens the state, columns unused by the status are set to null. */
export function toTicketRow(ticket: Ticket) {
  const state = ticket.state;
  const extraction = 'extraction' in state ? state.extraction : null;
  const pennylane = 'pennylane' in state ? state.pennylane : null;

  return {
    id: ticket.id,
    companyId: ticket.companyId,
    userId: ticket.userId,
    channel: ticket.source.channel,
    sourceMessageId: ticket.source.messageId,
    caption: ticket.caption,
    createdAt: ticket.createdAt,
    status: state.status,
    displayedReaction: ticket.displayedReaction,

    supplierName: extraction?.supplier.name ?? null,
    supplierVatNumber: extraction?.supplier.vatNumber ?? null,
    supplierRegistrationNumber: extraction?.supplier.registrationNumber ?? null,
    matchedSupplierId: extraction?.supplier.known?.id ?? null,
    matchedSupplierName: extraction?.supplier.known?.name ?? null,
    issuedOn: extraction?.issuedOn ?? null,
    totalCents: extraction?.totalCents ?? null,
    vatCents: extraction?.vatCents ?? null,
    vatRateBasisPoints: extraction?.vatRateBasisPoints ?? null,
    currency: extraction?.currency ?? 'EUR',

    pennylaneSupplierId: pennylane?.supplierId ?? null,
    pennylaneInvoiceId: pennylane?.invoiceId ?? null,
    pennylaneTransactionId:
      state.status === 'MATCHED' ? state.transactionId : null,

    failureReason: state.status === 'FAILED' ? state.reason : null,
  } satisfies Prisma.TicketUncheckedCreateInput;
}

/** Row → domain: rebuilds the state union, throws if the row is inconsistent. */
export function toTicket(row: TicketRow): Ticket {
  return Ticket.restore({
    id: row.id,
    companyId: row.companyId,
    userId: row.userId,
    source: new SourceMessage(row.channel, row.sourceMessageId),
    caption: row.caption,
    createdAt: row.createdAt,
    displayedReaction: row.displayedReaction,
    state: toState(row),
  });
}

/**
 * One builder per status. The mapped type makes it exhaustive and checks each
 * builder returns the right variant: a missing status, a wrong shape, or a
 * schema status unknown to the domain all fail to compile.
 */
type StateBuilders = {
  [S in TicketStatus]: (row: TicketRow) => TicketStateOf<S>;
};

/** Fields shared by every status after extraction. */
const extracted = (row: TicketRow) => ({ extraction: extractionOf(row) });

/** Fields shared by every status after the Pennylane import. */
const imported = (row: TicketRow) => ({
  ...extracted(row),
  pennylane: pennylaneOf(row),
});

const STATE_BUILDERS: StateBuilders = {
  RECEIVED: () => ({ status: 'RECEIVED' }),
  DUPLICATE: () => ({ status: 'DUPLICATE' }),
  AWAITING_VALIDATION: (row) => ({
    status: 'AWAITING_VALIDATION',
    ...extracted(row),
  }),
  CANCELLED: (row) => ({ status: 'CANCELLED', ...extracted(row) }),
  PENDING_MATCH: (row) => ({ status: 'PENDING_MATCH', ...imported(row) }),
  MANUAL: (row) => ({ status: 'MANUAL', ...imported(row) }),
  MATCHED: (row) => ({
    status: 'MATCHED',
    ...imported(row),
    transactionId: required(row, 'pennylaneTransactionId'),
  }),
  FAILED: (row) => ({
    status: 'FAILED',
    reason: required(row, 'failureReason'),
    // a ticket can fail before or after extraction
    extraction: row.totalCents === null ? null : extractionOf(row),
  }),
};

function toState(row: TicketRow): TicketState {
  return STATE_BUILDERS[row.status](row);
}

function extractionOf(row: TicketRow): Extraction {
  return new Extraction({
    supplier: {
      name: required(row, 'supplierName'),
      vatNumber: row.supplierVatNumber,
      registrationNumber: row.supplierRegistrationNumber,
      known:
        row.matchedSupplierId === null
          ? null
          : {
              id: row.matchedSupplierId,
              name: required(row, 'matchedSupplierName'),
            },
    },
    issuedOn: required(row, 'issuedOn'),
    totalCents: required(row, 'totalCents'),
    vatCents: required(row, 'vatCents'),
    vatRateBasisPoints: row.vatRateBasisPoints,
    currency: row.currency,
  });
}

function pennylaneOf(row: TicketRow): PennylaneInfo {
  return new PennylaneInfo(
    required(row, 'pennylaneSupplierId'),
    required(row, 'pennylaneInvoiceId'),
  );
}

function required<K extends keyof TicketRow>(
  row: TicketRow,
  column: K,
): NonNullable<TicketRow[K]> {
  const value = row[column];
  if (value === null || value === undefined) {
    throw new InconsistentTicketRowError(
      row.id,
      `status ${row.status} but ${String(column)} is empty`,
    );
  }
  return value as NonNullable<TicketRow[K]>;
}
