import type { Channel } from './channel.js';
import type {
  IncomingAttachment,
  IncomingMessage,
  OutgoingMessage,
  ReactionUpdate,
} from './message.types.js';

export type MessageHandler = (message: IncomingMessage) => Promise<void>;

/**
 * Strategy: how to receive from and talk to users on one messaging app.
 * One implementation per channel, picked at runtime by MessagingGateway.
 * Calls do not carry the channel: the strategy already is one.
 */
export abstract class ChannelStrategy {
  abstract readonly channel: Channel;

  /** Calls `handler` for every message a user sends on this channel. */
  abstract listen(handler: MessageHandler): void;

  abstract send(message: Omit<OutgoingMessage, 'channel'>): Promise<void>;

  abstract react(update: Omit<ReactionUpdate, 'channel'>): Promise<void>;

  abstract download(attachment: IncomingAttachment): Promise<Buffer>;
}
