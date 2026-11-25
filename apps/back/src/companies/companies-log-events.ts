/**
 * Names of the log events of this module (the `event` field). Stable: Grafana
 * queries and dashboards filter on them, a rename breaks them silently.
 */
export const COMPANIES_LOG_EVENTS = {
  /** the default company was created or got the token of the env */
  defaultCompanySynced: 'companies.default_company.synced',
} as const;
