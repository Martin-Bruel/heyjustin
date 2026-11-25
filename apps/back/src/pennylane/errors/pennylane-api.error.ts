/** Why a Pennylane call failed: fixed reasons, safe to store and show. */
export const PENNYLANE_FAILURES = {
  /** 401: the token is wrong, revoked or expired (tokens can expire) */
  unauthorized: 'Pennylane token invalid or expired',
  /** 403: the token lacks a scope (created read-only?) */
  forbidden: 'Pennylane token lacks a permission',
  notFound: 'Pennylane resource not found',
  /** 409 that retries did not solve */
  conflict: 'Pennylane resource in conflict',
  /** 400, 422: our request is wrong */
  rejected: 'Pennylane rejected the request',
  /** 429 after the retries */
  rateLimited: 'Pennylane rate limit exceeded',
  /** 5xx, timeout, network */
  unavailable: 'Pennylane unavailable',
  /** a file type Pennylane does not accept (e.g. HEIC) */
  unsupportedFile: 'File type not accepted by Pennylane',
} as const;

export type PennylaneFailure = keyof typeof PENNYLANE_FAILURES;

/**
 * What Pennylane said, allow-listed for logs: never `payload`, which echoes
 * the value sent (amounts, supplier names).
 */
export interface PennylaneErrorDetails {
  /** e.g. NotEnumInclude, InvalidPattern */
  code?: string;
  /** the field at fault, e.g. invoice_lines.0.vat_rate */
  field?: string;
  /** truncated */
  message?: string;
}

/**
 * A Pennylane call failed. The message is one of the fixed reasons above;
 * `details` hold what Pennylane said, allow-listed, for the logs.
 */
export class PennylaneApiError extends Error {
  constructor(
    readonly failure: PennylaneFailure,
    readonly context: {
      method: string;
      path: string;
      status?: number;
      details?: PennylaneErrorDetails;
      /** a 429's retry-after, in ms */
      retryAfterMs?: number;
      /** safe to send again (a 429, a 409 "not ready" when asked) */
      retryable?: boolean;
      cause?: unknown;
    },
  ) {
    super(PENNYLANE_FAILURES[failure], { cause: context.cause });
    this.name = 'PennylaneApiError';
  }

  get status(): number | undefined {
    return this.context.status;
  }

  /** For an error log: what failed, without what we sent. */
  toLogFields() {
    return {
      failure: this.failure,
      method: this.context.method,
      path: this.context.path,
      status: this.context.status,
      ...this.context.details,
    };
  }
}
