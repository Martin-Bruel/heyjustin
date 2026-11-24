/**
 * Names of the log events of this module (the `event` field). Stable: Grafana
 * queries and dashboards filter on them, a rename breaks them silently.
 */
export const MESSAGING_LOG_EVENTS = {
  channelConnected: 'messaging.channel.connected',
  channelDisconnected: 'messaging.channel.disconnected',
  channelError: 'messaging.channel.error',
  messageReceived: 'messaging.message.received',
  handlerFailed: 'messaging.message.handler_failed',
} as const;
