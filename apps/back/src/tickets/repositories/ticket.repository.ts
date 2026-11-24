import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/index.js';
import type { SourceMessage } from '../models/source-message.js';
import type { Ticket } from '../models/ticket.js';
import { TicketFile } from '../models/ticket-file.js';
import { toTicket, toTicketRow } from './ticket-row.mapper.js';

/**
 * Stores and loads tickets. Takes and returns domain Tickets only: services
 * never see a Prisma type, the mapper converts the flat row to the state union.
 */
@Injectable()
export class TicketRepository {
  constructor(private readonly prismaService: PrismaService) {}

  async findById(id: string): Promise<Ticket | null> {
    const row = await this.prismaService.ticket.findUnique({ where: { id } });
    return row ? toTicket(row) : null;
  }

  /** Used for idempotency: a channel may deliver the same message several times. */
  async findBySource(source: SourceMessage): Promise<Ticket | null> {
    const row = await this.prismaService.ticket.findUnique({
      where: {
        channel_sourceMessageId: {
          channel: source.channel,
          sourceMessageId: source.messageId,
        },
      },
    });
    return row ? toTicket(row) : null;
  }

  /** Stores a new ticket together with its file, atomically. */
  async add(ticket: Ticket, file: TicketFile): Promise<void> {
    // nested create: ticket and file are inserted in a single transaction
    await this.prismaService.ticket.create({
      data: {
        ...toTicketRow(ticket),
        file: {
          create: {
            mimeType: file.mimeType,
            filename: file.filename,
            data: new Uint8Array(file.data),
          },
        },
      },
    });
  }

  /** Updates an existing ticket. */
  async save(ticket: Ticket): Promise<void> {
    const { id, ...data } = toTicketRow(ticket);
    await this.prismaService.ticket.update({ where: { id }, data });
  }

  async findFile(ticketId: string): Promise<TicketFile | null> {
    const row = await this.prismaService.ticketFile.findUnique({
      where: { ticketId },
    });
    if (!row) return null;
    // Prisma returns Bytes as a Uint8Array
    return new TicketFile(row.mimeType, row.filename, Buffer.from(row.data));
  }
}
