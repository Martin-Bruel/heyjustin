import type { ButtonClick } from '../../messaging/index.js';
import type { User, UserMessagesService } from '../../users/index.js';
import type { ValidationAnswerService } from '../services/validation-answer.service.js';
import { TicketClickHandler } from './ticket-click.handler.js';

const alice: User = {
  id: 'u1',
  companyId: 'c1',
  channel: 'DISCORD',
  externalId: 'alice',
};

function setup() {
  const answers: unknown[][] = [];
  const handler = new TicketClickHandler(
    { onUserClick: () => {} } as unknown as UserMessagesService,
    {
      answer: async (...args: unknown[]) => {
        answers.push(args);
      },
    } as unknown as ValidationAnswerService,
  );
  return { handler, answers };
}

const click = (buttonId: string): ButtonClick => ({
  channel: 'DISCORD',
  senderId: 'alice',
  messageId: 'recap-1',
  buttonId,
});

describe('TicketClickHandler', () => {
  it('turns a recap button into an answer on its ticket', async () => {
    const { handler, answers } = setup();

    await handler.handle(click('ticket:validate:t1'), alice);
    await handler.handle(click('ticket:cancel:t2'), alice);

    expect(answers).toEqual([
      [alice, 'validate', 't1', 'recap-1'],
      [alice, 'cancel', 't2', 'recap-1'],
    ]);
  });

  it('ignores other buttons', async () => {
    const { handler, answers } = setup();

    await handler.handle(click('other:validate:t1'), alice);

    expect(answers).toEqual([]);
  });
});
