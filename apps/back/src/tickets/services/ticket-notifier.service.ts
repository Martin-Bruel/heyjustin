import { Injectable, Logger } from '@nestjs/common';
import { MessagingGateway } from '../../messaging/index.js';
import { type User, UserRepository } from '../../users/index.js';
import { TicketRecipientUnavailableError } from '../errors/ticket-recipient-unavailable.error.js';
import type { Extraction } from '../../receipts/index.js';
import type { Reaction } from '../models/reaction.js';
import type { SourceMessage } from '../models/source-message.js';
import type { Ticket } from '../models/ticket.js';
import {
  EMOJI_BY_REACTION,
  formatOneReceiptPerMessage,
  formatValidationRecap,
  validationButtons,
} from './ticket-messages.js';
import { TICKET_LOG_EVENTS } from '../ticket-log-events.js';

/**
 * Tells the user about their ticket, on the channel the ticket came from.
 * Calls MessagingGateway directly (an internal module with a generic API):
 * this service only turns ticket concepts into messages.
 */
@Injectable()
export class TicketNotifierService {
  private readonly logger = new Logger(TicketNotifierService.name);

  constructor(
    private readonly messagingGateway: MessagingGateway,
    private readonly userRepository: UserRepository,
  ) {}

  /** Puts `reaction` on the user's original message. `null` removes ours. */
  async showReaction(ticket: Ticket, reaction: Reaction | null): Promise<void> {
    await this.messagingGateway.react({
      channel: ticket.source.channel,
      recipientId: await this.recipientOf(ticket),
      messageId: ticket.source.messageId,
      emoji: reaction ? EMOJI_BY_REACTION[reaction] : null,
    });
  }

  /** Sends the recap as a reply to the user's message, with validate/cancel buttons. */
  async requestValidation(
    ticket: Ticket,
    extraction: Extraction,
  ): Promise<void> {
    await this.messagingGateway.send({
      channel: ticket.source.channel,
      recipientId: await this.recipientOf(ticket),
      text: formatValidationRecap(extraction),
      replyToMessageId: ticket.source.messageId,
      buttons: validationButtons(ticket.id),
    });
    this.logger.log('Validation requested', {
      event: TICKET_LOG_EVENTS.validationRequested,
    });
  }

  /** Asks the user to resend the receipts of their message one per message. */
  async askOneReceiptPerMessage(
    source: SourceMessage,
    sender: User,
    receiptCount: number,
  ): Promise<void> {
    await this.messagingGateway.send({
      channel: source.channel,
      recipientId: sender.externalId,
      text: formatOneReceiptPerMessage(receiptCount),
      replyToMessageId: source.messageId,
    });
  }

  private async recipientOf(ticket: Ticket): Promise<string> {
    const user = await this.userRepository.findById(ticket.userId);
    if (!user) {
      throw new TicketRecipientUnavailableError(ticket.id, 'user not found');
    }
    // a user has one channel: if it changed, the original message is out of reach
    if (user.channel !== ticket.source.channel) {
      throw new TicketRecipientUnavailableError(
        ticket.id,
        `user moved from ${ticket.source.channel} to ${user.channel}`,
      );
    }
    return user.externalId;
  }
}
