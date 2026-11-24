import type { Channel } from './channel.js';

/** A file attached to a received message. Download it with MessagingGateway.download(). */
export type IncomingAttachment = {
  /** Channel-specific handle to download the file (URL on Discord, media id on WhatsApp). */
  ref: string;
  contentType: string | null;
  filename: string | null;
};

/** A message received on any channel, in the same shape for every app. */
export type IncomingMessage = {
  channel: Channel;
  /** The sender on the channel (matches User.externalId). */
  senderId: string;
  messageId: string;
  text: string | null;
  attachments: IncomingAttachment[];
};

export type MessageButton = {
  /** Sent back when the user clicks it. */
  id: string;
  label: string;
  style: 'primary' | 'secondary' | 'success' | 'danger';
};

export type OutgoingMessage = {
  channel: Channel;
  recipientId: string;
  text: string;
  /** Sends the message as a reply to this one, when the channel supports it. */
  replyToMessageId?: string;
  buttons?: MessageButton[];
};

export type ReactionUpdate = {
  channel: Channel;
  recipientId: string;
  messageId: string;
  /** Replaces our previous reaction on the message. `null` only removes it. */
  emoji: string | null;
};
