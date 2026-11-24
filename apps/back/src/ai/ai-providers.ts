import { createMistral } from '@ai-sdk/mistral';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import type { AiModelDefinition } from '@nestjs/ai';
import type { AiConfig } from './ai.config.js';

type ModelFactory = (modelId: string) => AiModelDefinition;

/**
 * The only place that knows the provider SDKs. Adding a provider = its
 * `@ai-sdk/*` package, a literal in AI_PROVIDERS and a case here; the
 * exhaustive switch makes a missing case a compile error.
 *
 * Keys are passed explicitly, from the validated config: the SDKs would
 * otherwise read their own variables (MISTRAL_API_KEY…) silently.
 *
 * Provider-specific settings go here too (`providerOptions` of the model
 * definition), so callers stay provider-neutral.
 */
export function createModelFactory(config: AiConfig): ModelFactory {
  switch (config.provider) {
    case 'mistral': {
      const mistral = createMistral({ apiKey: config.apiKey });
      return (modelId) => ({
        model: mistral(modelId),
        // Large 4 reasons before answering, and the reasoning counts in
        // maxOutputTokens: at its default effort it used the whole budget and
        // cut the JSON. Reading a document needs little of it. Models that do
        // not accept `low` ignore it with an SDK warning.
        providerOptions: { mistral: { reasoningEffort: 'low' } },
      });
    }
    case 'openai-compatible': {
      const compatible = createOpenAICompatible({
        name: 'openai-compatible',
        baseURL: config.baseUrl,
        apiKey: config.apiKey,
        // required for generateObject to send the JSON schema
        supportsStructuredOutputs: true,
      });
      return (modelId) => ({ model: compatible.chatModel(modelId) });
    }
    default: {
      const unsupported: never = config;
      throw new Error(
        `Unsupported AI provider: ${(unsupported as AiConfig).provider}`,
      );
    }
  }
}
