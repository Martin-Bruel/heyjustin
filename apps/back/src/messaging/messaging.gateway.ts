import { Logger } from '@nestjs/common';
import { type FlowContext, runInLogContext } from '../logging/index.js';
import type { Channel } from './channel.js';
import { ChannelNotEnabledError } from './channel-not-enabled.error.js';
import type {
  ChannelStrategy,
  ClickHandler,
  MessageHandler,
} from './channel-strategy.js';
import type {
  IncomingAttachment,
  MessageEdit,
  OutgoingMessage,
  ProcessingTarget,
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
      strategy.listen((message) =>
        this.deliver(
          {
            flow: 'message',
            channel: message.channel,
            messageId: message.messageId,
          },
          () => {
            this.logger.debug('Message received', {
              event: MESSAGING_LOG_EVENTS.messageReceived,
              attachmentCount: message.attachments.length,
            });
            return handler(message);
          },
        ),
      );
    }
  }

  /** Subscribes to clicks on our buttons, on every enabled channel. */
  onButtonClick(handler: ClickHandler): void {
    for (const strategy of this.byChannel.values()) {
      strategy.listenToClicks((click) =>
        this.deliver(
          { flow: 'click', channel: click.channel, messageId: click.messageId },
          () => {
            this.logger.debug('Button clicked', {
              event: MESSAGING_LOG_EVENTS.buttonClicked,
            });
            return handler(click);
          },
        ),
      );
    }
  }

  // async so a disabled channel rejects the promise instead of throwing synchronously
  async send({ channel, ...message }: OutgoingMessage): Promise<void> {
    await this.strategyFor(channel).send(message);
  }

  async edit({ channel, ...edit }: MessageEdit): Promise<void> {
    await this.strategyFor(channel).edit(edit);
  }

  async showProcessing(
    { channel, ...target }: ProcessingTarget,
    signal: AbortSignal,
  ): Promise<void> {
    await this.strategyFor(channel).showProcessing(target, signal);
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
   * Entry point of every received message or click: opens its log context
   * (every log of the flow carries flow, channel and messageId) and logs
   * whatever the handler did not handle, the same way for every channel.
   */
  private deliver(
    flow: FlowContext,
    handle: () => Promise<void>,
  ): Promise<void> {
    return runInLogContext(flow, async () => {
      try {
        await handle();
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
