import { ClsServiceManager } from 'nestjs-cls';

/*
 * The log context: fields attached to every log of the current flow, the
 * closed list of context fields seen in Grafana. Add a field here before
 * using it, so every module logs it under the same name. Never a personal
 * identifier (external id, phone number): log a hash as an explicit field.
 *
 * Values are plain strings: logging is imported by every module and must not
 * import their types back (`Channel`, ids).
 */

/** A received message, opened by messaging. */
export interface MessageFlow {
  readonly flow: 'message';
  readonly channel: string;
  readonly messageId: string;
}

/** A click on a button of one of our messages, opened by messaging. */
export interface ClickFlow {
  readonly flow: 'click';
  readonly channel: string;
  /** our message carrying the button */
  readonly messageId: string;
}

/**
 * How a flow starts: one member per kind of entry point, with the fields it
 * must provide. Next one: an HTTP request.
 */
export type FlowContext = MessageFlow | ClickFlow;

/**
 * Added by services once the information is known. Shared by every flow: a
 * service does not know at compile time which flow it runs in.
 */
export interface FlowEnrichment {
  /** Added by users once the sender is known. */
  readonly userId?: string;
  readonly companyId?: string;
  /** Added by tickets once the ticket exists. */
  readonly ticketId?: string;
}

export type LogContext = FlowContext & FlowEnrichment;

const LOG_CONTEXT_KEY = 'log';

/**
 * Runs `fn` in a new log context: every log it produces, across every
 * `await`, carries `fields` (nestjs-cls, on AsyncLocalStorage). Call it once
 * per flow, at its entry point.
 *
 * `ClsService.run()` rather than the `@UseCls()` decorator: same mechanism,
 * but the decorator requires an initialized Nest app (`app.init()`), which
 * breaks classes built with `new` in unit tests.
 */
export function runInLogContext<T>(
  fields: FlowContext,
  fn: () => Promise<T>,
): Promise<T> {
  const cls = ClsServiceManager.getClsService();
  return cls.run(() => {
    cls.set(LOG_CONTEXT_KEY, { ...fields });
    return fn();
  });
}

/**
 * Adds fields to the current log context, e.g. `ticketId` once the ticket
 * exists: every following log of the same flow carries them.
 * Does nothing outside a context (startup, tests), like the Nest `Logger`.
 */
export function assignLogContext(fields: FlowEnrichment): void {
  const cls = ClsServiceManager.getClsService();
  const current = currentLogContext();
  if (!current) return;
  cls.set(LOG_CONTEXT_KEY, { ...current, ...fields });
}

/** The fields of the current flow, `undefined` outside a flow. */
export function currentLogContext(): LogContext | undefined {
  const cls = ClsServiceManager.getClsService();
  if (!cls.isActive()) return undefined;
  return cls.get(LOG_CONTEXT_KEY) as LogContext | undefined;
}
