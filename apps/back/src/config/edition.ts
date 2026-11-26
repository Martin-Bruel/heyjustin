import { z } from 'zod';

/**
 * Which heyjustin this install is (HEYJUSTIN_EDITION, decision 015):
 * - `self-hosted` (default): the open-source app, configured by whoever runs
 *   it (AI provider and model, a default company with its Pennylane token);
 * - `saas`: our hosted service, where these choices are fixed in code.
 */
export const EDITIONS = ['self-hosted', 'saas'] as const;
export type Edition = (typeof EDITIONS)[number];
export const DEFAULT_EDITION: Edition = 'self-hosted';

/**
 * Wraps a module's config schema discriminated on HEYJUSTIN_EDITION: the
 * default edition applies when the variable is not set.
 */
export function withEdition<Schema extends z.ZodType>(schema: Schema) {
  return z.preprocess(
    (env) => ({
      ...(env as Record<string, unknown>),
      HEYJUSTIN_EDITION:
        (env as Record<string, unknown>).HEYJUSTIN_EDITION ?? DEFAULT_EDITION,
    }),
    schema,
  );
}

/**
 * A variable this edition does not use: refused rather than ignored, since
 * whoever sets it expects it to apply.
 */
export function refusedIn(edition: Edition) {
  return z
    .undefined({ error: `not available in the ${edition} edition: remove it` })
    .optional();
}
