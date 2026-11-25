import type { ConfigType } from '@nestjs/config';
import { z } from 'zod';
import { validatedConfig } from '../config/index.js';

export const companiesConfig = validatedConfig(
  'companies',
  z.object({
    /**
     * Key encrypting the companies' secrets (Pennylane API tokens) in the
     * database: 32 bytes, hex. Losing it means entering every token again.
     */
    SECRETS_ENCRYPTION_KEY: z
      .string()
      .regex(/^[0-9a-f]{64}$/i, 'must be 64 hex characters (32 bytes)'),
    /** Optional: the token of the default company, created at startup. */
    PENNYLANE_API_TOKEN: z.string().trim().optional(),
  }),
  (env) => ({
    secretsEncryptionKey: Buffer.from(env.SECRETS_ENCRYPTION_KEY, 'hex'),
    defaultCompanyPennylaneToken: env.PENNYLANE_API_TOKEN || null,
  }),
);

export type CompaniesConfig = ConfigType<typeof companiesConfig>;
