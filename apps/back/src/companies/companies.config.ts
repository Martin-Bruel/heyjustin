import type { ConfigType } from '@nestjs/config';
import { z } from 'zod';
import { refusedIn, validatedConfig, withEdition } from '../config/index.js';

/**
 * Key encrypting the companies' secrets (Pennylane API tokens) in the
 * database: 32 bytes, hex. Losing it means entering every token again.
 */
const SECRETS_ENCRYPTION_KEY = z
  .string()
  .regex(/^[0-9a-f]{64}$/i, 'must be 64 hex characters (32 bytes)');

export const companiesConfig = validatedConfig(
  'companies',
  withEdition(
    z.discriminatedUnion('HEYJUSTIN_EDITION', [
      z.object({
        HEYJUSTIN_EDITION: z.literal('self-hosted'),
        SECRETS_ENCRYPTION_KEY,
        /** Optional: the token of the default company, created at startup. */
        PENNYLANE_API_TOKEN: z.string().trim().optional(),
      }),
      // every company brings its own token (decision 015)
      z.object({
        HEYJUSTIN_EDITION: z.literal('saas'),
        SECRETS_ENCRYPTION_KEY,
        PENNYLANE_API_TOKEN: refusedIn('saas'),
      }),
    ]),
  ),
  (env) => ({
    secretsEncryptionKey: Buffer.from(env.SECRETS_ENCRYPTION_KEY, 'hex'),
    defaultCompanyPennylaneToken: env.PENNYLANE_API_TOKEN || null,
  }),
);

export type CompaniesConfig = ConfigType<typeof companiesConfig>;
