/**
 * Names of the log events of this module (the `event` field). Stable: Grafana
 * queries and dashboards filter on them, a rename breaks them silently.
 */
export const TICKET_LOG_EVENTS = {
  messageIgnored: 'ticket.message.ignored',
  messageRejected: 'ticket.message.rejected',
  duplicateDelivery: 'ticket.duplicate_delivery',
  created: 'ticket.created',
  statusChanged: 'ticket.status.changed',
  extractionSucceeded: 'ticket.extraction.succeeded',
  extractionFailed: 'ticket.extraction.failed',
  /** the company's Pennylane suppliers could not be loaded: no extraction */
  suppliersUnavailable: 'ticket.suppliers.unavailable',
  /** debug only: supplier and amounts are customers' financial data */
  extractionContent: 'ticket.extraction.content',
  /** the "is typing…" indicator failed; the flow went on */
  processingNotShown: 'ticket.processing.not_shown',
  validationRequested: 'ticket.validation.requested',
  /** a click on a recap that is not this user's, or already answered */
  clickIgnored: 'ticket.click.ignored',
  importSucceeded: 'ticket.import.succeeded',
  importFailed: 'ticket.import.failed',
  /** the invoice was already in Pennylane (a previous attempt): reused */
  importRecovered: 'ticket.import.recovered',
  /** the recap could not be rewritten; the ticket went on */
  recapUpdateFailed: 'ticket.recap.update_failed',
  reactionUpdated: 'ticket.reaction.updated',
} as const;
