import { createModelFactory } from './ai-providers.js';

describe('createModelFactory', () => {
  it('keeps the reasoning of Mistral models low', () => {
    const definition = createModelFactory({
      provider: 'mistral',
      apiKey: 'a-key',
      extractionModel: 'mistral-large-4',
    })('mistral-large-4');

    expect(definition.providerOptions).toEqual({
      mistral: { reasoningEffort: 'low' },
    });
  });

  it('sets nothing provider-specific for an OpenAI-compatible server', () => {
    const definition = createModelFactory({
      provider: 'openai-compatible',
      baseUrl: 'http://localhost:11434/v1',
      apiKey: undefined,
      extractionModel: 'a-local-model',
    })('a-local-model');

    expect(definition.providerOptions).toBeUndefined();
  });
});
