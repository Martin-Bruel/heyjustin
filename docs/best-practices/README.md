# Best practices

Architecture and coding rules for a NestJS + TypeScript backend. They are not
specific to this product: copy this folder into a new project as is.

Project-specific knowledge (domain, decisions) lives in [`../project/`](../project/README.md).

| File | Covers |
|---|---|
| [module-structure.md](module-structure.md) | Modules, folders, file naming, public API (`index.ts`), dependency direction |
| [dependencies.md](dependencies.md) | When to abstract (and when not to), services, injection, naming of injected dependencies |
| [domain-modeling.md](domain-modeling.md) | Entities, state machines, value objects, exhaustive tables, errors |
| [persistence.md](persistence.md) | Repositories, row mappers, reads (CQRS-lite), migrations |
| [integrations.md](integrations.md) | Several providers for one capability (strategy + gateway), inbound entry points, webhooks |
| [config.md](config.md) | Validated, typed config per module; optional integrations loaded only when configured |
| [logging.md](logging.md) | Structured JSON logs for Grafana, events, levels, per-flow context, personal data |
| [testing.md](testing.md) | What to fake, how to fake classes, wiring checks |

Each rule states **why**, so it can be challenged when the context changes.
