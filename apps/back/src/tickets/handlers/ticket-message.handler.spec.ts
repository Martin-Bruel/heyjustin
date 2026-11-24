import type {
  IncomingMessage,
  MessagingGateway,
} from '../../messaging/index.js';
import type { User, UserMessagesService } from '../../users/index.js';
import type { SourceMessage } from '../models/source-message.js';
import type {
  IncomingDocument,
  ReceiveTicketService,
} from '../services/receive-ticket.service.js';
import type { TicketNotifierService } from '../services/ticket-notifier.service.js';
import { TicketMessageHandler } from './ticket-message.handler.js';

const alice: User = {
  id: 'u1',
  companyId: 'c1',
  channel: 'DISCORD',
  externalId: 'alice',
};

function setup() {
  const downloads: string[] = [];
  const received: { owner: User; document: IncomingDocument }[] = [];
  const requests: {
    source: SourceMessage;
    sender: User;
    receiptCount: number;
  }[] = [];

  const userMessages = {
    onUserMessage: () => {},
  } as unknown as UserMessagesService;

  const messaging = {
    download: async (_channel: string, attachment: { ref: string }) => {
      downloads.push(attachment.ref);
      return Buffer.from('file');
    },
  } as unknown as MessagingGateway;

  const receiveTicket = {
    receive: async (owner: User, document: IncomingDocument) => {
      received.push({ owner, document });
      return null;
    },
  } as unknown as ReceiveTicketService;

  const notifier = {
    askOneReceiptPerMessage: async (
      source: SourceMessage,
      sender: User,
      receiptCount: number,
    ) => {
      requests.push({ source, sender, receiptCount });
    },
  } as unknown as TicketNotifierService;

  return {
    handler: new TicketMessageHandler(
      userMessages,
      messaging,
      receiveTicket,
      notifier,
    ),
    downloads,
    received,
    requests,
  };
}

const message = (
  attachments: IncomingMessage['attachments'],
): IncomingMessage => ({
  channel: 'DISCORD',
  senderId: 'alice',
  messageId: 'm1',
  text: 'lunch',
  attachments,
});

const pdf = {
  ref: 'receipt',
  contentType: 'application/pdf',
  filename: 'r.pdf',
};
const photo = { ref: 'photo', contentType: 'image/jpeg', filename: null };
const notes = {
  ref: 'notes',
  contentType: 'text/plain',
  filename: 'notes.txt',
};

describe('TicketMessageHandler', () => {
  it("turns the receipt of a message into the sender's incoming document", async () => {
    const { handler, downloads, received, requests } = setup();

    // a non-receipt file next to it does not count
    await handler.handle(message([notes, pdf]), alice);

    expect(downloads).toEqual(['receipt']);
    expect(received).toHaveLength(1);
    expect(received[0].owner).toBe(alice);
    expect(received[0].document).toMatchObject({
      source: { channel: 'DISCORD', messageId: 'm1' },
      caption: 'lunch',
      file: { mimeType: 'application/pdf', filename: 'r.pdf' },
    });
    expect(requests).toEqual([]);
  });

  it('processes none of several receipts and asks for one per message', async () => {
    const { handler, downloads, received, requests } = setup();

    await handler.handle(message([pdf, notes, photo]), alice);

    expect(downloads).toEqual([]);
    expect(received).toEqual([]);
    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      source: { channel: 'DISCORD', messageId: 'm1' },
      sender: alice,
      receiptCount: 2,
    });
  });

  it('ignores messages without a receipt file', async () => {
    const { handler, downloads, received } = setup();

    await handler.handle(message([notes]), alice);

    expect(downloads).toEqual([]);
    expect(received).toEqual([]);
  });
});
