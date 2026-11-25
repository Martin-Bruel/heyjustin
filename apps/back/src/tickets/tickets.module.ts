import { Module } from '@nestjs/common';
import { CompaniesModule } from '../companies/index.js';
import { MessagingModule } from '../messaging/index.js';
import { PennylaneModule } from '../pennylane/index.js';
import { PrismaModule } from '../prisma/index.js';
import { ReceiptsModule } from '../receipts/index.js';
import { UsersModule } from '../users/index.js';
import { TicketMessageHandler } from './handlers/ticket-message.handler.js';
import { TicketRepository } from './repositories/ticket.repository.js';
import { ExtractTicketService } from './services/extract-ticket.service.js';
import { ReceiveTicketService } from './services/receive-ticket.service.js';
import { TicketNotifierService } from './services/ticket-notifier.service.js';
import { TicketReactionService } from './services/ticket-reaction.service.js';

/**
 * Tickets: from a receipt received on any channel to its validation.
 *
 * Dependencies only go outward: tickets imports users, messaging, receipts,
 * companies, pennylane and Prisma;
 * none of them may import TicketsModule back. Every dependency is used
 * directly (no port/adapter): Prisma abstracts the database, messaging the
 * chat apps, receipts the reading of a receipt (through ai), pennylane the
 * accounting API (with the company's token, from companies).
 */
@Module({
  imports: [
    PrismaModule,
    UsersModule,
    MessagingModule,
    ReceiptsModule,
    CompaniesModule,
    PennylaneModule,
  ],
  providers: [
    // handlers: entry points into tickets (messages from every channel)
    TicketMessageHandler,

    // services
    ReceiveTicketService,
    ExtractTicketService,
    TicketReactionService,
    TicketNotifierService,

    // persistence
    TicketRepository,
  ],
})
export class TicketsModule {}
