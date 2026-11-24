import type { ConfigType } from '@nestjs/config';
import { z } from 'zod';
import { validatedConfig } from '../config/index.js';

export const loggingConfig = validatedConfig(
  'logging',
  z.object({
    /** Key of the HMAC turning personal identifiers into pseudonyms in logs. */
    LOG_HASH_SECRET: z.string(),
  }),
  (env) => ({ hashSecret: env.LOG_HASH_SECRET }),
);

export type LoggingConfig = ConfigType<typeof loggingConfig>;
