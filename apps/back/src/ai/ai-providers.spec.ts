import { createModelFactory } from './ai-providers.js';

describe('createModelFactory', () => {
  it('sends the reasoning effort the saas edition fixes', () => {
    const definition = createModelFactory({
      provider: 'mistral',
      apiKey: 'a-key',
      extractionModel: 'mistral-large-4',
      reasoningEffort: 'low',
    })('mistral-large-4');

    expect(definition.providerOptions).toEqual({
      mistral: { reasoningEffort: 'low' },
    });
  });

  it('leaves a self-hosted Mistral model at its default reasoning', () => {
    const definition = createModelFactory({
      provider: 'mistral',
      apiKey: 'a-key',
      extractionModel: 'mistral-small-2603',
      reasoningEffort: null,
    })('mistral-small-2603');

    expect(definition.providerOptions).toBeUndefined();
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
