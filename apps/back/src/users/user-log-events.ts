/**
 * Names of the log events of this module (the `event` field). Stable: Grafana
 * queries and dashboards filter on them, a rename breaks them silently.
 */
export const USER_LOG_EVENTS = {
  unknownSender: 'users.sender.unknown',
} as const;
