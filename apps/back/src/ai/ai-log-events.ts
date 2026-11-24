/**
 * Names of the log events of this module (the `event` field). Stable: Grafana
 * queries and dashboards filter on them, a rename breaks them silently.
 */
export const AI_LOG_EVENTS = {
  /** one model call that answered: tokens, duration; never the content */
  modelCalled: 'ai.model.called',
  /** debug: a reading starts (document type and size, not its content) */
  readStarted: 'ai.document.read_started',
  /** debug only: the model's answer, valid or not; holds the document's data */
  answer: 'ai.document.answer',
  /** the answer did not match the schema: the schema or the prompt needs a fix */
  invalidAnswer: 'ai.document.invalid_answer',
  /** debug only: the provider's whole error bodies (may echo the request) */
  providerErrorBody: 'ai.document.provider_error_body',
  /** a document could not be read (provider down, unexpected error): an incident */
  readFailed: 'ai.document.read_failed',
} as const;
