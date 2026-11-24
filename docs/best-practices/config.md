# Configuration

## Validated at startup, typed everywhere

- Never read `process.env` or `configService.get('NAME')` in the code. Each
  module declares the variables it needs in a `<module>.config.ts`, validated
  with a zod schema, and registers it with `ConfigModule.forFeature()`:

```ts
export const discordConfig = validatedConfig('discord', z.object({
  DISCORD_BOT_TOKEN: z.string().min(1),
}), (env) => ({ botToken: env.DISCORD_BOT_TOKEN }));

export type DiscordConfig = ConfigType<typeof discordConfig>;
```

- Classes inject the typed result, named after its type:
  `@Inject(discordConfig.KEY) private readonly discordConfig: DiscordConfig`.
- A missing or invalid variable stops the app at startup with a message
  naming the namespace and the variables, never their values (secrets).
- Types come from the schema (`z.infer`): nothing is written twice. zod
  rather than Joi for that reason.
- Settings shared by everyone (environment, port) live in one global
  `appConfig`, loaded by `ConfigModule.forRoot({ load: [appConfig] })`.
- Keep a `.env.example` listing every variable, with how to obtain it.
  Never commit `.env`.

## Optional integrations: load the module only when configured

When an integration is optional (one of several messaging apps, a provider
used by some installs only), make it its own module and load it only when
its variables are set:

```ts
const isSet = (name: string) => (env: NodeJS.ProcessEnv) => (env[name] ?? '').trim() !== '';

imports: [ConditionalModule.registerWhen(DiscordModule, isSet('DISCORD_BOT_TOKEN'))],
providers: [{
  provide: MessagingGateway,
  useFactory: (...strategies) => new MessagingGateway(strategies.filter(Boolean)),
  inject: [{ token: DiscordStrategy, optional: true }],
}],
```

- A module not loaded does not connect anywhere and its config is not validated.
- Fail at startup if a required minimum is missing (e.g. no channel at all).
- Pass a **predicate** to `registerWhen`, never the variable name as a
  string: the string form loads the module when the variable is unset (it
  only checks `!== 'false'`).
- The decision is taken once, when the env is loaded: changing it needs a
  restart. Tests of both cases must re-import the module (`vi.resetModules()`).
