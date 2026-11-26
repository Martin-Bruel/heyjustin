import type { Extraction } from '../../receipts/index.js';
import type { PennylaneInfo } from './pennylane-info.js';

/**
 * What a ticket holds at each step of its lifecycle.
 *
 * Each variant only carries the data that exists at that step, so an
 * inconsistent ticket (e.g. MATCHED without a transaction) cannot be built.
 * Check `status` first and TypeScript narrows to the matching variant.
 */
export type TicketState =
  /** File downloaded, extraction in progress. */
  | { status: 'RECEIVED' }
  /** Data extracted, recap sent to the user for validation. */
  | { status: 'AWAITING_VALIDATION'; extraction: Extraction }
  /**
   * Validated by the user, Pennylane import in progress. `supplierId` is set
   * once the supplier exists (matched, or just created), so that a retry
   * does not create it again.
   */
  | { status: 'IMPORTING'; extraction: Extraction; supplierId: string | null }
  /** Imported in Pennylane, bank transaction not there yet. */
  | {
      status: 'PENDING_MATCH';
      extraction: Extraction;
      pennylane: PennylaneInfo;
    }
  /** Matched with a bank transaction. Final. */
  | {
      status: 'MATCHED';
      extraction: Extraction;
      pennylane: PennylaneInfo;
      transactionId: string;
    }
  /** No transaction found, to be matched by hand in Pennylane. Final. */
  | {
      status: 'MANUAL';
      extraction: Extraction;
      pennylane: PennylaneInfo;
    }
  /** Processing failed, the user has to send the document again. Final. */
  | { status: 'FAILED'; reason: string; extraction: Extraction | null }
  /** The user rejected the recap. Final. */
  | { status: 'CANCELLED'; extraction: Extraction }
  /** Same document already sent before. Final. */
  | { status: 'DUPLICATE' };

export type TicketStatus = TicketState['status'];

/** The state variant matching one or more statuses. */
export type TicketStateOf<S extends TicketStatus> = Extract<
  TicketState,
  { status: S }
>;
