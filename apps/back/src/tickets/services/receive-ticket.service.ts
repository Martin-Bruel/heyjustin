import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { assignLogContext } from '../../logging/index.js';
import type { User } from '../../users/index.js';
import type { SourceMessage } from '../models/source-message.js';
import { Ticket } from '../models/ticket.js';
import type { TicketFile } from '../models/ticket-file.js';
import { TicketRepository } from '../repositories/ticket.repository.js';
import { TicketReactionService } from './ticket-reaction.service.js';
import { ExtractTicketService } from './extract-ticket.service.js';
import { TICKET_LOG_EVENTS } from '../ticket-log-events.js';

/** A receipt received on a messaging channel, already downloaded by the handler. */
export type IncomingDocument = {
  source: SourceMessage;
  caption: string | null;
  file: TicketFile;
};

/**
 * Entry point of the ticket flow: turns a received document into a ticket,
 * then runs the extraction.
 *
 * The sender is already identified (unknown senders never reach tickets).
 * Runs the whole flow (including the AI call) before returning: callers must
 * not make the channel wait for it (e.g. acknowledge a webhook first).
 */
@Injectable()
export class ReceiveTicketService {
  private readonly logger = new Logger(ReceiveTicketService.name);

  constructor(
    private readonly ticketRepository: TicketRepository,
    private readonly ticketReactionService: TicketReactionService,
    private readonly extractTicketService: ExtractTicketService,
  ) {}

  /** Returns the new ticket, or `null` when the message was already received. */
  async receive(
    owner: User,
    document: IncomingDocument,
  ): Promise<Ticket | null> {
    const existing = await this.ticketRepository.findBySource(document.source);
    if (existing) {
      // same message delivered again by the channel
      this.logger.log('Message already received, ignored', {
        event: TICKET_LOG_EVENTS.duplicateDelivery,
        ticketId: existing.id,
      });
      return null;
    }

    const ticket = Ticket.create({
      id: randomUUID(),
      companyId: owner.companyId,
      userId: owner.id,
      source: document.source,
      caption: document.caption,
    });
    await this.ticketRepository.add(ticket, document.file);
    assignLogContext({ ticketId: ticket.id });
    this.logger.log('Ticket created', {
      event: TICKET_LOG_EVENTS.created,
      status: ticket.status,
      mimeType: document.file.mimeType,
      sizeBytes: document.file.data.length,
    });

    await this.ticketReactionService.syncReaction(ticket); // 🕓 right away
    await this.extractTicketService.extract(ticket);

    return ticket;
  }
}
