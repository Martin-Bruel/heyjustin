import type { ConfigType } from '@nestjs/config';
import { z } from 'zod';
import { validatedConfig } from '../config/index.js';

/** The providers this build can talk to: one SDK package each (see ai-providers.ts). */
export const AI_PROVIDERS = ['mistral', 'openai-compatible'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

const nonEmpty = z.string().trim().min(1);

/**
 * One provider per install, chosen by AI_PROVIDER. Changing provider is a
 * config change (and a restart), not a code change.
 */
export const aiConfig = validatedConfig(
  'ai',
  z.discriminatedUnion('AI_PROVIDER', [
    z.object({
      AI_PROVIDER: z.literal('mistral'),
      AI_API_KEY: nonEmpty,
      AI_EXTRACTION_MODEL: nonEmpty,
    }),
    // any OpenAI-compatible API: other vendors, or a local model (Ollama, vLLM)
    z.object({
      AI_PROVIDER: z.literal('openai-compatible'),
      AI_BASE_URL: z.url(),
      AI_API_KEY: nonEmpty.optional(),
      AI_EXTRACTION_MODEL: nonEmpty,
    }),
  ]),
  (env) =>
    env.AI_PROVIDER === 'mistral'
      ? {
          provider: env.AI_PROVIDER,
          apiKey: env.AI_API_KEY,
          extractionModel: env.AI_EXTRACTION_MODEL,
        }
      : {
          provider: env.AI_PROVIDER,
          baseUrl: env.AI_BASE_URL,
          apiKey: env.AI_API_KEY,
          extractionModel: env.AI_EXTRACTION_MODEL,
        },
);

export type AiConfig = ConfigType<typeof aiConfig>;
