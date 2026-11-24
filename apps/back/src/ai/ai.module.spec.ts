import { AiModels } from '@nestjs/ai';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { InvalidConfigError } from '../config/index.js';
import { AI_MODELS } from './ai-models.js';
import { AiModule } from './ai.module.js';

const AI_VARIABLES = [
  'AI_PROVIDER',
  'AI_API_KEY',
  'AI_BASE_URL',
  'AI_EXTRACTION_MODEL',
];

/** Builds the real AiModule with only these AI variables (DI only: no model call). */
async function compileWith(env: Record<string, string>) {
  const names = [...new Set([...AI_VARIABLES, ...Object.keys(env)])];
  const previous = names.map((name) => [name, process.env[name]] as const);
  for (const name of AI_VARIABLES) delete process.env[name];
  Object.assign(process.env, env);
  try {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        AiModule,
      ],
    }).compile();
    return moduleRef.get(AiModels, { strict: false });
  } finally {
    // in place: process.env is a special object, never replace it
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

/** The model registered for `name`, as the SDK describes it. */
function describeModel(models: AiModels, name: string) {
  const model = models.get(name) as { provider: string; modelId: string };
  return { provider: model.provider, modelId: model.modelId };
}

describe('AiModule', () => {
  it('registers the extraction model of the configured provider', async () => {
    const models = await compileWith({
      AI_PROVIDER: 'mistral',
      AI_API_KEY: 'a-key',
      AI_EXTRACTION_MODEL: 'mistral-large-4',
    });

    expect(describeModel(models, AI_MODELS.extraction)).toEqual({
      provider: 'mistral.chat',
      modelId: 'mistral-large-4',
    });
  });

  it('switches provider by config only', async () => {
    const models = await compileWith({
      AI_PROVIDER: 'openai-compatible',
      AI_BASE_URL: 'http://localhost:11434/v1',
      AI_EXTRACTION_MODEL: 'a-local-model',
    });

    expect(describeModel(models, AI_MODELS.extraction)).toEqual({
      provider: 'openai-compatible.chat',
      modelId: 'a-local-model',
    });
  });

  it.each([
    [{}, /AI_PROVIDER/],
    [{ AI_PROVIDER: 'unknown', AI_EXTRACTION_MODEL: 'm' }, /AI_PROVIDER/],
    [{ AI_PROVIDER: 'mistral', AI_EXTRACTION_MODEL: 'm' }, /AI_API_KEY/],
    [{ AI_PROVIDER: 'mistral', AI_API_KEY: 'k' }, /AI_EXTRACTION_MODEL/],
    [
      { AI_PROVIDER: 'openai-compatible', AI_EXTRACTION_MODEL: 'm' },
      /AI_BASE_URL/,
    ],
  ])('refuses to start with %o', async (env, variable) => {
    const error = await compileWith(env).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(InvalidConfigError);
    expect((error as Error).message).toMatch(variable);
  });

  it('never puts the key in the error', async () => {
    const error = await compileWith({
      AI_PROVIDER: 'openai-compatible',
      AI_API_KEY: 'secret-key',
      AI_BASE_URL: 'not a url',
      AI_EXTRACTION_MODEL: 'm',
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(InvalidConfigError);
    expect((error as Error).message).not.toContain('secret-key');
  });
});
