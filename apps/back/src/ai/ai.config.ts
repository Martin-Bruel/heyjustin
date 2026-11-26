import type { ConfigType } from '@nestjs/config';
import { z } from 'zod';
import { refusedIn, validatedConfig, withEdition } from '../config/index.js';
import { SAAS_EXTRACTION_MODEL } from './ai-models.js';

/** The providers this build can talk to: one SDK package each (see ai-providers.ts). */
export const AI_PROVIDERS = ['mistral', 'openai-compatible'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

const nonEmpty = z.string().trim().min(1);

/**
 * The AI depends on the edition (decision 015):
 * - saas: Mistral Large 4 at low reasoning, fixed in code; only the key is
 *   configured;
 * - self-hosted: the provider and the model are chosen by config, the
 *   reasoning is the model's default. Changing them is a restart, not a
 *   code change.
 */
export const aiConfig = validatedConfig(
  'ai',
  withEdition(
    z.discriminatedUnion('HEYJUSTIN_EDITION', [
      z.object({
        HEYJUSTIN_EDITION: z.literal('saas'),
        AI_API_KEY: nonEmpty,
        AI_PROVIDER: refusedIn('saas'),
        AI_EXTRACTION_MODEL: refusedIn('saas'),
        AI_BASE_URL: refusedIn('saas'),
      }),
      z.discriminatedUnion('AI_PROVIDER', [
        z.object({
          HEYJUSTIN_EDITION: z.literal('self-hosted'),
          AI_PROVIDER: z.literal('mistral'),
          AI_API_KEY: nonEmpty,
          AI_EXTRACTION_MODEL: nonEmpty,
        }),
        // any OpenAI-compatible API: other vendors, or a local model (Ollama, vLLM)
        z.object({
          HEYJUSTIN_EDITION: z.literal('self-hosted'),
          AI_PROVIDER: z.literal('openai-compatible'),
          AI_BASE_URL: z.url(),
          AI_API_KEY: nonEmpty.optional(),
          AI_EXTRACTION_MODEL: nonEmpty,
        }),
      ]),
    ]),
  ),
  (env) => {
    if (env.HEYJUSTIN_EDITION === 'saas') {
      return {
        provider: SAAS_EXTRACTION_MODEL.provider,
        apiKey: env.AI_API_KEY,
        extractionModel: SAAS_EXTRACTION_MODEL.modelId,
        reasoningEffort: SAAS_EXTRACTION_MODEL.reasoningEffort,
      };
    }
    return env.AI_PROVIDER === 'mistral'
      ? {
          provider: env.AI_PROVIDER,
          apiKey: env.AI_API_KEY,
          extractionModel: env.AI_EXTRACTION_MODEL,
          // the model's default
          reasoningEffort: null,
        }
      : {
          provider: env.AI_PROVIDER,
          baseUrl: env.AI_BASE_URL,
          apiKey: env.AI_API_KEY,
          extractionModel: env.AI_EXTRACTION_MODEL,
        };
  },
);

export type AiConfig = ConfigType<typeof aiConfig>;
