import { Injectable, Logger } from '@nestjs/common';
import type { Ticket } from '../models/ticket.js';
import { TicketRepository } from '../repositories/ticket.repository.js';
import { TicketNotifierService } from './ticket-notifier.service.js';
import { TICKET_LOG_EVENTS } from '../ticket-log-events.js';

/**
 * Brings the reaction shown on the channel in line with the ticket status.
 *
 * Call it after a transition has been saved. If the channel fails, the ticket
 * stays saved with its outdated reaction, so a retry (or a job scanning
 * outdated tickets) can run this again safely: it does nothing when the
 * reaction is already right.
 */
@Injectable()
export class TicketReactionService {
  private readonly logger = new Logger(TicketReactionService.name);

  constructor(
    private readonly ticketRepository: TicketRepository,
    private readonly ticketNotifierService: TicketNotifierService,
  ) {}

  async syncReaction(ticket: Ticket): Promise<void> {
    if (!ticket.isReactionOutdated) return;

    const reaction = ticket.expectedReaction;
    await this.ticketNotifierService.showReaction(ticket, reaction);

    ticket.markReactionAsDisplayed(reaction);
    await this.ticketRepository.save(ticket);
    this.logger.debug('Reaction updated', {
      event: TICKET_LOG_EVENTS.reactionUpdated,
      reaction,
    });
  }
}
