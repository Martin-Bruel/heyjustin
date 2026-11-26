import { currentLogContext } from '../logging/index.js';
import type { Channel } from './channel.js';
import { ChannelNotEnabledError } from './channel-not-enabled.error.js';
import {
  ChannelStrategy,
  type ClickHandler,
  type MessageHandler,
} from './channel-strategy.js';
import type {
  ButtonClick,
  IncomingMessage,
  MessageEdit,
  OutgoingMessage,
  ProcessingTarget,
  ReactionUpdate,
} from './message.types.js';
import { MessagingGateway } from './messaging.gateway.js';

class RecordingStrategy extends ChannelStrategy {
  readonly sent: Omit<OutgoingMessage, 'channel'>[] = [];
  readonly reactions: Omit<ReactionUpdate, 'channel'>[] = [];
  readonly edits: Omit<MessageEdit, 'channel'>[] = [];
  readonly processing: Omit<ProcessingTarget, 'channel'>[] = [];
  handler: MessageHandler | null = null;
  clickHandler: ClickHandler | null = null;

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
  listenToClicks(handler: ClickHandler) {
    this.clickHandler = handler;
  }
  async edit(edit: Omit<MessageEdit, 'channel'>) {
    this.edits.push(edit);
  }
  async showProcessing(target: Omit<ProcessingTarget, 'channel'>) {
    this.processing.push(target);
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

  it('delivers button clicks in a click log context', async () => {
    const discord = new RecordingStrategy('DISCORD');
    const gateway = new MessagingGateway([discord]);
    const received: { click: ButtonClick; context: unknown }[] = [];

    gateway.onButtonClick(async (click) => {
      received.push({ click, context: currentLogContext() });
    });
    const click: ButtonClick = {
      channel: 'DISCORD',
      senderId: 's',
      messageId: 'recap-1',
      buttonId: 'ticket:validate:t1',
    };
    await discord.clickHandler?.(click);

    expect(received).toEqual([
      {
        click,
        context: { flow: 'click', channel: 'DISCORD', messageId: 'recap-1' },
      },
    ]);
  });

  it('catches click handler errors', async () => {
    const discord = new RecordingStrategy('DISCORD');
    const gateway = new MessagingGateway([discord]);

    gateway.onButtonClick(async () => {
      throw new Error('boom');
    });

    await expect(
      discord.clickHandler?.({
        channel: 'DISCORD',
        senderId: 's',
        messageId: 'm1',
        buttonId: 'b',
      }),
    ).resolves.toBeUndefined();
  });

  it('routes the processing indicator to the channel', async () => {
    const discord = new RecordingStrategy('DISCORD');
    const gateway = new MessagingGateway([discord]);

    await gateway.showProcessing(
      { channel: 'DISCORD', recipientId: 'r', messageId: 'm1' },
      new AbortController().signal,
    );

    expect(discord.processing).toEqual([{ recipientId: 'r', messageId: 'm1' }]);
  });

  it('routes message edits to the channel', async () => {
    const discord = new RecordingStrategy('DISCORD');
    const gateway = new MessagingGateway([discord]);

    await gateway.edit({
      channel: 'DISCORD',
      recipientId: 'r',
      messageId: 'm1',
      text: 'done',
    });

    expect(discord.edits).toEqual([
      { recipientId: 'r', messageId: 'm1', text: 'done' },
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
