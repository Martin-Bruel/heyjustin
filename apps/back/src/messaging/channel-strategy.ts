import type { Channel } from './channel.js';
import type {
  ButtonClick,
  IncomingAttachment,
  IncomingMessage,
  MessageEdit,
  OutgoingMessage,
  ProcessingTarget,
  ReactionUpdate,
} from './message.types.js';

export type MessageHandler = (message: IncomingMessage) => Promise<void>;
export type ClickHandler = (click: ButtonClick) => Promise<void>;

/**
 * Strategy: how to receive from and talk to users on one messaging app.
 * One implementation per channel, picked at runtime by MessagingGateway.
 * Calls do not carry the channel: the strategy already is one.
 */
export abstract class ChannelStrategy {
  abstract readonly channel: Channel;

  /** Calls `handler` for every message a user sends on this channel. */
  abstract listen(handler: MessageHandler): void;

  /**
   * Calls `handler` for every click on a button of our messages. The strategy
   * acknowledges the click to the app first, if the app requires it.
   */
  abstract listenToClicks(handler: ClickHandler): void;

  abstract send(message: Omit<OutgoingMessage, 'channel'>): Promise<void>;

  abstract edit(edit: Omit<MessageEdit, 'channel'>): Promise<void>;

  /**
   * Shows the user that their message is being processed, the app's own way
   * (Discord: "is typing…"), until `signal` aborts or our next message. Kept
   * alive by the strategy when the app's indicator expires. Resolves once
   * shown; may do nothing on an app without such an indicator.
   */
  abstract showProcessing(
    target: Omit<ProcessingTarget, 'channel'>,
    signal: AbortSignal,
  ): Promise<void>;

  abstract react(update: Omit<ReactionUpdate, 'channel'>): Promise<void>;

  abstract download(attachment: IncomingAttachment): Promise<Buffer>;
}
