import { currentLogContext } from '../logging/index.js';
import type { Channel } from './channel.js';
import { ChannelNotEnabledError } from './channel-not-enabled.error.js';
import { ChannelStrategy, type MessageHandler } from './channel-strategy.js';
import type {
  IncomingMessage,
  OutgoingMessage,
  ReactionUpdate,
} from './message.types.js';
import { MessagingGateway } from './messaging.gateway.js';

class RecordingStrategy extends ChannelStrategy {
  readonly sent: Omit<OutgoingMessage, 'channel'>[] = [];
  readonly reactions: Omit<ReactionUpdate, 'channel'>[] = [];
  handler: MessageHandler | null = null;

  constructor(readonly channel: Channel) {
    super();
  }
  listen(handler: MessageHandler) {
    this.handler = handler;
  }
  async send(message: Omit<OutgoingMessage, 'channel'>) {
    this.sent.push(message);
  }
  async react(update: Omit<ReactionUpdate, 'channel'>) {
    this.reactions.push(update);
  }
  async download() {
    return Buffer.from(this.channel);
  }
}

describe('MessagingGateway', () => {
  it("routes each call to the strategy of the message's channel, without the channel", async () => {
    const discord = new RecordingStrategy('DISCORD');
    const whatsapp = new RecordingStrategy('WHATSAPP');
    const gateway = new MessagingGateway([discord, whatsapp]);

    await gateway.send({ channel: 'WHATSAPP', recipientId: 'r1', text: 'hi' });
    await gateway.react({
      channel: 'DISCORD',
      recipientId: 'r2',
      messageId: 'm1',
      emoji: '✅',
    });

    expect(whatsapp.sent).toEqual([{ recipientId: 'r1', text: 'hi' }]);
    expect(discord.sent).toEqual([]);
    expect(discord.reactions).toEqual([
      { recipientId: 'r2', messageId: 'm1', emoji: '✅' },
    ]);
    const file = await gateway.download('DISCORD', {
      ref: 'x',
      contentType: null,
      filename: null,
    });
    expect(file.toString()).toBe('DISCORD');
  });

  it('subscribes a handler to every enabled channel', async () => {
    const discord = new RecordingStrategy('DISCORD');
    const whatsapp = new RecordingStrategy('WHATSAPP');
    const gateway = new MessagingGateway([discord, whatsapp]);
    const received: IncomingMessage[] = [];

    gateway.onMessage(async (message) => {
      received.push(message);
    });
    const message = (channel: Channel): IncomingMessage => ({
      channel,
      senderId: 's',
      messageId: 'm',
      text: null,
      attachments: [],
    });
    await discord.handler?.(message('DISCORD'));
    await whatsapp.handler?.(message('WHATSAPP'));

    expect(received.map((m) => m.channel)).toEqual(['DISCORD', 'WHATSAPP']);
  });

  it('runs each received message in its own log context', async () => {
    const discord = new RecordingStrategy('DISCORD');
    const gateway = new MessagingGateway([discord]);
    const contexts: unknown[] = [];

    gateway.onMessage(async () => {
      contexts.push(currentLogContext());
    });
    await discord.handler?.({
      channel: 'DISCORD',
      senderId: 's',
      messageId: 'm1',
      text: null,
      attachments: [],
    });

    expect(contexts).toEqual([
      { flow: 'message', channel: 'DISCORD', messageId: 'm1' },
    ]);
  });

  it('catches handler errors so one message cannot break the channel', async () => {
    const discord = new RecordingStrategy('DISCORD');
    const gateway = new MessagingGateway([discord]);

    gateway.onMessage(async () => {
      throw new Error('boom');
    });

    await expect(
      discord.handler?.({
        channel: 'DISCORD',
        senderId: 's',
        messageId: 'm1',
        text: null,
        attachments: [],
      }),
    ).resolves.toBeUndefined();
  });

  it('rejects for a channel that is not enabled', async () => {
    const gateway = new MessagingGateway([new RecordingStrategy('DISCORD')]);

    expect(gateway.enabledChannels).toEqual(['DISCORD']);
    await expect(
      gateway.send({ channel: 'WHATSAPP', recipientId: 'r', text: 'hi' }),
    ).rejects.toThrow(ChannelNotEnabledError);
  });

  it('refuses two strategies for the same channel', () => {
    expect(
      () =>
        new MessagingGateway([
          new RecordingStrategy('DISCORD'),
          new RecordingStrategy('DISCORD'),
        ]),
    ).toThrow(/Two strategies registered for DISCORD/);
  });
});
