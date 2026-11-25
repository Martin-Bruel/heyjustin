import { ConsoleLogger, type LogLevel } from '@nestjs/common';
import { currentLogContext } from './log-context.js';

/** `pretty`: Nest's readable format. `json`: one JSON object per line, for Loki. */
export type LogFormat = 'pretty' | 'json';

/**
 * Fields masked in every log, at any depth, even if a whole object is logged
 * by mistake. String messages are not masked: never put these values in a
 * message text.
 */
export const REDACTED_FIELDS = [
  'externalId', // phone number on WhatsApp
  'senderId',
  'recipientId',
  'phoneNumber',
  'token',
  'authorization',
  'apiKey',
  'apiToken',
  'data', // file contents
];

/**
 * The app logger, on stdout, in one of two formats (JSON in production):
 * - `pretty`: Nest's readable format, with the fields passed to the log only;
 * - `json`: one JSON object per line for Loki/Grafana (read from the container
 *   logs by Grafana Alloy or Promtail), params at the root, the fields of the
 *   current log context added (channel, userId, ticketId…), "info" level.
 *
 * Classes keep using `new Logger(MyClass.name)` and `logger.log(msg, { event })`.
 * Level threshold: the `NEST_LOG_LEVEL` env var (e.g. `>=log`).
 */
export class AppLogger extends ConsoleLogger {
  private readonly json: boolean;

  constructor(format: LogFormat = 'pretty') {
    const json = format === 'json';
    super({ json, flattenParams: json, redact: REDACTED_FIELDS });
    this.json = json;
  }

  protected printMessages(
    messages: unknown[],
    context?: string,
    logLevel?: LogLevel,
    writeStreamType?: 'stdout' | 'stderr',
    errorStack?: unknown,
    params?: Record<string, any>,
  ): void {
    // the context is for machines: keep the readable lines short.
    // Context first: fields passed explicitly win. Redaction runs in super.
    const fields = this.json ? { ...currentLogContext(), ...params } : params;
    super.printMessages(
      messages,
      context,
      logLevel,
      writeStreamType,
      errorStack,
      fields,
    );
  }

  /** Nest calls the info level "log"; Loki and Grafana expect "info". */
  protected getJsonLogObject(
    ...args: Parameters<ConsoleLogger['getJsonLogObject']>
  ): ReturnType<ConsoleLogger['getJsonLogObject']> {
    const object = super.getJsonLogObject(...args);
    if (object.level !== 'log') return object;
    return { ...object, level: 'info' } as unknown as typeof object;
  }
}
