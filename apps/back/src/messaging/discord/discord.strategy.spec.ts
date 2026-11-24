import type { IncomingMessage } from '../message.types.js';
import type { DiscordClient, DiscordDirectMessage } from './discord.client.js';
import { DiscordStrategy } from './discord.strategy.js';

/** Captures the DM handler and what the strategy asks Discord to do. */
function fakeDiscord() {
  const calls = {
    handler: null as ((m: DiscordDirectMessage) => Promise<void>) | null,
    sent: [] as Parameters<DiscordClient['sendDirectMessage']>[0][],
    reactions: [] as [string, string, string | null][],
  };
  const client = {
    onDirectMessage: (handler: (m: DiscordDirectMessage) => Promise<void>) => {
      calls.handler = handler;
    },
    sendDirectMessage: async (
      params: Parameters<DiscordClient['sendDirectMessage']>[0],
    ) => {
      calls.sent.push(params);
    },
    setOwnReaction: async (
      userId: string,
      messageId: string,
      emoji: string | null,
    ) => {
      calls.reactions.push([userId, messageId, emoji]);
    },
  };
  return { client: client as unknown as DiscordClient, calls };
}

describe('DiscordStrategy', () => {
  it('normalizes DMs into incoming messages', async () => {
    const discord = fakeDiscord();
    const strategy = new DiscordStrategy(discord.client);
    const received: IncomingMessage[] = [];

    strategy.listen(async (message) => {
      received.push(message);
    });
    await discord.calls.handler?.({
      messageId: 'm1',
      authorId: 'alice',
      content: '',
      attachments: [
        {
          url: 'https://cdn/r.pdf',
          contentType: 'application/pdf',
          name: 'r.pdf',
        },
      ],
    });

    expect(received).toEqual([
      {
        channel: 'DISCORD',
        senderId: 'alice',
        messageId: 'm1',
        text: null, // empty Discord content
        attachments: [
          {
            ref: 'https://cdn/r.pdf',
            contentType: 'application/pdf',
            filename: 'r.pdf',
          },
        ],
      },
    ]);
  });

  it('sends DMs and reactions to the recipient', async () => {
    const discord = fakeDiscord();
    const strategy = new DiscordStrategy(discord.client);

    await strategy.send({
      recipientId: 'alice',
      text: 'hi',
      replyToMessageId: 'm1',
    });
    await strategy.react({
      recipientId: 'alice',
      messageId: 'm1',
      emoji: '✅',
    });

    expect(discord.calls.sent).toEqual([
      {
        userId: 'alice',
        content: 'hi',
        replyToMessageId: 'm1',
        buttons: undefined,
      },
    ]);
    expect(discord.calls.reactions).toEqual([['alice', 'm1', '✅']]);
  });
});
