/**
 * Fakes of the edges of tickets, shared by its specs (testing.md: fake only
 * what leaves the process). Not built: excluded in tsconfig.build.json.
 */
import type { CompanyRepository } from '../../companies/index.js';
import {
  type Channel,
  ChannelStrategy,
  type ClickHandler,
  type MessageEdit,
  type OutgoingMessage,
  type ProcessingTarget,
  type ReactionUpdate,
} from '../../messaging/index.js';
import type { Ticket as TicketRow } from '../../prisma/index.js';
import type { User, UserRepository } from '../../users/index.js';
import type { SourceMessage } from '../models/source-message.js';
import type { Ticket } from '../models/ticket.js';
import type { TicketFile } from '../models/ticket-file.js';
import { toTicket, toTicketRow } from '../repositories/ticket-row.mapper.js';
import type { TicketRepository } from '../repositories/ticket.repository.js';

/**
 * In-memory TicketRepository. Stores rows, as the database does: each read
 * returns a new Ticket, so two flows on the same ticket (a double click) do
 * not share an object. A plain object: the real class has a private Prisma
 * field, TypeScript does not accept another class in its place.
 */
export function inMemoryTickets() {
  const rows = new Map<string, TicketRow>();
  const files = new Map<string, TicketFile>();
  const rowOf = (ticket: Ticket): TicketRow => ({
    ...toTicketRow(ticket),
    updatedAt: new Date(),
  });
  const repository = {
    findById: async (id: string) => {
      const row = rows.get(id);
      return row ? toTicket(row) : null;
    },
    findBySource: async (source: SourceMessage) => {
      const row = [...rows.values()].find(
        (r) =>
          r.channel === source.channel &&
          r.sourceMessageId === source.messageId,
      );
      return row ? toTicket(row) : null;
    },
    add: async (ticket: Ticket, file: TicketFile) => {
      rows.set(ticket.id, rowOf(ticket));
      files.set(ticket.id, file);
    },
    save: async (ticket: Ticket) => {
      rows.set(ticket.id, rowOf(ticket));
    },
    saveIfStatus: async (ticket: Ticket, expected: Ticket['status']) => {
      if (rows.get(ticket.id)?.status !== expected) return false;
      rows.set(ticket.id, rowOf(ticket));
      return true;
    },
    findFile: async (ticketId: string) => files.get(ticketId) ?? null,
  } satisfies Record<keyof TicketRepository, unknown>;
  return {
    repository: repository as unknown as TicketRepository,
    /** the stored ticket, as a new read would return it */
    stored: (id: string) => {
      const row = rows.get(id);
      return row ? toTicket(row) : null;
    },
    rows,
    files,
  };
}

export function fakeUsers(users: User[]): UserRepository {
  return {
    findById: async (id: string) => users.find((u) => u.id === id) ?? null,
    findByIdentity: async (channel: Channel, externalId: string) =>
      users.find((u) => u.channel === channel && u.externalId === externalId) ??
      null,
  } as unknown as UserRepository;
}

export function fakeCompanies(token: string | null): CompanyRepository {
  const companies = {
    findPennylaneToken: async () => token,
    upsertWithPennylaneToken: async () => {},
  } satisfies Record<keyof CompanyRepository, unknown>;
  return companies as unknown as CompanyRepository;
}

/** A messaging app that records what we send, plugged into the real gateway. */
export class RecordingStrategy extends ChannelStrategy {
  readonly channel = 'DISCORD';
  readonly sent: Omit<OutgoingMessage, 'channel'>[] = [];
  readonly edits: Omit<MessageEdit, 'channel'>[] = [];
  readonly reactions: Omit<ReactionUpdate, 'channel'>[] = [];
  /** processing indicators shown, and whether each was stopped */
  readonly processing: { messageId: string; stopped: () => boolean }[] = [];
  /** makes showProcessing fail, like an app refusing it */
  processingError: Error | null = null;
  clickHandler: ClickHandler | null = null;

  listen() {}
  listenToClicks(handler: ClickHandler) {
    this.clickHandler = handler;
  }
  async send(message: Omit<OutgoingMessage, 'channel'>) {
    this.sent.push(message);
  }
  async edit(edit: Omit<MessageEdit, 'channel'>) {
    this.edits.push(edit);
  }
  async showProcessing(
    target: Omit<ProcessingTarget, 'channel'>,
    signal: AbortSignal,
  ) {
    if (this.processingError) throw this.processingError;
    this.processing.push({
      messageId: target.messageId,
      stopped: () => signal.aborted,
    });
  }
  async react(update: Omit<ReactionUpdate, 'channel'>) {
    this.reactions.push(update);
  }
  async download() {
    return Buffer.from('');
  }
}
