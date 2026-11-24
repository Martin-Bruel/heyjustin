# 009: Validated config per module, channels loaded only when configured

Date: 2026-11-23 · Status: accepted

## Context

Configuration was read with string keys in four places (and `process.env`
in one); a missing variable was only noticed when used, e.g. at the first
unknown sender for `LOG_HASH_SECRET`. A self-hosted install should be able to
enable only the messaging apps it uses.

## Decision

- One validated, typed config namespace per module (`app`, `prisma`,
  `logging`, `discord`), zod schemas, registered with `ConfigModule.forFeature`.
  The app does not start when a variable is missing or invalid.
- Each messaging channel is its own module, loaded with
  `ConditionalModule.registerWhen` only when its variable is set; the gateway
  receives the strategies of the loaded channels and the app refuses to start
  without at least one.
- `LOG_HASH_SECRET` is now required at startup (at least 32 characters).
- `.env.example` documents every variable.

## Consequences

- Enabling a channel = setting its variables; no code change per install.
- Changing the enabled channels needs a restart.
- Adding a channel = a module + one `registerWhen` + one optional entry in the
  gateway factory's `inject`.
