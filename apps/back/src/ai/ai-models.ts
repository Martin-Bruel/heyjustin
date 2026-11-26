/**
 * Models by role, not by vendor: services ask for `AI_MODELS.extraction`, the
 * config decides which provider and model answer.
 */
export const AI_MODELS = {
  /** reads documents (images, PDF) into structured data */
  extraction: 'extraction',
} as const;

/**
 * The extraction model of the saas edition, fixed in code with its reasoning
 * (decision 015): a weaker model reads receipts wrong (Small 4 misread a
 * blurry photo), which costs more than it saves. Pinned, not `-latest`.
 */
export const SAAS_EXTRACTION_MODEL = {
  provider: 'mistral',
  modelId: 'mistral-large-4',
  // the least Large 4 accepts (low | medium | high): ~900 output tokens per
  // receipt instead of ~2 400 by default
  reasoningEffort: 'low',
} as const;
