import { Injectable } from '@nestjs/common';
import {
  ChannelStrategy,
  type ClickHandler,
  type MessageHandler,
} from '../channel-strategy.js';
import type {
  IncomingAttachment,
  IncomingMessage,
  MessageEdit,
  OutgoingMessage,
  ProcessingTarget,
  ReactionUpdate,
} from '../message.types.js';
import { DiscordClient, type DiscordDirectMessage } from './discord.client.js';

/** Discord channel: users talk to the bot in direct messages. */
@Injectable()
export class DiscordStrategy extends ChannelStrategy {
  readonly channel = 'DISCORD';

  constructor(private readonly discordClient: DiscordClient) {
    super();
  }

  listen(handler: MessageHandler): void {
    this.discordClient.onDirectMessage((message) =>
      handler(toIncomingMessage(message)),
    );
  }

  listenToClicks(handler: ClickHandler): void {
    this.discordClient.onButtonClick((click) =>
      handler({
        channel: 'DISCORD',
        senderId: click.userId,
        messageId: click.messageId,
        buttonId: click.customId,
      }),
    );
  }

  async edit({
    recipientId,
    messageId,
    text,
    buttons,
  }: Omit<MessageEdit, 'channel'>): Promise<void> {
    await this.discordClient.editDirectMessage({
      userId: recipientId,
      messageId,
      content: text,
      buttons,
    });
  }

  async showProcessing(
    { recipientId }: Omit<ProcessingTarget, 'channel'>,
    signal: AbortSignal,
  ): Promise<void> {
    await this.discordClient.keepTyping(recipientId, signal);
  }

  async send({
    recipientId,
    text,
    replyToMessageId,
    buttons,
  }: Omit<OutgoingMessage, 'channel'>): Promise<void> {
    await this.discordClient.sendDirectMessage({
      userId: recipientId,
      content: text,
      replyToMessageId,
      buttons,
    });
  }

  async react({
    recipientId,
    messageId,
    emoji,
  }: Omit<ReactionUpdate, 'channel'>): Promise<void> {
    await this.discordClient.setOwnReaction(recipientId, messageId, emoji);
  }

  download(attachment: IncomingAttachment): Promise<Buffer> {
    return this.discordClient.download(attachment.ref);
  }
}

function toIncomingMessage(message: DiscordDirectMessage): IncomingMessage {
  return {
    channel: 'DISCORD',
    senderId: message.authorId,
    messageId: message.messageId,
    text: message.content || null,
    attachments: message.attachments.map((attachment) => ({
      ref: attachment.url,
      contentType: attachment.contentType,
      filename: attachment.name,
    })),
  };
}
