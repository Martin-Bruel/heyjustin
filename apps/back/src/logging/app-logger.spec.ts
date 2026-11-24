import { stripVTControlCharacters } from 'node:util';
import { Logger } from '@nestjs/common';
import { AppLogger } from './app-logger.js';
import {
  assignLogContext,
  type MessageFlow,
  runInLogContext,
} from './log-context.js';
import type { LogFormat } from './app-logger.js';

/** Runs `fn` with AppLogger as the Nest logger and returns what it printed. */
async function captureLogs(
  format: LogFormat,
  fn: () => Promise<void> | void,
): Promise<string> {
  const output: string[] = [];
  const stdout = process.stdout.write;
  const stderr = process.stderr.write;
  const capture = (chunk: unknown) => {
    output.push(String(chunk));
    return true;
  };
  process.stdout.write = capture as typeof process.stdout.write;
  process.stderr.write = capture as typeof process.stderr.write;
  const previousLevel = process.env.NEST_LOG_LEVEL;
  process.env.NEST_LOG_LEVEL = '>=debug';
  Logger.overrideLogger(new AppLogger(format));
  try {
    await fn();
  } finally {
    process.stdout.write = stdout;
    process.stderr.write = stderr;
    process.env.NEST_LOG_LEVEL = previousLevel;
    Logger.overrideLogger(false);
  }
  // strip ANSI colors: Nest colors the console when the terminal supports it
  return stripVTControlCharacters(output.join(''));
}

async function captureJsonLogs(fn: () => Promise<void> | void) {
  const output = await captureLogs('json', fn);
  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

const logger = new Logger('Probe');
const message: MessageFlow = {
  flow: 'message',
  channel: 'DISCORD',
  messageId: 'm1',
};

describe('AppLogger', () => {
  describe('pretty format', () => {
    it("uses Nest's readable format with the fields passed to the log only", async () => {
      const output = await captureLogs('pretty', () =>
        runInLogContext(message, async () => {
          assignLogContext({ ticketId: 't1' });
          logger.log('Ticket created', { event: 'ticket.created' });
        }),
      );

      expect(output).toContain('LOG [Probe] Ticket created');
      expect(output).toContain("event: 'ticket.created'");
      expect(output).not.toContain('t1'); // context fields: JSON only
      expect(output).not.toMatch(/^\{/);
    });

    it('masks personal identifiers too', async () => {
      const output = await captureLogs('pretty', () =>
        logger.log('Oops', { senderId: '33612345678' }),
      );

      expect(output).not.toContain('33612345678');
    });
  });

  describe('json format', () => {
    it('prints one JSON object per log, with params at the root and "info" as level', async () => {
      const [log] = await captureJsonLogs(() =>
        logger.log('Ticket created', {
          event: 'ticket.created',
          sizeBytes: 42,
        }),
      );

      expect(log).toMatchObject({
        level: 'info',
        message: 'Ticket created',
        context: 'Probe',
        event: 'ticket.created',
        sizeBytes: 42,
      });
    });

    it('adds the fields of the current log context, across awaits', async () => {
      const [log] = await captureJsonLogs(() =>
        runInLogContext(message, async () => {
          assignLogContext({ ticketId: 't1' });
          await Promise.resolve();
          logger.log('Extraction succeeded', {
            event: 'ticket.extraction.succeeded',
          });
        }),
      );

      expect(log).toMatchObject({
        flow: 'message',
        channel: 'DISCORD',
        messageId: 'm1',
        ticketId: 't1',
        event: 'ticket.extraction.succeeded',
      });
    });

    it('lets explicit fields win over the context', async () => {
      const [log] = await captureJsonLogs(() =>
        runInLogContext(message, async () => {
          logger.log('Override', { channel: 'WHATSAPP' });
        }),
      );

      expect(log.channel).toBe('WHATSAPP');
    });

    it('masks personal identifiers and file contents, even nested', async () => {
      const [log] = await captureJsonLogs(() =>
        logger.log('Oops', {
          senderId: '33612345678',
          message: { externalId: '33612345678' },
          file: { data: 'binary' },
        }),
      );
      const line = JSON.stringify(log);

      expect(line).not.toContain('33612345678');
      expect(line).not.toContain('binary');
      expect(log.senderId).toBe('[REDACTED]');
    });

    it('serializes errors into a structured field', async () => {
      const [log] = await captureJsonLogs(() =>
        logger.error('Message handler failed', new Error('boom'), {
          event: 'messaging.message.handler_failed',
        }),
      );

      expect(log).toMatchObject({
        level: 'error',
        event: 'messaging.message.handler_failed',
        error: { name: 'Error', message: 'boom' },
      });
    });
  });
});
