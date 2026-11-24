# Domain modeling

## Entities: classes with behavior, no framework

- Entities are TypeScript classes with **no decorator** (no ORM, no Swagger,
  no class-validator). They are not Nest providers.
- Private constructor + two factories:
  - `create()`: a new entity, applies defaults and business rules;
  - `restore()`: rebuilds from storage, no business validation.
- Fields that never change are `readonly`; mutable state is `private` and
  exposed through getters. Only methods change it.
- DTOs and read models (data without rules) can be plain types.

## State that depends on a status: discriminated union

When the data available depends on the status, model the state as a
discriminated union instead of nullable fields:

```ts
type TicketState =
  | { status: 'RECEIVED' }
  | { status: 'AWAITING_VALIDATION'; extraction: Extraction }
  | { status: 'MATCHED'; extraction: Extraction; pennylane: PennylaneInfo; transactionId: string };

type TicketStatus = TicketState['status'];
type TicketStateOf<S extends TicketStatus> = Extract<TicketState, { status: S }>;
```

Data present in every status stays on the entity; status-dependent data goes
in `state`. **Why:** an inconsistent entity (MATCHED without a transaction)
cannot be written, and after `if (state.status === 'MATCHED')` TypeScript knows
which fields exist. No `!` needed.

Prefer this over a class per status (inheritance): an object cannot change
class, so every transition must return a new instance, and a non-tree
lifecycle (shared data across siblings) makes the hierarchy awkward.

## Transitions: a declarative table

Declare which statuses each transition may start from in one table, named
after the entity methods:

```ts
export const TICKET_TRANSITIONS = {
  recordExtraction: ['RECEIVED'],
  fail: ['RECEIVED', 'AWAITING_VALIDATION'],
} as const satisfies Record<string, readonly TicketStatus[]>;
```

One private guard checks the table and returns the state narrowed to the
allowed sources, so each method gets typed data:

```ts
fail(reason: string) {
  const state = this.assertTransitionAllowed('fail'); // RECEIVED | AWAITING_VALIDATION
  this._state = { status: 'FAILED', reason, extraction: state.status === 'RECEIVED' ? null : state.extraction };
}
```

- Method names are explicit verbs (`recordExtraction`, `matchTransaction`,
  `requireManualMatching`), not past participles (`extracted`) that read like booleans.
- Adding a source status to the table widens the state type: TypeScript
  points at what the method must now handle.
- A heavier state-machine library (XState) is not worth it for a persisted
  entity.

## Exhaustive tables instead of `switch`

Map a union to values with a typed record, not a `switch`:

```ts
const REACTION_BY_STATUS = { RECEIVED: 'PENDING', /* ... */ } as const
  satisfies Record<TicketStatus, Reaction | null>;
```

Adding a member to the union fails to compile until the table is completed.
The same works for builders: `{ [S in Status]: (row) => StateOf<S> }`.
Use `switch` with a `never` default only when a table does not fit.

## Value objects

Group values that only make sense together into an immutable class, with
validation in the constructor and `equals()` when compared:

- `Extraction` (supplier, date, amounts, currency): validates VAT ≤ total;
- `SourceMessage` (channel + message id): an id is meaningless without its channel.

**Why:** fields cannot be half-set, rules live in one place, names say what
the pair means (`ticket.source.channel` rather than `ticket.channel`).

## Errors

- Business errors: one class per error in the module's `errors/` folder,
  never `HttpException`. Translate them to HTTP in an exception filter.
- Infrastructure errors (e.g. an inconsistent database row) live next to the
  code that throws them (`repositories/`), not in `errors/`.
- Avoid the non-null assertion `!`: it is erased at runtime. Narrow with a
  check and throw an explicit error instead.
