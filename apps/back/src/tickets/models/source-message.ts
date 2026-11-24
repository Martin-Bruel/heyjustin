import type { Channel } from '../../messaging/index.js';

/**
 * The user's message the ticket comes from. A message id only makes sense
 * with its channel (ids are unique per channel), so they always go together.
 *
 * Used as idempotency key and as the target of reactions and replies.
 */
export class SourceMessage {
  constructor(
    readonly channel: Channel,
    readonly messageId: string,
  ) {}

  equals(other: SourceMessage): boolean {
    return this.channel === other.channel && this.messageId === other.messageId;
  }
}
