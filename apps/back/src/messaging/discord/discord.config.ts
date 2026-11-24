import type { ConfigType } from '@nestjs/config';
import { z } from 'zod';
import { validatedConfig } from '../../config/index.js';

/** Only loaded when the Discord channel is enabled (see MessagingModule). */
export const discordConfig = validatedConfig(
  'discord',
  z.object({
    DISCORD_BOT_TOKEN: z.string().min(1),
  }),
  (env) => ({ botToken: env.DISCORD_BOT_TOKEN }),
);

export type DiscordConfig = ConfigType<typeof discordConfig>;
