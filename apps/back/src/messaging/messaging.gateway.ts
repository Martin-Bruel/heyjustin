import { Logger } from '@nestjs/common';
import { type MessageFlow, runInLogContext } from '../logging/index.js';
import type { Channel } from './channel.js';
import { ChannelNotEnabledError } from './channel-not-enabled.error.js';
import type { ChannelStrategy, MessageHandler } from './channel-strategy.js';
import type {
  IncomingAttachment,
  IncomingMessage,
  OutgoingMessage,
  ReactionUpdate,
} from './message.types.js';
import { MESSAGING_LOG_EVENTS } from './messaging-log-events.js';

/**
 * Public API of MessagingModule: one entry point for every messaging app.
 * Strategy context: forwards each call to the strategy of the message's
 * channel, so callers never know which apps exist.
 */
export class MessagingGateway {
  private readonly logger = new Logger(MessagingGateway.name);
  private readonly byChannel = new Map<Channel, ChannelStrategy>();

  /** `strategies`: the channels enabled in this install, one strategy each. */
  constructor(strategies: ChannelStrategy[]) {
    for (const strategy of strategies) {
      if (this.byChannel.has(strategy.channel)) {
        throw new Error(`Two strategies registered for ${strategy.channel}`);
      }
      this.byChannel.set(strategy.channel, strategy);
    }
  }

  get enabledChannels(): Channel[] {
    return [...this.byChannel.keys()];
  }

  /** Subscribes to messages received on every enabled channel. */
  onMessage(handler: MessageHandler): void {
    for (const strategy of this.byChannel.values()) {
      strategy.listen((message) => this.deliver(message, handler));
    }
  }

  // async so a disabled channel rejects the promise instead of throwing synchronously
  async send({ channel, ...message }: OutgoingMessage): Promise<void> {
    await this.strategyFor(channel).send(message);
  }

  async react({ channel, ...update }: ReactionUpdate): Promise<void> {
    await this.strategyFor(channel).react(update);
  }

  async download(
    channel: Channel,
    attachment: IncomingAttachment,
  ): Promise<Buffer> {
    return this.strategyFor(channel).download(attachment);
  }

  /**
   * Entry point of every received message: opens its log context (every log
   * of the flow carries flow, channel and messageId) and logs whatever the handler
   * did not handle, the same way for every channel.
   */
  private deliver(
    message: IncomingMessage,
    handler: MessageHandler,
  ): Promise<void> {
    const flow: MessageFlow = {
      flow: 'message',
      channel: message.channel,
      messageId: message.messageId,
    };
    return runInLogContext(flow, async () => {
      this.logger.debug('Message received', {
        event: MESSAGING_LOG_EVENTS.messageReceived,
        attachmentCount: message.attachments.length,
      });
      try {
        await handler(message);
      } catch (error) {
        this.logger.error('Message handler failed', error, {
          event: MESSAGING_LOG_EVENTS.handlerFailed,
        });
      }
    });
  }

  private strategyFor(channel: Channel): ChannelStrategy {
    const strategy = this.byChannel.get(channel);
    if (!strategy) throw new ChannelNotEnabledError(channel);
    return strategy;
  }
}
