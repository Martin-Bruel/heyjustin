import {
  ChannelStrategy,
  type OutgoingMessage,
  type ReactionUpdate,
  MessagingGateway,
  type Channel,
} from '../../messaging/index.js';
import type { User, UserRepository } from '../../users/index.js';
import { Extraction } from '../models/extraction.js';
import { SourceMessage } from '../models/source-message.js';
import type { Ticket } from '../models/ticket.js';
import { TicketFile } from '../models/ticket-file.js';
import { InvoiceExtractorService } from './invoice-extractor.service.js';
import type { TicketRepository } from '../repositories/ticket.repository.js';
import { ExtractTicketService } from './extract-ticket.service.js';
import {
  ReceiveTicketService,
  type IncomingDocument,
} from './receive-ticket.service.js';
import { TicketNotifierService } from './ticket-notifier.service.js';
import { TicketReactionService } from './ticket-reaction.service.js';

// --- Fakes: only the edges (database, AI, the messaging app itself) ---

/**
 * In-memory stand-in for TicketRepository. A plain object: the real class has a
 * private Prisma field, so TypeScript does not accept another class in its place.
 */
function inMemoryTickets() {
  const tickets = new Map<string, Ticket>();
  const files = new Map<string, TicketFile>();
  const repository = {
    findById: async (id: string) => tickets.get(id) ?? null,
    findBySource: async (source: SourceMessage) =>
      [...tickets.values()].find((t) => t.source.equals(source)) ?? null,
    add: async (ticket: Ticket, file: TicketFile) => {
      tickets.set(ticket.id, ticket);
      files.set(ticket.id, file);
    },
    save: async (ticket: Ticket) => {
      tickets.set(ticket.id, ticket);
    },
    findFile: async (ticketId: string) => files.get(ticketId) ?? null,
  } satisfies Record<keyof TicketRepository, unknown>;
  return {
    repository: repository as unknown as TicketRepository,
    tickets,
    files,
  };
}

function fakeUsers(users: User[]): UserRepository {
  return {
    findById: async (id: string) => users.find((u) => u.id === id) ?? null,
    findByIdentity: async (channel: Channel, externalId: string) =>
      users.find((u) => u.channel === channel && u.externalId === externalId) ??
      null,
  } as unknown as UserRepository;
}

class FakeExtractor extends InvoiceExtractorService {
  constructor(private readonly result: Extraction | Error) {
    super();
  }
  async extract() {
    if (this.result instanceof Error) throw this.result;
    return this.result;
  }
}

/** A messaging app that records what we send, plugged into the real gateway. */
class RecordingStrategy extends ChannelStrategy {
  readonly channel = 'DISCORD';
  readonly sent: Omit<OutgoingMessage, 'channel'>[] = [];
  readonly reactions: Omit<ReactionUpdate, 'channel'>[] = [];

  listen() {}
  async send(message: Omit<OutgoingMessage, 'channel'>) {
    this.sent.push(message);
  }
  async react(update: Omit<ReactionUpdate, 'channel'>) {
    this.reactions.push(update);
  }
  async download() {
    return Buffer.from('');
  }
}

// --- Setup ---

const extraction = new Extraction(
  'Acme',
  new Date('2026-11-01'),
  1200,
  200,
  'EUR',
);

const alice: User = {
  id: 'u1',
  companyId: 'c1',
  channel: 'DISCORD',
  externalId: 'discord-alice',
};

const document: IncomingDocument = {
  source: new SourceMessage('DISCORD', 'm1'),
  caption: 'lunch',
  file: new TicketFile('image/jpeg', null, Buffer.from('fake')),
};

function setup(extractorResult: Extraction | Error = extraction) {
  const { repository: tickets, ...stored } = inMemoryTickets();
  const users = fakeUsers([alice]);
  const discord = new RecordingStrategy();
  const notifier = new TicketNotifierService(
    new MessagingGateway([discord]),
    users,
  );
  const reactions = new TicketReactionService(tickets, notifier);
  const extract = new ExtractTicketService(
    tickets,
    new FakeExtractor(extractorResult),
    notifier,
    reactions,
  );
  const service = new ReceiveTicketService(tickets, reactions, extract);
  return { service, tickets: stored, discord };
}

// --- Tests ---

describe('ReceiveTicketService', () => {
  it('creates the ticket, reacts, extracts and asks for validation', async () => {
    const { service, tickets, discord } = setup();

    const ticket = await service.receive(alice, document);

    expect(ticket).not.toBeNull();
    expect(ticket!.userId).toBe('u1');
    expect(ticket!.companyId).toBe('c1');
    expect(ticket!.state).toEqual({
      status: 'AWAITING_VALIDATION',
      extraction,
    });
    expect(tickets.files.get(ticket!.id)).toBe(document.file);

    expect(discord.reactions).toEqual([
      { recipientId: 'discord-alice', messageId: 'm1', emoji: '🕓' },
    ]);
    expect(discord.sent).toHaveLength(1);
    expect(discord.sent[0]).toMatchObject({
      recipientId: 'discord-alice',
      replyToMessageId: 'm1',
    });
    expect(discord.sent[0].text).toContain('Acme');
    expect(discord.sent[0].buttons?.map((b) => b.id)).toEqual([
      `ticket:validate:${ticket!.id}`,
      `ticket:cancel:${ticket!.id}`,
    ]);
  });

  it('marks the ticket FAILED when the extraction fails', async () => {
    const { service, discord } = setup(new Error('Unreadable document'));

    const ticket = await service.receive(alice, document);

    expect(ticket!.state).toEqual({
      status: 'FAILED',
      reason: 'Unreadable document',
      extraction: null,
    });
    expect(discord.reactions.map((r) => r.emoji)).toEqual(['🕓', '❌']);
    expect(discord.sent).toEqual([]);
  });

  it('ignores a message delivered twice', async () => {
    const { service, tickets } = setup();

    await service.receive(alice, document);
    const second = await service.receive(alice, document);

    expect(second).toBeNull();
    expect(tickets.tickets.size).toBe(1);
  });
});
