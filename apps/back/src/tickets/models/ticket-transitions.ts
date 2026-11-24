import type { TicketStateOf, TicketStatus } from './ticket-state.js';

/**
 * The ticket state machine: for each transition (named after the `Ticket`
 * method that runs it), the statuses it may start from.
 *
 * Single source of truth for the lifecycle. To allow a new path, add a status
 * here: the matching `Ticket` method then receives the wider state type and
 * TypeScript points at what it must now handle.
 *
 *   RECEIVED ──recordExtraction──▶ AWAITING_VALIDATION ──recordPennylaneImport──▶ PENDING_MATCH
 *     │                               │                                             │
 *     ├──markAsDuplicate──▶ DUPLICATE  ├──cancel──▶ CANCELLED                         ├──matchTransaction──▶ MATCHED
 *     └──fail──▶ FAILED ◀──────────────┘ (fail)                                       └──requireManualMatching──▶ MANUAL
 */
export const TICKET_TRANSITIONS = {
  recordExtraction: ['RECEIVED'],
  markAsDuplicate: ['RECEIVED'],
  recordPennylaneImport: ['AWAITING_VALIDATION'],
  cancel: ['AWAITING_VALIDATION'],
  matchTransaction: ['PENDING_MATCH'],
  requireManualMatching: ['PENDING_MATCH'],
  fail: ['RECEIVED', 'AWAITING_VALIDATION'],
} as const satisfies Record<string, readonly TicketStatus[]>;

export type TicketTransition = keyof typeof TICKET_TRANSITIONS;

/** The state a ticket can be in when transition `T` starts. */
export type TicketStateBefore<T extends TicketTransition> = TicketStateOf<
  (typeof TICKET_TRANSITIONS)[T][number]
>;

export function statusesAllowedFor(
  transition: TicketTransition,
): readonly TicketStatus[] {
  return TICKET_TRANSITIONS[transition];
}
