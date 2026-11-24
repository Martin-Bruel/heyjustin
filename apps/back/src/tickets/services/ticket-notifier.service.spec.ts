import { SourceMessage } from '../models/source-message.js';
import type { MessagingGateway } from '../../messaging/index.js';
import type { User, UserRepository } from '../../users/index.js';
import { TicketRecipientUnavailableError } from '../errors/ticket-recipient-unavailable.error.js';
import { Ticket } from '../models/ticket.js';
import { TicketNotifierService } from './ticket-notifier.service.js';

const ticket = Ticket.create({
  id: 't1',
  companyId: 'c1',
  userId: 'u1',
  source: new SourceMessage('DISCORD', 'm1'),
});

function notifierFor(user: User | null) {
  const reactions: unknown[] = [];
  const messaging = {
    react: async (update: unknown) => {
      reactions.push(update);
    },
  } as unknown as MessagingGateway;
  const users = { findById: async () => user } as unknown as UserRepository;
  return { notifier: new TicketNotifierService(messaging, users), reactions };
}

describe('TicketNotifierService', () => {
  it("reacts on the original message, addressed to the user's identity", async () => {
    const { notifier, reactions } = notifierFor({
      id: 'u1',
      companyId: 'c1',
      channel: 'DISCORD',
      externalId: 'discord-alice',
    });

    await notifier.showReaction(ticket, 'MATCHED');

    expect(reactions).toEqual([
      {
        channel: 'DISCORD',
        recipientId: 'discord-alice',
        messageId: 'm1',
        emoji: '✅',
      },
    ]);
  });

  it('refuses when the user moved to another channel', async () => {
    const { notifier, reactions } = notifierFor({
      id: 'u1',
      companyId: 'c1',
      channel: 'WHATSAPP',
      externalId: '33612345678',
    });

    await expect(notifier.showReaction(ticket, 'MATCHED')).rejects.toThrow(
      TicketRecipientUnavailableError,
    );
    expect(reactions).toEqual([]);
  });

  it('refuses when the user no longer exists', async () => {
    const { notifier } = notifierFor(null);

    await expect(notifier.showReaction(ticket, 'MATCHED')).rejects.toThrow(
      /user not found/,
    );
  });
});
