import { Injectable, Logger } from '@nestjs/common';
import { CompanyRepository } from '../../companies/index.js';
import {
  PennylaneApiError,
  PennylaneSuppliersService,
} from '../../pennylane/index.js';
import {
  type Extraction,
  type KnownSupplier,
  ReceiptReaderService,
} from '../../receipts/index.js';
import type { Ticket } from '../models/ticket.js';
import { TicketRepository } from '../repositories/ticket.repository.js';
import { TicketNotifierService } from './ticket-notifier.service.js';
import { TicketReactionService } from './ticket-reaction.service.js';
import { TICKET_LOG_EVENTS } from '../ticket-log-events.js';

/** Failure reasons kept on the ticket: fixed, no data. */
const NOT_CONNECTED = 'Pennylane is not connected for this company';
const SUPPLIERS_UNAVAILABLE = 'Could not load the Pennylane suppliers';

/**
 * Reads the data of a RECEIVED ticket, attached to one of the company's
 * Pennylane suppliers, then asks the user to validate it (supplier
 * included). On failure, the ticket is marked FAILED and the user sees it
 * through the reaction.
 */
@Injectable()
export class ExtractTicketService {
  private readonly logger = new Logger(ExtractTicketService.name);

  constructor(
    private readonly ticketRepository: TicketRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly pennylaneSuppliersService: PennylaneSuppliersService,
    private readonly receiptReaderService: ReceiptReaderService,
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

    const knownSuppliers = await this.loadKnownSuppliers(ticket);
    if (!knownSuppliers) return null;

    const startedAt = Date.now();
    try {
      const extraction = await this.receiptReaderService.read(
        file,
        knownSuppliers,
      );
      this.logger.log('Extraction succeeded', {
        event: TICKET_LOG_EVENTS.extractionSucceeded,
        durationMs: Date.now() - startedAt,
        knownSuppliers: knownSuppliers.length,
        supplierMatched: extraction.supplier.known !== null,
      });
      this.logger.debug('Extraction content', {
        event: TICKET_LOG_EVENTS.extractionContent,
        supplierName: extraction.supplier.name,
        matchedSupplierId: extraction.supplier.known?.id,
        issuedOn: extraction.issuedOn,
        totalCents: extraction.totalCents,
        vatCents: extraction.vatCents,
        vatRateBasisPoints: extraction.vatRateBasisPoints,
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

  /**
   * The company's suppliers, to attach the receipt to one of them before the
   * recap. Without them a known supplier would be created twice: the ticket
   * fails instead (the user sends it again).
   */
  private async loadKnownSuppliers(
    ticket: Ticket,
  ): Promise<KnownSupplier[] | null> {
    try {
      const token = await this.companyRepository.findPennylaneToken(
        ticket.companyId,
      );
      if (!token) {
        this.logger.warn('Pennylane not connected', {
          event: TICKET_LOG_EVENTS.suppliersUnavailable,
          reason: NOT_CONNECTED,
        });
        ticket.fail(NOT_CONNECTED);
        return null;
      }
      const suppliers = await this.pennylaneSuppliersService.list(token);
      return suppliers.map((supplier) => ({
        id: String(supplier.id),
        name: supplier.name,
        vatNumber: supplier.vatNumber,
        registrationNumber: supplier.regNo,
      }));
    } catch (error) {
      if (error instanceof PennylaneApiError) {
        // Pennylane down or the token refused: expected, the ticket fails
        this.logger.warn('Pennylane suppliers unavailable', {
          event: TICKET_LOG_EVENTS.suppliersUnavailable,
          ...error.toLogFields(),
        });
        ticket.fail(error.message);
      } else {
        // e.g. a token that cannot be decrypted: someone must look
        this.logger.error('Pennylane suppliers could not be loaded', error, {
          event: TICKET_LOG_EVENTS.suppliersUnavailable,
        });
        ticket.fail(SUPPLIERS_UNAVAILABLE);
      }
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
