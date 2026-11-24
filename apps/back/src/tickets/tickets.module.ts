import { Module } from '@nestjs/common';
import { MessagingModule } from '../messaging/index.js';
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
 * Dependencies only go outward: tickets imports users, messaging, receipts and Prisma;
 * none of them may import TicketsModule back. Every dependency is used
 * directly (no port/adapter): Prisma abstracts the database, messaging the
 * chat apps, receipts the reading of a receipt (through ai).
 */
@Module({
  imports: [PrismaModule, UsersModule, MessagingModule, ReceiptsModule],
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
