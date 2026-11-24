import type { TicketStatus } from './ticket-state.js';

/** Reaction put on the user's message to show the ticket progress. */
export type Reaction =
  'PENDING' | 'MATCHED' | 'MANUAL' | 'FAILED' | 'DUPLICATE' | 'CANCELLED';

/**
 * Reaction to display for each status, `null` meaning no reaction.
 * Typed as an exhaustive record: adding a status without a reaction fails to compile.
 */
const REACTION_BY_STATUS = {
  RECEIVED: 'PENDING', // immediate feedback: the document has been received
  AWAITING_VALIDATION: 'PENDING', // the recap message asks for the next step
  PENDING_MATCH: 'PENDING',
  MATCHED: 'MATCHED',
  MANUAL: 'MANUAL',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
  DUPLICATE: 'DUPLICATE',
} as const satisfies Record<TicketStatus, Reaction | null>;

export function reactionForStatus(status: TicketStatus): Reaction | null {
  return REACTION_BY_STATUS[status];
}
