# Logging

Logs are meant to be queried (Loki/Grafana), not read line by line.

## stdout, readable in dev, JSON in production

- Logs go to stdout only, never to a file: in production an agent (Grafana
  Alloy, Promtail) reads the container logs and ships them to Loki. No file,
  no rotation to manage; the app knows nothing about Grafana.
- Two formats, from the environment: JSON when `NODE_ENV=production`, Nest's
  readable format otherwise.
- Readable format: only the fields passed to the log, to keep lines short.
  JSON: every field, including the flow context.
- Nest's `ConsoleLogger` does both: `json: true` + `flattenParams: true`
  (params at the root, not under `params`), and `redact` in both formats.
  Extend it once (`AppLogger`) and set it with `app.useLogger()`; classes
  keep `private readonly logger = new Logger(MyClass.name)`.
- Map Nest's `log` level to `info` in the JSON (Loki and Grafana expect it).
- Threshold from the environment: `NEST_LOG_LEVEL=">=log"` in production,
  `">=debug"` locally, `error` in tests.

## Every log is an event

```ts
this.logger.log('Ticket created', { event: TICKET_LOG_EVENTS.created, sizeBytes });
```

- `event`: a stable `domain.object.action` name (`ticket.extraction.failed`).
  Dashboards filter and count on it; the message text can change freely.
- Event names live in one constant per module (`<module>-log-events.ts`):
  a typo would silently break a dashboard.
- Measure external calls with `durationMs`.

## Levels

| Level | Use |
|---|---|
| `error` | Something failed and needs someone: an unhandled error, inconsistent data |
| `warn` | An expected failure handled by the business (e.g. extraction failed → ticket FAILED) |
| `info` (`log`) | A business step, once per step |
| `debug` | Details, off in production; also sensitive business data (amounts) |

## Automatic context per flow

Fields identifying the flow (ids of the message, user, entity…) are added to
every log automatically, through a context that follows the flow across
`await`s: nestjs-cls on Node's `AsyncLocalStorage`.

- Open the context once, at the entry point of a flow (`runInLogContext(fields, fn)`),
  then add fields as they become known (`assignLogContext({ ticketId })`).
- Use `ClsService.run()` rather than the `@UseCls()` decorator for classes
  built with `new` in tests: the decorator requires an initialized Nest app.
- Never use `Scope.REQUEST` for this: it does not apply to non-HTTP flows and
  propagates to every dependent provider.
- Explicit fields passed to a log win over context fields.
- The context is a closed, typed list in the logging module, not a
  `Record<string, unknown>`: one name per field across modules (dashboards
  and queries rely on it), and personal identifiers cannot slip in. Values
  are plain strings, so logging imports no type from the modules that depend
  on it. A new field is added to the types first.
  - **Opening**: a discriminated union, one member per kind of entry point
    (`FlowContext = MessageFlow | …`, discriminant `flow`), with the fields
    that entry point must provide. `runInLogContext` takes it, so an entry
    point cannot open a flow with missing fields; `flow` is a filter in Grafana.
  - **Enrichment**: one optional set shared by every flow (`FlowEnrichment`,
    taken by `assignLogContext`). It cannot depend on the kind of flow: a
    service does not know at compile time which flow it runs in (the context
    lives in AsyncLocalStorage, at runtime).

## Personal and sensitive data

- Never log file contents, tokens, keys, or personal identifiers in clear
  (phone numbers). Configure `redact` with these field names as a safety net
  for objects logged by mistake.
- `redact` does not apply to message texts: never interpolate personal data
  into a message (`` `Message from ${phone}` ``).
- To follow a person without knowing who it is, log an HMAC of the identifier
  with a secret key (`IdentifierHasher`). Not a plain hash: small spaces like
  phone numbers can be reversed by hashing them all.
- Business financial data (supplier, amounts): `debug` only.

## Errors

- Catch and log unhandled errors once, at the entry point of the flow
  (e.g. the messaging gateway), with the error as a structured field:
  `logger.error('Message handler failed', error, { event })`.
- Do not log and rethrow at every layer: one error, one log. The context
  fields already say where it happened.
