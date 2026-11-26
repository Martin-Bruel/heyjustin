import { Injectable, Logger } from '@nestjs/common';
import { assignLogContext } from '../../logging/index.js';
import type { User } from '../../users/index.js';
import type { Ticket } from '../models/ticket.js';
import { TicketRepository } from '../repositories/ticket.repository.js';
import { TICKET_LOG_EVENTS } from '../ticket-log-events.js';
import { ImportTicketService } from './import-ticket.service.js';
import type { ValidationAnswer } from './ticket-messages.js';
import { TicketNotifierService } from './ticket-notifier.service.js';
import { TicketReactionService } from './ticket-reaction.service.js';

/**
 * The user's answer to a recap: *Cancel* → CANCELLED, *Validate* → IMPORTING
 * then the Pennylane import. The recap is rewritten with the outcome, without
 * its buttons.
 *
 * One answer per ticket: the status change is saved only if the ticket still
 * awaits validation in the database, so a double click (or Validate then
 * Cancel) imports once and the second click is ignored.
 */
@Injectable()
export class ValidationAnswerService {
  private readonly logger = new Logger(ValidationAnswerService.name);

  constructor(
    private readonly ticketRepository: TicketRepository,
    private readonly importTicketService: ImportTicketService,
    private readonly ticketNotifierService: TicketNotifierService,
    private readonly ticketReactionService: TicketReactionService,
  ) {}

  async answer(
    sender: User,
    answer: ValidationAnswer,
    ticketId: string,
    recapMessageId: string,
  ): Promise<void> {
    const ticket = await this.ticketRepository.findById(ticketId);
    if (!ticket || ticket.userId !== sender.id) {
      this.ignore('unknown_ticket');
      return;
    }
    assignLogContext({ ticketId: ticket.id });

    const from = ticket.status;
    if (from !== 'AWAITING_VALIDATION') {
      this.ignore('already_answered', from);
      return;
    }
    if (answer === 'cancel') ticket.cancel();
    else ticket.startImport();
    if (!(await this.ticketRepository.saveIfStatus(ticket, from))) {
      // another click got there first
      this.ignore('already_answered', from);
      return;
    }
    this.logger.log('Ticket status changed', {
      event: TICKET_LOG_EVENTS.statusChanged,
      from,
      to: ticket.status,
    });

    // buttons removed first: the import takes a few seconds
    await this.showAnswer(ticket, recapMessageId);
    if (ticket.status === 'IMPORTING') {
      try {
        await this.importTicketService.import(ticket);
      } finally {
        // even if the reaction failed: the recap must not stay "Importing…"
        await this.showAnswer(ticket, recapMessageId);
      }
    } else {
      await this.ticketReactionService.syncReaction(ticket);
    }
  }

  /**
   * Best-effort: the ticket is saved already, a recap left with its buttons
   * only leads to ignored clicks.
   */
  private async showAnswer(
    ticket: Ticket,
    recapMessageId: string,
  ): Promise<void> {
    try {
      await this.ticketNotifierService.showAnswer(ticket, recapMessageId);
    } catch (error) {
      this.logger.warn('Recap not updated', {
        event: TICKET_LOG_EVENTS.recapUpdateFailed,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private ignore(reason: string, status?: Ticket['status']): void {
    this.logger.log('Recap click ignored', {
      event: TICKET_LOG_EVENTS.clickIgnored,
      reason,
      status,
    });
  }
}
