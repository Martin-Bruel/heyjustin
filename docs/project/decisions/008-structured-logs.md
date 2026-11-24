# 008: Structured logs for Grafana, with a context per message

Date: 2026-11-23 · Status: accepted

## Context

The app had a single log line. Logs must be consumable by Grafana (Loki):
filter by ticket or company, count failures, measure AI latency.

## Decision

- Nest's built-in `ConsoleLogger`, extended once (`AppLogger`), on stdout
  only (no log file: Loki reads the container logs). JSON in production
  (params at the root, context fields added, `log` level printed as `info`),
  Nest's readable format elsewhere (fields of the log only). Same redaction of personal identifiers and file contents in
  both. No extra logging library.
- Every log carries a stable `event` name, from one constant per module
  (`messaging-log-events.ts`, `user-log-events.ts`, `ticket-log-events.ts`).
- Automatic context with nestjs-cls: `MessagingGateway` opens one context per
  received message (`channel`, `messageId`); `users` adds `userId`,
  `companyId`; `tickets` adds `ticketId` once the ticket exists. Typed in
  `logging/log-context.ts`: the flow is opened with a `FlowContext` (only
  `MessageFlow` today: `flow: 'message'`, `channel`, `messageId`), services
  add `FlowEnrichment` fields. A click on a recap button (scenario 2) will
  add an `InteractionFlow` member.
  `ClsService.run()` is used instead of `@UseCls()`, which needs an
  initialized Nest app and breaks unit tests.
- Unknown senders are logged as an HMAC pseudonym (`senderHash`, secret
  `LOG_HASH_SECRET`), never in clear. Extraction content is `debug` only.
- Unhandled errors of a message flow are logged once, by the gateway
  (`messaging.message.handler_failed`), with the context fields. No separate
  events for notification failures or inconsistent rows: they arrive there.

## Consequences

- nestjs-cls is a dependency; it will also serve transactions
  (`@nestjs-cls/transactional` with Prisma) and HTTP request contexts later.
- The event catalog is part of the contract with dashboards: renaming an
  event is a breaking change.
