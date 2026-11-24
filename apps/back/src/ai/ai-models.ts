/**
 * Models by role, not by vendor: services ask for `AI_MODELS.extraction`, the
 * config decides which provider and model answer.
 */
export const AI_MODELS = {
  /** reads documents (images, PDF) into structured data */
  extraction: 'extraction',
} as const;
