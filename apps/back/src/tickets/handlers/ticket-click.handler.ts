import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { ButtonClick } from '../../messaging/index.js';
import { type User, UserMessagesService } from '../../users/index.js';
import { parseValidationButtonId } from '../services/ticket-messages.js';
import { ValidationAnswerService } from '../services/validation-answer.service.js';
import { TICKET_LOG_EVENTS } from '../ticket-log-events.js';

/**
 * Entry point of tickets for clicks on recap buttons, the same for every
 * channel. Only registered users get here (UserMessagesService); the click
 * is already acknowledged to the app by messaging.
 */
@Injectable()
export class TicketClickHandler implements OnModuleInit {
  private readonly logger = new Logger(TicketClickHandler.name);

  constructor(
    private readonly userMessagesService: UserMessagesService,
    private readonly validationAnswerService: ValidationAnswerService,
  ) {}

  onModuleInit() {
    this.userMessagesService.onUserClick((click, sender) =>
      this.handle(click, sender),
    );
  }

  async handle(click: ButtonClick, sender: User): Promise<void> {
    const button = parseValidationButtonId(click.buttonId);
    if (!button) {
      this.logger.debug('Click on another button ignored', {
        event: TICKET_LOG_EVENTS.clickIgnored,
        reason: 'not_a_recap_button',
      });
      return;
    }
    await this.validationAnswerService.answer(
      sender,
      button.answer,
      button.ticketId,
      click.messageId,
    );
  }
}
