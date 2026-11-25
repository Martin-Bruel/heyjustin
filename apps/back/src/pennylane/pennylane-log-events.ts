/**
 * Names of the log events of this module (the `event` field). Stable: Grafana
 * queries and dashboards filter on them, a rename breaks them silently.
 */
export const PENNYLANE_LOG_EVENTS = {
  /** debug: one HTTP call (method, path, status, duration); never the body */
  request: 'pennylane.api.request',
  /** a call is retried: rate limit (429) or resource not ready (409) */
  retried: 'pennylane.api.retried',
  /** a supplier was created in Pennylane (none had this name) */
  supplierCreated: 'pennylane.supplier.created',
} as const;
