/** The ticket's user cannot be reached on the channel the ticket came from. */
export class TicketRecipientUnavailableError extends Error {
  constructor(ticketId: string, reason: string) {
    super(`Cannot notify the user of ticket ${ticketId}: ${reason}`);
    this.name = 'TicketRecipientUnavailableError';
  }
}
