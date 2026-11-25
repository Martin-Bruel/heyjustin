import {
  ChannelStrategy,
  type OutgoingMessage,
  type ReactionUpdate,
  MessagingGateway,
  type Channel,
} from '../../messaging/index.js';
import type { CompanyRepository } from '../../companies/index.js';
import {
  PennylaneApiError,
  type PennylaneSupplier,
  type PennylaneSuppliersService,
} from '../../pennylane/index.js';
import type { User, UserRepository } from '../../users/index.js';
import {
  Extraction,
  type KnownSupplier,
  ReceiptReaderService,
} from '../../receipts/index.js';
import { SourceMessage } from '../models/source-message.js';
import type { Ticket } from '../models/ticket.js';
import { TicketFile } from '../models/ticket-file.js';
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

/** The AI is an edge: faked by its result (its own spec uses a fake model). */
function fakeReceiptReader(result: Extraction | Error) {
  const suppliersSeen: (readonly KnownSupplier[])[] = [];
  const reader = {
    read: async (
      _document: unknown,
      knownSuppliers: readonly KnownSupplier[],
    ) => {
      suppliersSeen.push(knownSuppliers);
      if (result instanceof Error) throw result;
      return result;
    },
  } satisfies Record<keyof ReceiptReaderService, unknown>;
  return { reader: reader as unknown as ReceiptReaderService, suppliersSeen };
}

function fakeCompanies(token: string | null): CompanyRepository {
  const companies = {
    findPennylaneToken: async () => token,
    upsertWithPennylaneToken: async () => {},
  } satisfies Record<keyof CompanyRepository, unknown>;
  return companies as unknown as CompanyRepository;
}

/** Pennylane is an edge: faked by its suppliers (its own spec fakes HTTP). */
function fakePennylaneSuppliers(
  result: PennylaneSupplier[] | Error,
): PennylaneSuppliersService {
  const suppliers = {
    list: async () => {
      if (result instanceof Error) throw result;
      return result;
    },
    create: async () => {
      throw new Error('not expected');
    },
  } satisfies Record<keyof PennylaneSuppliersService, unknown>;
  return suppliers as unknown as PennylaneSuppliersService;
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

const extraction = new Extraction({
  supplier: {
    name: 'Acme',
    vatNumber: null,
    registrationNumber: null,
    known: null,
  },
  issuedOn: new Date('2026-11-01'),
  totalCents: 1200,
  vatCents: 200,
  vatRateBasisPoints: 2000,
  currency: 'EUR',
});

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

const easyJet: PennylaneSupplier = {
  id: 7,
  name: 'easyJet',
  vatNumber: 'GB745360068',
  regNo: null,
};

function setup(
  readerResult: Extraction | Error = extraction,
  pennylane: {
    token?: string | null;
    suppliers?: PennylaneSupplier[] | Error;
  } = {},
) {
  const { repository: tickets, ...stored } = inMemoryTickets();
  const users = fakeUsers([alice]);
  const discord = new RecordingStrategy();
  const notifier = new TicketNotifierService(
    new MessagingGateway([discord]),
    users,
  );
  const reactions = new TicketReactionService(tickets, notifier);
  const { reader, suppliersSeen } = fakeReceiptReader(readerResult);
  const extract = new ExtractTicketService(
    tickets,
    fakeCompanies(
      pennylane.token === undefined ? 'company-token' : pennylane.token,
    ),
    fakePennylaneSuppliers(pennylane.suppliers ?? [easyJet]),
    reader,
    notifier,
    reactions,
  );
  const service = new ReceiveTicketService(tickets, reactions, extract);
  return { service, tickets: stored, discord, suppliersSeen };
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

  it("reads the receipt with the company's Pennylane suppliers", async () => {
    const { service, suppliersSeen } = setup();

    await service.receive(alice, document);

    expect(suppliersSeen).toEqual([
      [
        {
          id: '7',
          name: 'easyJet',
          vatNumber: 'GB745360068',
          registrationNumber: null,
        },
      ],
    ]);
  });

  it('fails without reading when the company has no Pennylane token', async () => {
    const { service, discord, suppliersSeen } = setup(extraction, {
      token: null,
    });

    const ticket = await service.receive(alice, document);

    expect(ticket!.state).toEqual({
      status: 'FAILED',
      reason: 'Pennylane is not connected for this company',
      extraction: null,
    });
    expect(suppliersSeen).toEqual([]);
    expect(discord.reactions.map((r) => r.emoji)).toEqual(['🕓', '❌']);
  });

  it('fails without reading when Pennylane refuses the token', async () => {
    const { service, suppliersSeen } = setup(extraction, {
      suppliers: new PennylaneApiError('unauthorized', {
        method: 'GET',
        path: '/suppliers',
        status: 401,
      }),
    });

    const ticket = await service.receive(alice, document);

    expect(ticket!.state).toMatchObject({
      status: 'FAILED',
      reason: 'Pennylane token invalid or expired',
    });
    expect(suppliersSeen).toEqual([]);
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
