import {
  AiBudgetExceededError,
  AiModelError,
  AiOutputError,
  type AiSchema,
  AiService,
  type InferSchemaOutput,
} from '@nestjs/ai';
import { Injectable, Logger } from '@nestjs/common';
import { ResilienceError } from '@nestjs/resilience';
import {
  APICallError,
  JSONParseError,
  NoObjectGeneratedError,
  TypeValidationError,
  UnsupportedFunctionalityError,
} from 'ai';
import { AI_LOG_EVENTS } from './ai-log-events.js';
import { AI_MODELS } from './ai-models.js';
import {
  DocumentReadError,
  type DocumentReadFailure,
} from './errors/document-read.error.js';

/** A file to read: an image or a PDF. */
export interface AiDocument {
  readonly data: Buffer;
  /** e.g. image/jpeg, application/pdf */
  readonly mimeType: string;
  readonly filename: string | null;
}

export interface ReadDocumentRequest<S extends AiSchema> {
  document: AiDocument;
  /** What the answer must be; validated before it is returned. */
  schema: S;
  schemaName: string;
  /** System prompt: what to read and how. */
  instructions: string;
  /** Data sent with the document (e.g. a list to choose from); not instructions. */
  context?: string;
  /** Names the call in usage logs. */
  label: string;
}

/** Sent with the document: the instructions carry everything else. */
const READ_REQUEST = 'Read this document.';

/**
 * Reads a document into structured data, with the extraction model. Generic:
 * the caller brings the schema and the instructions (its business), this
 * service the technique (attachment, settings, failures, logs).
 */
@Injectable()
export class DocumentReaderService {
  private readonly logger = new Logger(DocumentReaderService.name);

  constructor(private readonly aiService: AiService) {}

  /** The answer validated by `schema`, or a DocumentReadError. */
  async read<S extends AiSchema>(
    request: ReadDocumentRequest<S>,
  ): Promise<InferSchemaOutput<S>> {
    const { document } = request;
    this.logger.debug('AI document reading started', {
      event: AI_LOG_EVENTS.readStarted,
      label: request.label,
      mimeType: document.mimeType,
      sizeBytes: document.data.length,
      contextLength: request.context?.length ?? 0,
    });
    try {
      const { object, text, finishReason } =
        await this.aiService.generateObject({
          model: AI_MODELS.extraction,
          label: request.label,
          schema: request.schema,
          schemaName: request.schemaName,
          instructions: request.instructions,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'file',
                  data: document.data,
                  mediaType: document.mimeType,
                  ...(document.filename ? { filename: document.filename } : {}),
                },
                { type: 'text', text: READ_REQUEST },
                ...(request.context
                  ? [{ type: 'text' as const, text: request.context }]
                  : []),
              ],
            },
          ],
          // reading, not writing: the same document should give the same answer.
          // Greedy sampling; some providers (Mistral) refuse it unless top_p is 1,
          // and their default top_p can be lower.
          temperature: 0,
          topP: 1,
          // the answer is ~200 tokens; the rest is room for the model's reasoning,
          // which counts here too (finishReason `length` when it runs out)
          maxOutputTokens: 4_000,
        });
      // debug only: the answer holds the document's data
      this.logger.debug('AI document answer', {
        event: AI_LOG_EVENTS.answer,
        label: request.label,
        finishReason,
        answer: truncate(text),
      });
      return object;
    } catch (error) {
      throw this.toReadError(error, request.label);
    }
  }

  private toReadError(error: unknown, label: string): DocumentReadError {
    if (error instanceof AiOutputError) {
      // not retried (the same request would give the same answer): our
      // schema or prompt needs a fix. The validation issues name fields and
      // expected types; the answer itself only goes to debug.
      this.logger.warn('AI answer did not match the schema', {
        event: AI_LOG_EVENTS.invalidAnswer,
        label,
        ...invalidAnswerDetails(error),
      });
      this.logger.debug('AI invalid answer', {
        event: AI_LOG_EVENTS.answer,
        label,
        answer: truncate(error.text),
      });
      return new DocumentReadError('invalidAnswer');
    }
    if (error instanceof AiBudgetExceededError) {
      return new DocumentReadError('budgetExceeded');
    }
    // an incident, not a business outcome: logged as an error, with the
    // provider's error code and message only, never what we sent (the request
    // holds the document). Their whole error bodies go to debug.
    const failures =
      error instanceof AiModelError
        ? error.attempts.map((attempt) => ({
            modelId: attempt.model.modelId,
            error: attempt.error,
          }))
        : [{ modelId: undefined, error }];
    this.logger.error('AI document reading failed', {
      event: AI_LOG_EVENTS.readFailed,
      label,
      attempts: failures.map((failure) => ({
        modelId: failure.modelId,
        ...describeFailure(failure.error),
      })),
    });
    this.logger.debug('AI provider error bodies', {
      event: AI_LOG_EVENTS.providerErrorBody,
      label,
      bodies: failures.map((failure) => providerBodyOf(failure.error)),
    });
    return new DocumentReadError(
      error instanceof AiModelError
        ? failureOf(error.attempts.at(-1)?.error)
        : 'unexpected',
    );
  }
}

const MAX_LOGGED_TEXT = 1_000;

/** Errors @nestjs/ai treats as mistakes in the call: not an outage. */
const CALLER_MISTAKES = new Set([
  'AI_InvalidPromptError',
  'AI_InvalidArgumentError',
  'AI_InvalidMessageRoleError',
  'AI_MessageConversionError',
]);

/** The reason of a call that failed on every attempt, from its last error. */
function failureOf(error: unknown): DocumentReadFailure {
  // timeouts, open circuit, 5xx, 429, network: the provider, not the request
  if (error instanceof ResilienceError) return 'providerUnavailable';
  if (APICallError.isInstance(error)) {
    return error.isRetryable ? 'providerUnavailable' : 'requestRejected';
  }
  // e.g. a PDF sent to a server that only reads images
  if (UnsupportedFunctionalityError.isInstance(error)) {
    return 'unsupportedDocument';
  }
  if (error instanceof Error && CALLER_MISTAKES.has(error.name)) {
    return 'requestRejected';
  }
  return 'unexpected';
}

/**
 * Why an answer is invalid, without the answer: the SDK's messages quote it
 * (`Value: {...}`), so only the schema issues (field path, expected type) of
 * the TypeValidationError's cause are kept, with the finish reason
 * (`length`: the answer was cut by maxOutputTokens).
 */
function invalidAnswerDetails(error: AiOutputError) {
  let finishReason: string | undefined;
  let inputTokens: number | undefined;
  let outputTokens: number | undefined;
  let reasoningTokens: number | undefined;
  let validation = 'no validation details';
  for (
    let cause: unknown = error.cause;
    cause instanceof Error;
    cause = cause.cause
  ) {
    if (NoObjectGeneratedError.isInstance(cause)) {
      finishReason = cause.finishReason;
      // @nestjs/ai reports no usage event for an invalid answer: the tokens
      // were spent all the same
      inputTokens = cause.usage?.inputTokens;
      outputTokens = cause.usage?.outputTokens;
      reasoningTokens = cause.usage?.outputTokenDetails.reasoningTokens;
    } else if (JSONParseError.isInstance(cause)) {
      validation = 'the answer is not valid JSON';
    } else if (TypeValidationError.isInstance(cause)) {
      validation =
        cause.cause instanceof Error
          ? cause.cause.message
          : 'does not match the schema';
    }
  }
  return {
    finishReason,
    inputTokens,
    outputTokens,
    reasoningTokens,
    validation: truncate(validation),
  };
}

/**
 * What a failed attempt says, safe for an error log: error name, HTTP status,
 * endpoint and the provider's error code and message. Never the request
 * (`requestBodyValues`: the document, base64), the headers (the key) nor the
 * rest of the body (servers may echo the request in it).
 */
function describeFailure(error: unknown) {
  if (!(error instanceof Error)) return { error: typeof error };
  if (!APICallError.isInstance(error)) return { error: error.name };
  return {
    error: error.name,
    status: error.statusCode,
    retryable: error.isRetryable,
    endpoint: endpointOf(error.url),
    providerError: providerErrorOf(error.responseBody),
  };
}

function endpointOf(url: string): string | undefined {
  try {
    const { host, pathname } = new URL(url);
    return `${host}${pathname}`; // no query string
  } catch {
    return undefined;
  }
}

/** Longest provider message kept in an error log. */
const MAX_PROVIDER_MESSAGE = 300;

/**
 * Allow-list of the provider's error body: `type`, `code` and `message`, at
 * the root (Mistral) or under `error` (OpenAI and compatible servers). Not
 * JSON, or none of them: nothing.
 */
function providerErrorOf(body: string | undefined) {
  const parsed = parseJson(body);
  if (!isRecord(parsed)) return undefined;
  const source = isRecord(parsed.error) ? parsed.error : parsed;
  const type = scalar(source.type);
  const code = scalar(source.code);
  const message =
    typeof source.message === 'string'
      ? source.message.slice(0, MAX_PROVIDER_MESSAGE)
      : undefined;
  return (type ?? code ?? message) ? { type, code, message } : undefined;
}

/**
 * The whole error body, for debug only, minus the `input` fields that
 * validation errors (422-style `detail[].input`) use to echo the request.
 */
function providerBodyOf(error: unknown): string | undefined {
  if (!APICallError.isInstance(error) || !error.responseBody) return undefined;
  const parsed = parseJson(error.responseBody);
  return truncate(
    parsed === undefined
      ? error.responseBody
      : JSON.stringify(parsed, (key, value: unknown) =>
          key === 'input' ? undefined : value,
        ),
  );
}

function parseJson(text: string | undefined): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function scalar(value: unknown): string | number | undefined {
  return typeof value === 'string' || typeof value === 'number'
    ? value
    : undefined;
}

/** Longest text (provider message, model answer) kept in a log. */
function truncate(text: string): string {
  return text.length > MAX_LOGGED_TEXT
    ? `${text.slice(0, MAX_LOGGED_TEXT)}…`
    : text;
}
