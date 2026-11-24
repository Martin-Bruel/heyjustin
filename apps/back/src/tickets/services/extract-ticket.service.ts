import { Injectable, Logger } from '@nestjs/common';
import type { Extraction } from '../models/extraction.js';
import type { Ticket } from '../models/ticket.js';
import { TicketRepository } from '../repositories/ticket.repository.js';
import { InvoiceExtractorService } from './invoice-extractor.service.js';
import { TicketNotifierService } from './ticket-notifier.service.js';
import { TicketReactionService } from './ticket-reaction.service.js';
import { TICKET_LOG_EVENTS } from '../ticket-log-events.js';

/**
 * Reads the data of a RECEIVED ticket, then asks the user to validate it.
 * On extraction failure, the ticket is marked FAILED and the user sees it
 * through the reaction.
 */
@Injectable()
export class ExtractTicketService {
  private readonly logger = new Logger(ExtractTicketService.name);

  constructor(
    private readonly ticketRepository: TicketRepository,
    private readonly invoiceExtractorService: InvoiceExtractorService,
    private readonly ticketNotifierService: TicketNotifierService,
    private readonly ticketReactionService: TicketReactionService,
  ) {}

  async extract(ticket: Ticket): Promise<void> {
    const from = ticket.status;
    const extraction = await this.runExtraction(ticket);

    if (extraction) {
      ticket.recordExtraction(extraction);
      await this.ticketRepository.save(ticket);
      this.logStatusChange(from, ticket);
      await this.ticketNotifierService.requestValidation(ticket, extraction);
    } else {
      await this.ticketRepository.save(ticket);
      this.logStatusChange(from, ticket);
    }

    await this.ticketReactionService.syncReaction(ticket);
  }

  /** Returns the extraction, or marks the ticket FAILED and returns null. */
  private async runExtraction(ticket: Ticket): Promise<Extraction | null> {
    const file = await this.ticketRepository.findFile(ticket.id);
    if (!file) {
      ticket.fail('File not found');
      return null;
    }

    const startedAt = Date.now();
    try {
      const extraction = await this.invoiceExtractorService.extract(file);
      this.logger.log('Extraction succeeded', {
        event: TICKET_LOG_EVENTS.extractionSucceeded,
        durationMs: Date.now() - startedAt,
      });
      this.logger.debug('Extraction content', {
        event: TICKET_LOG_EVENTS.extractionContent,
        supplierName: extraction.supplierName,
        issuedOn: extraction.issuedOn,
        totalCents: extraction.totalCents,
        vatCents: extraction.vatCents,
        currency: extraction.currency,
      });
      return extraction;
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      // an expected business outcome (the ticket becomes FAILED), not an incident
      this.logger.warn('Extraction failed', {
        event: TICKET_LOG_EVENTS.extractionFailed,
        durationMs: Date.now() - startedAt,
        reason,
      });
      ticket.fail(reason);
      return null;
    }
  }

  private logStatusChange(from: Ticket['status'], ticket: Ticket): void {
    this.logger.log('Ticket status changed', {
      event: TICKET_LOG_EVENTS.statusChanged,
      from,
      to: ticket.status,
    });
  }
}
