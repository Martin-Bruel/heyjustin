import { Module } from '@nestjs/common';
import { ConditionalModule } from '@nestjs/config';
import type { ChannelStrategy } from './channel-strategy.js';
import { DiscordModule } from './discord/discord.module.js';
import { DiscordStrategy } from './discord/discord.strategy.js';
import { MessagingGateway } from './messaging.gateway.js';

/** A channel is enabled when its variable is set and not empty. */
const isSet = (name: string) => (env: NodeJS.ProcessEnv) =>
  (env[name] ?? '').trim() !== '';

/**
 * Generic messaging: receives and sends messages on every enabled app.
 * Knows channels, never business concepts: business modules import it and
 * subscribe with MessagingGateway.onMessage(), never the other way around.
 *
 * Each channel is its own module, loaded only when configured, and the app
 * refuses to start without at least one. To add a channel: import its module
 * with `ConditionalModule.registerWhen` and add its strategy to `inject`.
 *
 * Note: `registerWhen(module, 'VAR')` with a string loads the module even
 * when the variable is unset (it only checks `!== 'false'`): use a predicate.
 */
@Module({
  imports: [
    ConditionalModule.registerWhen(DiscordModule, isSet('DISCORD_BOT_TOKEN')),
    // TODO: ConditionalModule.registerWhen(WhatsAppModule, isSet('WHATSAPP_ACCESS_TOKEN')),
  ],
  providers: [
    {
      provide: MessagingGateway,
      useFactory: (...strategies: (ChannelStrategy | undefined)[]) => {
        const enabled = strategies.filter((strategy) => strategy !== undefined);
        if (enabled.length === 0) {
          throw new Error(
            'No messaging channel configured: set DISCORD_BOT_TOKEN (Discord).',
          );
        }
        return new MessagingGateway(enabled);
      },
      // optional: undefined when the channel module is not loaded
      inject: [{ token: DiscordStrategy, optional: true }],
    },
  ],
  exports: [MessagingGateway],
})
export class MessagingModule {}
