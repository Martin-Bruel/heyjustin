/**
 * A ticket row whose columns do not match its status (corrupted data or
 * missing migration). Persistence concern: only the Prisma mapper throws it.
 */
export class InconsistentTicketRowError extends Error {
  constructor(ticketId: string, detail: string) {
    super(`Inconsistent ticket ${ticketId} in database: ${detail}`);
    this.name = 'InconsistentTicketRowError';
  }
}
