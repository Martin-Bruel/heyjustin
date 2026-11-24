import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from '@nestjs/common';
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  Events,
  GatewayIntentBits,
  Partials,
  type Message,
} from 'discord.js';
import { MESSAGING_LOG_EVENTS } from '../messaging-log-events.js';
import { type DiscordConfig, discordConfig } from './discord.config.js';

export type DiscordAttachment = {
  url: string;
  contentType: string | null;
  name: string;
};

export type DiscordDirectMessage = {
  messageId: string;
  authorId: string;
  content: string;
  attachments: DiscordAttachment[];
};

export type DiscordButton = {
  id: string;
  label: string;
  style: 'primary' | 'secondary' | 'success' | 'danger';
};

const BUTTON_STYLES: Record<DiscordButton['style'], ButtonStyle> = {
  primary: ButtonStyle.Primary,
  secondary: ButtonStyle.Secondary,
  success: ButtonStyle.Success,
  danger: ButtonStyle.Danger,
};

/**
 * Discord bot connection: thin wrapper over discord.js, used by DiscordStrategy.
 *
 * Discord has no webhook for messages: the bot stays connected to the Gateway
 * (websocket) and receives direct messages as events. DMs do not need the
 * privileged Message Content intent.
 */
@Injectable()
export class DiscordClient
  implements OnApplicationBootstrap, OnApplicationShutdown
{
  private readonly logger = new Logger(DiscordClient.name);
  private readonly client = new Client({
    intents: [GatewayIntentBits.DirectMessages],
    // DM channels are not cached: without this, their messages are not emitted
    partials: [Partials.Channel],
  });

  constructor(
    @Inject(discordConfig.KEY) private readonly discordConfig: DiscordConfig,
  ) {}

  /** After every module registered its handlers, so no message is missed. */
  async onApplicationBootstrap() {
    this.logConnectionEvents();
    await this.client.login(this.discordConfig.botToken);
  }

  async onApplicationShutdown() {
    await this.client.destroy();
  }

  /**
   * Calls `handler` for every DM sent to the bot by a human. The handler must
   * not reject: MessagingGateway catches and logs errors for every channel.
   */
  onDirectMessage(
    handler: (message: DiscordDirectMessage) => Promise<void>,
  ): void {
    this.client.on(Events.MessageCreate, (message) => {
      if (message.author.bot || message.inGuild()) return;
      void handler(toDirectMessage(message));
    });
  }

  async download(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Discord download failed: HTTP ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
  }

  /**
   * Replaces the bot's reaction on a DM. Discord keeps every reaction added,
   * so the previous one is removed first. `null` only removes.
   */
  async setOwnReaction(
    userId: string,
    messageId: string,
    emoji: string | null,
  ): Promise<void> {
    const message = await this.fetchDirectMessage(userId, messageId);
    const botId = this.client.user?.id;
    if (botId) {
      const own = message.reactions.cache.filter((reaction) => reaction.me);
      await Promise.all(own.map((reaction) => reaction.users.remove(botId)));
    }
    if (emoji) await message.react(emoji);
  }

  async sendDirectMessage(params: {
    userId: string;
    content: string;
    replyToMessageId?: string;
    buttons?: DiscordButton[];
  }): Promise<void> {
    const user = await this.client.users.fetch(params.userId);
    const dm = await user.createDM();
    await dm.send({
      content: params.content,
      reply: params.replyToMessageId
        ? { messageReference: params.replyToMessageId }
        : undefined,
      components: params.buttons?.length ? [toButtonRow(params.buttons)] : [],
    });
  }

  /** The Gateway reconnects by itself: these logs show its state in Grafana. */
  private logConnectionEvents(): void {
    const channel = 'DISCORD';
    this.client.on(Events.ClientReady, () =>
      this.logger.log('Discord connected', {
        event: MESSAGING_LOG_EVENTS.channelConnected,
        channel,
      }),
    );
    this.client.on(Events.ShardDisconnect, (closeEvent) =>
      this.logger.warn('Discord disconnected', {
        event: MESSAGING_LOG_EVENTS.channelDisconnected,
        channel,
        closeCode: closeEvent.code,
      }),
    );
    this.client.on(Events.ShardResume, () =>
      this.logger.log('Discord reconnected', {
        event: MESSAGING_LOG_EVENTS.channelConnected,
        channel,
      }),
    );
    this.client.on(Events.Error, (error) =>
      this.logger.error('Discord client error', error, {
        event: MESSAGING_LOG_EVENTS.channelError,
        channel,
      }),
    );
  }

  private async fetchDirectMessage(
    userId: string,
    messageId: string,
  ): Promise<Message> {
    const user = await this.client.users.fetch(userId);
    const dm = await user.createDM();
    return dm.messages.fetch(messageId);
  }
}

function toDirectMessage(message: Message): DiscordDirectMessage {
  return {
    messageId: message.id,
    authorId: message.author.id,
    content: message.content,
    attachments: message.attachments.map((attachment) => ({
      url: attachment.url,
      contentType: attachment.contentType,
      name: attachment.name,
    })),
  };
}

function toButtonRow(buttons: DiscordButton[]) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    buttons.map((button) =>
      new ButtonBuilder()
        .setCustomId(button.id)
        .setLabel(button.label)
        .setStyle(BUTTON_STYLES[button.style]),
    ),
  );
}
