import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DiscordClient } from './discord.client.js';
import { discordConfig } from './discord.config.js';
import { DiscordStrategy } from './discord.strategy.js';

/**
 * The Discord channel. Loaded by MessagingModule only when DISCORD_BOT_TOKEN
 * is set: otherwise no client, no Gateway connection, no config validation.
 */
@Module({
  imports: [ConfigModule.forFeature(discordConfig)],
  providers: [DiscordClient, DiscordStrategy],
  exports: [DiscordStrategy],
})
export class DiscordModule {}
