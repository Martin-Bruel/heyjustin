import {
  assignLogContext,
  type MessageFlow,
  currentLogContext,
  runInLogContext,
} from './log-context.js';

const message: MessageFlow = {
  flow: 'message',
  channel: 'DISCORD',
  messageId: 'm1',
};

describe('log context', () => {
  it('is undefined and ignores assignments outside a flow', () => {
    assignLogContext({ ticketId: 't1' });
    expect(currentLogContext()).toBeUndefined();
  });

  it('keeps assigned fields for the rest of the flow, across awaits', async () => {
    await runInLogContext(message, async () => {
      assignLogContext({ ticketId: 't1' });
      await new Promise((resolve) => setTimeout(resolve, 1));
      expect(currentLogContext()).toEqual({ ...message, ticketId: 't1' });
    });
  });

  it('isolates concurrent flows', async () => {
    const seen: unknown[] = [];
    const flow = (ticketId: string, delay: number) =>
      runInLogContext(message, async () => {
        assignLogContext({ ticketId });
        await new Promise((resolve) => setTimeout(resolve, delay));
        seen.push(currentLogContext()?.ticketId);
      });

    await Promise.all([flow('t1', 10), flow('t2', 1)]);

    expect(seen).toEqual(['t2', 't1']);
  });
});
