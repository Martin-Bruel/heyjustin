import type { ConfigType } from '@nestjs/config';
import { z } from 'zod';
import { DEFAULT_EDITION, EDITIONS } from './edition.js';
import { validatedConfig } from './validated-config.js';

/** Settings of the app itself. Loaded globally by AppModule. */
export const appConfig = validatedConfig(
  'app',
  z.object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    HEYJUSTIN_EDITION: z.enum(EDITIONS).default(DEFAULT_EDITION),
  }),
  (env) => ({
    edition: env.HEYJUSTIN_EDITION,
    nodeEnv: env.NODE_ENV,
    isProduction: env.NODE_ENV === 'production',
    port: env.PORT,
  }),
);

export type AppConfig = ConfigType<typeof appConfig>;
