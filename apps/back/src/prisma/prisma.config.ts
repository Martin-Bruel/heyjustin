import type { ConfigType } from '@nestjs/config';
import { z } from 'zod';
import { validatedConfig } from '../config/index.js';

export const prismaConfig = validatedConfig(
  'prisma',
  z.object({
    DATABASE_URL: z
      .string()
      .regex(/^postgres(ql)?:\/\//, 'must be a postgresql:// URL'),
  }),
  (env) => ({ databaseUrl: env.DATABASE_URL }),
);

export type PrismaConfig = ConfigType<typeof prismaConfig>;
