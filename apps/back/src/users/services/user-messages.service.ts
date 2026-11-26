import { Injectable, Logger } from '@nestjs/common';
import { assignLogContext, IdentifierHasher } from '../../logging/index.js';
import {
  type ButtonClick,
  type Channel,
  type IncomingMessage,
  MessagingGateway,
} from '../../messaging/index.js';
import type { User } from '../models/user.js';
import { UserRepository } from '../repositories/user.repository.js';
import { USER_LOG_EVENTS } from '../user-log-events.js';

export type UserMessageHandler = (
  message: IncomingMessage,
  sender: User,
) => Promise<void>;

export type UserClickHandler = (
  click: ButtonClick,
  sender: User,
) => Promise<void>;

/**
 * Messages from registered users, with their sender already identified.
 * The single place where unknown senders are dropped: business modules
 * subscribe here instead of MessagingGateway.onMessage().
 *
 * Messaging stays a plain transport (it does not know users), so a future
 * module answering unknown senders (e.g. onboarding) can still subscribe to
 * the gateway directly.
 */
@Injectable()
export class UserMessagesService {
  private readonly logger = new Logger(UserMessagesService.name);

  constructor(
    private readonly messagingGateway: MessagingGateway,
    private readonly userRepository: UserRepository,
    private readonly identifierHasher: IdentifierHasher,
  ) {}

  onUserMessage(handler: UserMessageHandler): void {
    this.messagingGateway.onMessage(async (message) => {
      const sender = await this.identify(message.channel, message.senderId);
      if (sender) await handler(message, sender);
    });
  }

  /** Clicks on our buttons, by registered users only. */
  onUserClick(handler: UserClickHandler): void {
    this.messagingGateway.onButtonClick(async (click) => {
      const sender = await this.identify(click.channel, click.senderId);
      if (sender) await handler(click, sender);
    });
  }

  private async identify(
    channel: Channel,
    senderId: string,
  ): Promise<User | null> {
    const sender = await this.userRepository.findByIdentity(channel, senderId);
    if (!sender) {
      // ignored; logged as a pseudonym to spot an insisting stranger without storing who it is
      this.logger.log('Message from an unknown sender ignored', {
        event: USER_LOG_EVENTS.unknownSender,
        senderHash: this.identifierHasher.hash(senderId),
      });
      return null;
    }
    assignLogContext({ userId: sender.id, companyId: sender.companyId });
    return sender;
  }
}
