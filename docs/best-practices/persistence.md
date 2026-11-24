# Persistence

## Concrete repository + row mapper

- Data access goes through a **repository**: a concrete `@Injectable()` class
  injecting `PrismaService`, named `<Entity>Repository` in a `repositories/` folder.
  It takes and returns **domain objects only**: services never see a Prisma type.
- Conversions live in a mapper next to it (`ticket-row.mapper.ts`):
  `toRow(entity)` flattens, `toEntity(row)` rebuilds.
- Keep the table flat with nullable columns; the domain union decides which
  are filled. Do not mirror the union in the schema.
- The mapper **checks consistency** when reading: a row whose columns do not
  match its status throws a dedicated error (`InconsistentTicketRowError`)
  with the id, status and missing column. Value objects are rebuilt through
  their constructor so their validation runs on read too.
- Rebuild the state with one builder per status in an exhaustive table
  (see [domain-modeling.md](domain-modeling.md)), factoring shared groups of
  fields (`extracted(row)`, `imported(row)`).
- Several writes that belong together use a nested create (atomic) or a
  transaction (`add(ticket, file)`).
- Large data (files) is stored apart and loaded only when needed.
- A unique constraint is the real idempotency guarantee: a "find then create"
  check can race.

## Reads: CQRS-lite

Statistics, lists and dashboards do not go through the write repository:

- a dedicated read service/query counts or projects in SQL (`groupBy`);
- it returns plain objects, not entities;
- the business rule (what counts as success) stays in the model, as an
  exhaustive table; the query only returns raw counts.

**Why:** loading entities to count them is wasteful, and read methods would
bloat the write repository.

When statistics cross several modules, create a `reporting` module that uses
the modules' public services, or builds its own read model from events. It
never reads another module's tables.

## Migrations

- Generated migrations are fine for schema-only changes.
- When data must move (column to new table, backfill), write the SQL by hand:
  add nullable → backfill with `UPDATE` → set `NOT NULL` → drop the old column.
- Test it before applying: create a throwaway database, apply the previous
  migrations, insert sample rows, apply the new one, check the data, then run
  `prisma migrate diff --from-config-datasource --to-schema` against it: it
  must print an empty migration. Drop the database.
- A migration applied nowhere yet (not deployed, not committed) can be
  replaced instead of stacking a migration that undoes it.
- A new required column on an existing table needs a default or a backfill.
