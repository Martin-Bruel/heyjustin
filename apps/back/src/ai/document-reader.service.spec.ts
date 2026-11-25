import { AiModule as NestAiModule } from '@nestjs/ai';
import { type FakeAnswer, FakeModel, providerError } from '@nestjs/ai/testing';
import { Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { APICallError, UnsupportedFunctionalityError } from 'ai';
import { z } from 'zod';
import { AI_MODELS } from './ai-models.js';
import {
  type AiDocument,
  DocumentReaderService,
} from './document-reader.service.js';
import { DocumentReadError } from './errors/document-read.error.js';

const document: AiDocument = {
  data: Buffer.from('jpeg bytes'),
  mimeType: 'image/jpeg',
  filename: 'receipt.jpg',
};

const schema = z.object({ supplierName: z.string() });

/** The real AiService with a fake model: no network, no retries. */
async function setup(...answers: FakeAnswer[]) {
  const model = new FakeModel(answers);
  const moduleRef = await Test.createTestingModule({
    imports: [
      NestAiModule.forRoot({
        models: { [AI_MODELS.extraction]: model },
        defaults: { retry: false },
        include: [],
      }),
    ],
    providers: [DocumentReaderService],
  }).compile();
  return { reader: moduleRef.get(DocumentReaderService), model };
}

function read(reader: DocumentReaderService) {
  return reader.read({
    document,
    schema,
    schemaName: 'receipt',
    instructions: 'Read the supplier.',
    label: 'test-reading',
  });
}

/** The error a promise rejects with; fails when it resolves. */
function rejectionOf(promise: Promise<unknown>): Promise<Error> {
  return promise.then(
    () => {
      throw new Error('expected a rejection');
    },
    (error: Error) => error,
  );
}

describe('DocumentReaderService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('sends the document with the instructions and returns the validated answer', async () => {
    const { reader, model } = await setup({ object: { supplierName: 'Acme' } });

    await expect(read(reader)).resolves.toEqual({ supplierName: 'Acme' });

    const call = model.lastCall;
    expect(call?.instructions).toBe('Read the supplier.');
    const prompt = JSON.stringify(call?.options.prompt);
    expect(prompt).toContain('"type":"file"');
    expect(prompt).toContain('"mediaType":"image/jpeg"');
    expect(call?.options.responseFormat).toMatchObject({ type: 'json' });
    expect(call?.options.temperature).toBe(0);
    expect(call?.options.topP).toBe(1);
  });

  it('sends the context after the document, when there is one', async () => {
    const { reader, model } = await setup({ object: { supplierName: 'Acme' } });

    await reader.read({
      document,
      schema,
      schemaName: 'receipt',
      instructions: 'Read the supplier.',
      context: 'Known suppliers: 1 | Acme',
      label: 'test-reading',
    });

    const prompt = JSON.stringify(model.lastCall?.options.prompt);
    expect(prompt.indexOf('"type":"file"')).toBeLessThan(
      prompt.indexOf('Known suppliers: 1 | Acme'),
    );
  });

  it('hides an answer that does not match the schema', async () => {
    const { reader } = await setup({ object: { supplier: 'Acme, 12 rue X' } });

    const error = await rejectionOf(read(reader));

    expect(error).toBeInstanceOf(DocumentReadError);
    expect(error.message).toBe('AI answer did not match the expected format');
  });

  it('logs why the answer is invalid, and the answer at debug only', async () => {
    const { reader, model } = await setup({
      object: { supplier: 'Acme, 12 rue X' },
    });
    const warn = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    const debug = vi
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => {});

    await rejectionOf(read(reader));

    expect(model.calls).toHaveLength(1); // not retried
    expect(warn).toHaveBeenCalledWith('AI answer did not match the schema', {
      event: 'ai.document.invalid_answer',
      label: 'test-reading',
      finishReason: 'stop',
      inputTokens: 10,
      outputTokens: 10,
      reasoningTokens: 0,
      validation:
        'supplierName: Invalid input: expected string, received undefined',
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('Acme');
    expect(debug).toHaveBeenCalledWith('AI invalid answer', {
      event: 'ai.document.answer',
      label: 'test-reading',
      answer: '{"supplier":"Acme, 12 rue X"}',
    });
  });

  it('logs each reading at debug: the document kind and size, then the answer', async () => {
    const { reader } = await setup({ object: { supplierName: 'Acme' } });
    const debug = vi
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => {});

    await read(reader);

    expect(debug.mock.calls).toEqual([
      [
        'AI document reading started',
        {
          event: 'ai.document.read_started',
          label: 'test-reading',
          mimeType: 'image/jpeg',
          sizeBytes: 10,
          contextLength: 0,
        },
      ],
      [
        'AI document answer',
        {
          event: 'ai.document.answer',
          label: 'test-reading',
          finishReason: 'stop',
          answer: '{"supplierName":"Acme"}',
        },
      ],
    ]);
  });

  it('reports a provider outage without what we sent', async () => {
    const { reader } = await setup(providerError(500));
    const logError = silenceErrors();

    const error = await rejectionOf(read(reader));

    expect(error.message).toBe('AI provider unavailable');
    expect(logError).toHaveBeenCalledWith('AI document reading failed', {
      event: 'ai.document.read_failed',
      label: 'test-reading',
      attempts: [
        {
          modelId: 'fake-model',
          error: 'AI_APICallError',
          status: 500,
          retryable: true,
          endpoint: 'fake-provider.test/v1/messages',
          providerError: undefined,
        },
      ],
    });
  });

  it('logs only the code and message of a rejection at error level', async () => {
    const { reader } = await setup(
      badRequest({
        object: 'error',
        message: 'top_p must be 1 when using greedy sampling.',
        type: 'invalid_request_greedy_sampling',
        code: '3054',
        detail: [
          { msg: 'echo: Acme 12.50 EUR', input: 'base64 of the receipt' },
        ],
      }),
    );
    const logError = silenceErrors();
    const debug = vi
      .spyOn(Logger.prototype, 'debug')
      .mockImplementation(() => {});

    const error = await rejectionOf(read(reader));

    expect(error.message).toBe('AI provider rejected the request');
    expect(attemptsLogged(logError)[0]).toMatchObject({
      status: 400,
      retryable: false,
      endpoint: 'api.mistral.ai/v1/chat/completions',
      providerError: {
        type: 'invalid_request_greedy_sampling',
        code: '3054',
        message: 'top_p must be 1 when using greedy sampling.',
      },
    });
    const errorLogs = JSON.stringify(logError.mock.calls);
    expect(errorLogs).not.toContain('Acme');
    expect(errorLogs).not.toContain('base64 of the receipt');
    expect(errorLogs).not.toContain('secret');

    // the whole body, for diagnosis, at debug only and without the echoed input
    const bodies = JSON.stringify(debug.mock.calls);
    expect(bodies).toContain('echo: Acme 12.50 EUR');
    expect(bodies).not.toContain('base64 of the receipt');
  });

  it('reads the error of OpenAI-compatible servers, and truncates its message', async () => {
    const { reader } = await setup(
      badRequest({ error: { message: 'x'.repeat(5_000), code: 'bad_file' } }),
    );
    const logError = silenceErrors();

    await rejectionOf(read(reader));

    const { providerError } = attemptsLogged(logError)[0] as {
      providerError: { code: string; message: string };
    };
    expect(providerError.code).toBe('bad_file');
    expect(providerError.message).toHaveLength(300);
  });

  it('logs nothing of a body that is not JSON at error level', async () => {
    const { reader } = await setup(badRequest('<html>Acme</html>'));
    const logError = silenceErrors();

    await rejectionOf(read(reader));

    expect(attemptsLogged(logError)[0]).toMatchObject({
      providerError: undefined,
    });
  });

  it('tells apart a document the provider cannot read', async () => {
    const { reader } = await setup(
      new UnsupportedFunctionalityError({
        functionality: 'file part media type application/pdf',
      }),
    );
    silenceErrors();

    const error = await rejectionOf(read(reader));

    expect(error.message).toBe(
      'Document type not supported by the AI provider',
    );
  });
});

/** A 400 from the provider, with our request and key in the error object. */
function badRequest(body: unknown): APICallError {
  return new APICallError({
    message: 'Bad Request',
    url: 'https://api.mistral.ai/v1/chat/completions?x=1',
    requestBodyValues: { messages: ['base64 of the receipt'] },
    statusCode: 400,
    responseHeaders: { authorization: 'Bearer secret' },
    responseBody: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function attemptsLogged(logError: ReturnType<typeof silenceErrors>) {
  return (logError.mock.calls[0][1] as { attempts: object[] }).attempts;
}

function silenceErrors() {
  return vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
}
