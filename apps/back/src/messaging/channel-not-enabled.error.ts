import type { Channel } from './channel.js';

/** A message targets a channel that has no strategy wired in this install. */
export class ChannelNotEnabledError extends Error {
  constructor(readonly channel: Channel) {
    super(`Messaging channel ${channel} is not enabled`);
    this.name = 'ChannelNotEnabledError';
  }
}
