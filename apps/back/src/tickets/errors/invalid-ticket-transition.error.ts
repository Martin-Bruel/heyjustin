import type { TicketStatus } from '../models/ticket-state.js';
import type { TicketTransition } from '../models/ticket-transitions.js';

export class InvalidTicketTransitionError extends Error {
  constructor(
    readonly transition: TicketTransition,
    readonly current: TicketStatus,
    readonly allowed: readonly TicketStatus[],
  ) {
    super(
      `Cannot apply "${transition}" to a ${current} ticket (allowed from: ${allowed.join(', ')})`,
    );
    this.name = 'InvalidTicketTransitionError';
  }
}
