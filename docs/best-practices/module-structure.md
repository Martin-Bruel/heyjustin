# Module structure

## Modules by capability

One Nest module per business capability (`tickets`, `users`) or technical
capability (`messaging`, `prisma`). Module folders are named after what they
manage: plural for a collection of entities (`tickets/`, `users/`), the domain
name otherwise (`messaging/`, `prisma/`).

## Role folders, plural

Inside a module, files are grouped by role, folder names in the **plural**:

```
src/<module>/
├── controllers/    # HTTP entry points (@Controller)
├── handlers/       # non-HTTP entry points: messages, events
├── services/       # business flows, one service per use case
├── repositories/   # persistence (+ row mappers)
├── models/         # entities, value objects, state machines
├── errors/         # business errors of the module
├── index.ts        # public API
└── <module>.module.ts
```

Only create the folders a module needs. A small technical module may have no
role folder at all. A folder per provider is fine inside a technical module
(`messaging/discord/`).

File names are singular, kebab-case, suffixed by their role:
`ticket.repository.ts`, `receive-ticket.service.ts`, `ticket-message.handler.ts`.

## `index.ts` is the public API

Each module has an `index.ts` exporting what other modules may use (its Nest
module, the services and types meant for others). Everything else is internal.

- Other modules import **only** from `index.js`: `import { UserRepository } from '../users/index.js'`.
- Inside a module, import files directly (`./repositories/user.repository.js`), **never** the
  module's own `index.ts`: it creates import cycles.
- With ESM (`"module": "nodenext"`), write `../users/index.js`: directory imports
  are not allowed.
- One `index.ts` per module, not per folder: folder barrels add files without
  protecting anything.

**Why:** it makes the public surface explicit and a deep import visibly
wrong in review. It is a convention, not enforced: to enforce it, add
dependency-cruiser with a rule "an import into `src/<module>/` from another
module must target `index.ts`" (ESLint/oxlint `no-restricted-imports` cannot
express it generically, it matches import strings, not resolved paths).

## Dependency direction

Dependencies between modules form a graph without cycles, pointing from
business modules to technical ones:

```
tickets ──▶ users ──▶ messaging
   │          │
   └──────────┴─────▶ prisma
```

- A technical module (`messaging`, `prisma`) never imports a business module.
- When a lower module must call a higher one (e.g. deliver a received message),
  the higher one **subscribes** with a callback (`gateway.onMessage(handler)`):
  the dependency keeps pointing down.
- If two modules import each other, the split is wrong: do not reach for
  `forwardRef`, move the shared part down or invert with a subscription.

## Shared concepts have an owner

A type used by several modules (e.g. `Channel`) is defined in the module that
owns the concept (`messaging`) and imported from its `index.ts`. Avoid a
`shared/` folder: it becomes a dumping ground coupling every module. Create a
shared kernel only for a real concept with no natural owner (e.g. `Money`).
