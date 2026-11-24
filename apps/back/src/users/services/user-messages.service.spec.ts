import type {
  MessageHandler,
  IncomingMessage,
  MessagingGateway,
} from '../../messaging/index.js';
import {
  currentLogContext,
  type IdentifierHasher,
  type LogContext,
  runInLogContext,
} from '../../logging/index.js';
import type { User } from '../models/user.js';
import { UserMessagesService } from './user-messages.service.js';
import type { UserRepository } from '../repositories/user.repository.js';

const alice: User = {
  id: 'u1',
  companyId: 'c1',
  channel: 'DISCORD',
  externalId: 'alice',
};

function setup() {
  let gatewayHandler: MessageHandler | null = null;
  const messaging = {
    onMessage: (handler: MessageHandler) => {
      gatewayHandler = handler;
    },
  } as unknown as MessagingGateway;
  const users = {
    findByIdentity: async (channel: string, externalId: string) =>
      channel === alice.channel && externalId === alice.externalId
        ? alice
        : null,
  } as unknown as UserRepository;

  const hashed: string[] = [];
  const hasher = {
    hash: (identifier: string) => {
      hashed.push(identifier);
      return 'hash';
    },
  } as unknown as IdentifierHasher;

  const service = new UserMessagesService(messaging, users, hasher);
  const received: [IncomingMessage, User][] = [];
  const contexts: (LogContext | undefined)[] = [];
  service.onUserMessage(async (message, sender) => {
    received.push([message, sender]);
    contexts.push(currentLogContext());
  });

  /** Simulates a message arriving on the gateway, which opens the log context. */
  const deliver = (senderId: string) =>
    runInLogContext(
      { flow: 'message', channel: 'DISCORD', messageId: 'm1' },
      () =>
        gatewayHandler!({
          channel: 'DISCORD',
          senderId,
          messageId: 'm1',
          text: 'hello',
          attachments: [],
        }),
    );

  return { deliver, received, contexts, hashed };
}

describe('UserMessagesService', () => {
  it('relays messages from registered users with their identified sender', async () => {
    const { deliver, received, contexts } = setup();

    await deliver('alice');

    expect(received).toHaveLength(1);
    expect(received[0][1]).toBe(alice);
    // the rest of the flow logs with the user's ids
    expect(contexts[0]).toEqual({
      flow: 'message',
      channel: 'DISCORD',
      messageId: 'm1',
      userId: 'u1',
      companyId: 'c1',
    });
  });

  it('drops messages from unknown senders, logging only a pseudonym', async () => {
    const { deliver, received, hashed } = setup();

    await deliver('stranger');

    expect(received).toEqual([]);
    expect(hashed).toEqual(['stranger']);
  });
});
