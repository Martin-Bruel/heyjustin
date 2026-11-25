import type { ConfigType } from '@nestjs/config';
import { z } from 'zod';
import { validatedConfig } from '../config/index.js';

/**
 * Only the API location: tokens are per company (a Pennylane token belongs
 * to one company), stored by the companies module and passed to each call.
 */
export const pennylaneConfig = validatedConfig(
  'pennylane',
  z.object({
    PENNYLANE_BASE_URL: z
      .url()
      .default('https://app.pennylane.com/api/external/v2'),
  }),
  (env) => ({ baseUrl: env.PENNYLANE_BASE_URL.replace(/\/+$/, '') }),
);

export type PennylaneConfig = ConfigType<typeof pennylaneConfig>;
