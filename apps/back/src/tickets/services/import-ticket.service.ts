import { Injectable, Logger } from '@nestjs/common';
import { CompanyRepository } from '../../companies/index.js';
import {
  frenchVatRate,
  PennylaneApiError,
  PennylaneInvoicesService,
  PennylaneSuppliersService,
} from '../../pennylane/index.js';
import type { Extraction } from '../../receipts/index.js';
import { PennylaneInfo } from '../models/pennylane-info.js';
import type { Ticket } from '../models/ticket.js';
import { TicketRepository } from '../repositories/ticket.repository.js';
import { TICKET_LOG_EVENTS } from '../ticket-log-events.js';
import { TicketReactionService } from './ticket-reaction.service.js';

/** Failure reasons kept on the ticket: fixed, no data. */
const NOT_CONNECTED = 'Pennylane is not connected for this company';
const FILE_NOT_FOUND = 'File not found';
const IMPORT_FAILED = 'Could not import into Pennylane';

/**
 * Imports a validated (IMPORTING) ticket into Pennylane: its supplier
 * (created when new), its file, then the supplier invoice. Ends
 * PENDING_MATCH, or FAILED with the reason.
 *
 * Safe to run again on the same ticket: the supplier id is saved as soon as
 * it exists, and the invoice carries the ticket id as `external_reference`,
 * which Pennylane refuses twice; the invoice of a previous attempt is then
 * found and reused. Only the file may be uploaded twice (unattached, harmless).
 */
@Injectable()
export class ImportTicketService {
  private readonly logger = new Logger(ImportTicketService.name);

  constructor(
    private readonly ticketRepository: TicketRepository,
    private readonly companyRepository: CompanyRepository,
    private readonly pennylaneSuppliersService: PennylaneSuppliersService,
    private readonly pennylaneInvoicesService: PennylaneInvoicesService,
    private readonly ticketReactionService: TicketReactionService,
  ) {}

  async import(ticket: Ticket): Promise<void> {
    const from = ticket.status;
    await this.runImport(ticket);
    await this.ticketRepository.save(ticket);
    this.logger.log('Ticket status changed', {
      event: TICKET_LOG_EVENTS.statusChanged,
      from,
      to: ticket.status,
    });
    await this.ticketReactionService.syncReaction(ticket);
  }

  /** Records the import on the ticket, or marks it FAILED. */
  private async runImport(ticket: Ticket): Promise<void> {
    const state = ticket.state;
    if (state.status !== 'IMPORTING') {
      throw new Error(`Ticket ${ticket.id} is ${state.status}, not IMPORTING`);
    }
    const startedAt = Date.now();
    try {
      const token = await this.companyRepository.findPennylaneToken(
        ticket.companyId,
      );
      if (!token) return this.failImport(ticket, NOT_CONNECTED);
      const file = await this.ticketRepository.findFile(ticket.id);
      if (!file) return this.failImport(ticket, FILE_NOT_FOUND);

      const supplierCreated =
        state.supplierId === null && state.extraction.supplier.known === null;
      const supplierId =
        state.supplierId ??
        (await this.recordSupplier(token, ticket, state.extraction));
      const fileAttachmentId = await this.pennylaneInvoicesService.uploadFile(
        token,
        file,
      );
      const vatRate = frenchVatRate(state.extraction.vatRateBasisPoints);
      const invoiceId = await this.importInvoice(token, ticket, {
        supplierId,
        fileAttachmentId,
        extraction: state.extraction,
        vatRate,
      });

      ticket.recordPennylaneImport(
        new PennylaneInfo(supplierId, String(invoiceId)),
      );
      this.logger.log('Ticket imported into Pennylane', {
        event: TICKET_LOG_EVENTS.importSucceeded,
        durationMs: Date.now() - startedAt,
        supplierCreated,
        // a rate Pennylane does not know: the accountant completes it
        incomplete: vatRate === null,
      });
    } catch (error) {
      if (error instanceof PennylaneApiError) {
        // Pennylane down, the token refused, a file type it does not take
        this.logger.warn('Pennylane import failed', {
          event: TICKET_LOG_EVENTS.importFailed,
          durationMs: Date.now() - startedAt,
          ...error.toLogFields(),
        });
        ticket.fail(error.message);
      } else {
        this.logger.error('Pennylane import failed', error, {
          event: TICKET_LOG_EVENTS.importFailed,
          durationMs: Date.now() - startedAt,
        });
        ticket.fail(IMPORT_FAILED);
      }
    }
  }

  /**
   * The matched supplier, or a new one with the identifiers read on the
   * receipt. Saved at once: a retry must not create it again.
   */
  private async recordSupplier(
    token: string,
    ticket: Ticket,
    extraction: Extraction,
  ): Promise<string> {
    const { supplier } = extraction;
    const supplierId =
      supplier.known?.id ??
      String(
        (
          await this.pennylaneSuppliersService.create(token, {
            name: supplier.name,
            vatNumber: supplier.vatNumber,
            regNo: supplier.registrationNumber,
          })
        ).id,
      );
    ticket.recordImportSupplier(supplierId);
    await this.ticketRepository.save(ticket);
    return supplierId;
  }

  /** The new invoice id, or the one a previous attempt created. */
  private async importInvoice(
    token: string,
    ticket: Ticket,
    params: {
      supplierId: string;
      fileAttachmentId: number;
      extraction: Extraction;
      vatRate: ReturnType<typeof frenchVatRate>;
    },
  ): Promise<number> {
    const { extraction, vatRate } = params;
    try {
      return await this.pennylaneInvoicesService.importSupplierInvoice(token, {
        fileAttachmentId: params.fileAttachmentId,
        supplierId: Number(params.supplierId),
        issuedOn: extraction.issuedOn,
        totalCents: extraction.totalCents,
        vatCents: extraction.vatCents,
        currency: extraction.currency,
        vatRate: vatRate ?? 'mixed',
        incomplete: vatRate === null,
        externalReference: ticket.id,
      });
    } catch (error) {
      if (error instanceof PennylaneApiError && error.failure === 'rejected') {
        const existing =
          await this.pennylaneInvoicesService.findByExternalReference(
            token,
            ticket.id,
          );
        if (existing !== null) {
          this.logger.log('Invoice already in Pennylane, reused', {
            event: TICKET_LOG_EVENTS.importRecovered,
          });
          return existing;
        }
      }
      throw error;
    }
  }

  private failImport(ticket: Ticket, reason: string): void {
    this.logger.warn('Pennylane import failed', {
      event: TICKET_LOG_EVENTS.importFailed,
      reason,
    });
    ticket.fail(reason);
  }
}
