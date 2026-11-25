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
  validationRequested: 'ticket.validation.requested',
  reactionUpdated: 'ticket.reaction.updated',
} as const;
