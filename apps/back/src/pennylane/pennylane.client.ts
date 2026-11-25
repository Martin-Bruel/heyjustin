import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CircuitBreakerPolicy,
  ResilienceError,
  ResiliencePolicy,
  ResilienceTimeoutError,
  RetryPolicy,
  TimeoutPolicy,
} from '@nestjs/resilience';
import {
  type PennylaneErrorDetails,
  PennylaneApiError,
  type PennylaneFailure,
} from './errors/pennylane-api.error.js';
import { PENNYLANE_LOG_EVENTS } from './pennylane-log-events.js';
import { type PennylaneConfig, pennylaneConfig } from './pennylane.config.js';
import type { PennylaneFilter, PennylanePage } from './pennylane.types.js';

export interface PennylaneRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** relative to the base URL, e.g. `/suppliers` */
  path: string;
  query?: Record<string, string | number | PennylaneFilter[] | undefined>;
  /** sent as JSON */
  json?: unknown;
  /** sent as multipart/form-data (file uploads) */
  form?: FormData;
  /**
   * Retry a 409: Pennylane answers it while an uploaded file is not processed
   * yet ("retry after a few seconds"). Off by default: elsewhere a 409 means
   * "already exists" and retrying changes nothing.
   */
  retryOnConflict?: boolean;
}

/** Pennylane allows 25 requests per 5 seconds and per token. */
const MAX_ATTEMPTS = 4;
const TIMEOUT_MS = 30_000;
/** When a 429 has no usable retry-after header. */
const DEFAULT_RATE_LIMIT_WAIT_MS = 5_000;
/** Longest wait accepted from a retry-after header. */
const MAX_WAIT_MS = 30_000;
const CONFLICT_WAIT_MS = [2_000, 4_000, 8_000];
const MAX_LOGGED_MESSAGE = 300;
const PAGE_SIZE = 100;

/**
 * HTTP client of the Pennylane API v2: thin, knows no business. The token is
 * passed to each call (one per company) and never logged.
 *
 * Each call runs under a @nestjs/resilience policy, as the ai module does:
 * - retry, only what is safe to repeat: a 429 (the request was not
 *   processed), after its retry-after, and when asked a 409 "not ready".
 *   Never a timeout or a 5xx: the write may have happened. Callers make
 *   writes idempotent first (`external_reference`), or let their flow retry;
 * - a circuit breaker shared by every company: when Pennylane fails (5xx,
 *   timeouts, network), calls stop for 30 s instead of piling up. 4xx do not
 *   count: they are about one request or one token;
 * - a timeout per attempt, which aborts the request.
 */
@Injectable()
export class PennylaneClient {
  private readonly logger = new Logger(PennylaneClient.name);
  private readonly policy = ResiliencePolicy.wrap(
    new RetryPolicy({
      name: 'pennylane retry',
      attempts: MAX_ATTEMPTS,
      retryIf: (error) =>
        error instanceof PennylaneApiError && isRetryable(error),
      backoff: (attempt, error) => this.backoff(attempt, error),
    }),
    new CircuitBreakerPolicy({
      name: 'pennylane',
      recordIf: (error) =>
        error instanceof ResilienceTimeoutError ||
        (error instanceof PennylaneApiError && error.failure === 'unavailable'),
    }),
    new TimeoutPolicy({ name: 'pennylane timeout', timeout: TIMEOUT_MS }),
  );

  constructor(
    @Inject(pennylaneConfig.KEY)
    private readonly pennylaneConfig: PennylaneConfig,
  ) {}

  async request<T>(token: string, request: PennylaneRequest): Promise<T> {
    const url = this.urlOf(request);
    const { method, path } = request;
    try {
      return await this.policy.execute(
        ({ signal, attempt }) =>
          this.send<T>(token, request, url, signal, attempt),
        { source: `${method} ${path}` },
      );
    } catch (error) {
      if (error instanceof PennylaneApiError) throw error;
      // a timeout, or the breaker open: Pennylane is not answering
      if (error instanceof ResilienceError) {
        throw new PennylaneApiError('unavailable', {
          method,
          path,
          cause: error,
        });
      }
      throw error;
    }
  }

  /** Every item of a list, page after page (filters are re-sent each time). */
  async listAll<T>(
    token: string,
    request: Omit<PennylaneRequest, 'method'>,
  ): Promise<T[]> {
    const items: T[] = [];
    let cursor: string | undefined;
    do {
      const page = await this.request<PennylanePage<T>>(token, {
        ...request,
        method: 'GET',
        query: { ...request.query, limit: PAGE_SIZE, cursor },
      });
      items.push(...page.items);
      cursor = page.has_more ? (page.next_cursor ?? undefined) : undefined;
    } while (cursor);
    return items;
  }

  /** The wait before a retry; overridden in tests so they do not wait. */
  protected waitBeforeRetry(ms: number): number {
    return ms;
  }

  /** One attempt: the response, or a PennylaneApiError. */
  private async send<T>(
    token: string,
    request: PennylaneRequest,
    url: URL,
    signal: AbortSignal,
    attempt: number,
  ): Promise<T> {
    const { method, path } = request;
    const startedAt = Date.now();
    let response: Response;
    try {
      response = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          ...(request.json === undefined
            ? {}
            : { 'Content-Type': 'application/json' }),
        },
        body:
          request.json === undefined
            ? request.form
            : JSON.stringify(request.json),
        signal,
      });
    } catch (cause) {
      // the timeout's own error: let the policy report it
      if (signal.aborted) throw signal.reason;
      // network error: the request may have been processed
      throw new PennylaneApiError('unavailable', { method, path, cause });
    }
    // the path only: the query can hold a supplier name
    this.logger.debug('Pennylane request', {
      event: PENNYLANE_LOG_EVENTS.request,
      method,
      path,
      status: response.status,
      attempt,
      durationMs: Date.now() - startedAt,
    });
    if (response.ok) {
      return (response.status === 204 ? undefined : await response.json()) as T;
    }
    const failure = failureOf(response.status);
    const retryable =
      failure === 'rateLimited' ||
      (failure === 'conflict' && request.retryOnConflict === true);
    throw new PennylaneApiError(failure, {
      method,
      path,
      status: response.status,
      details: detailsOf(await response.text().catch(() => '')),
      retryAfterMs:
        failure === 'rateLimited' ? retryAfterOf(response) : undefined,
      retryable,
    });
  }

  private backoff(attempt: number, error: unknown): number {
    const waitMs =
      error instanceof PennylaneApiError && error.failure === 'rateLimited'
        ? (error.context.retryAfterMs ?? DEFAULT_RATE_LIMIT_WAIT_MS)
        : (CONFLICT_WAIT_MS[attempt - 1] ?? CONFLICT_WAIT_MS.at(-1)!);
    this.logger.warn('Pennylane request retried', {
      event: PENNYLANE_LOG_EVENTS.retried,
      ...(error instanceof PennylaneApiError
        ? {
            method: error.context.method,
            path: error.context.path,
            status: error.status,
          }
        : {}),
      attempt,
      waitMs,
    });
    return this.waitBeforeRetry(waitMs);
  }

  private urlOf(request: PennylaneRequest): URL {
    const url = new URL(`${this.pennylaneConfig.baseUrl}${request.path}`);
    for (const [name, value] of Object.entries(request.query ?? {})) {
      if (value === undefined) continue;
      url.searchParams.set(
        name,
        typeof value === 'object' ? JSON.stringify(value) : String(value),
      );
    }
    return url;
  }
}

function isRetryable(error: PennylaneApiError): boolean {
  return error.context.retryable === true;
}

/** A 429's retry-after, in ms, capped; `undefined` when absent or invalid. */
function retryAfterOf(response: Response): number | undefined {
  const header = response.headers.get('retry-after');
  const seconds = header === null ? NaN : Number(header);
  return Number.isFinite(seconds) && seconds >= 0
    ? Math.min(seconds * 1000, MAX_WAIT_MS)
    : undefined;
}

function failureOf(status: number): PennylaneFailure {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'notFound';
  if (status === 409) return 'conflict';
  if (status === 429) return 'rateLimited';
  if (status >= 500) return 'unavailable';
  return 'rejected';
}

/**
 * Pennylane's error body, allow-listed: `{error}`, or `{message, code,
 * field}` for validation errors. Never `payload` (the value we sent).
 */
function detailsOf(body: string): PennylaneErrorDetails | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined;
  const source = parsed as Record<string, unknown>;
  const text = (value: unknown, max = MAX_LOGGED_MESSAGE) =>
    typeof value === 'string' ? value.slice(0, max) : undefined;
  const details: PennylaneErrorDetails = {
    code: text(source.code),
    field: text(source.field),
    message: text(source.message) ?? text(source.error),
  };
  return (details.code ?? details.field ?? details.message)
    ? details
    : undefined;
}
