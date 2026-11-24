# heyjustin

Receipts sent on a messaging app → AI extraction → validation by the user →
Pennylane. Backend: NestJS in `apps/back`, Prisma + PostgreSQL (`docker-compose.yaml`).

## Read before implementing

- Generic architecture and coding rules: [docs/best-practices/](docs/best-practices/README.md).
  Follow them for any new file; if a change needs to break one, say so and why.
- Domain, ticket lifecycle, modules: [docs/project/domain.md](docs/project/domain.md).
- Past decisions: [docs/project/decisions/](docs/project/decisions/). Do not
  reopen one silently: propose a new record that supersedes it.
- Undecided points: [docs/project/open-questions.md](docs/project/open-questions.md).
  Ask before building on one.

## Working agreement

- Code, comments, docs and texts sent to users in English.
- Before a structural change (new module or folder, migration, moving files),
  present the plan and the list of files first.
- After changes in `apps/back`: `npx prettier --write`, `npx oxlint src`,
  `npx tsc --noEmit -p .`, `npx vitest run src`.
- Data migrations are hand-written and tested on a throwaway database
  ([persistence.md](docs/best-practices/persistence.md#migrations)).
- When a decision is taken or a question settled, update `docs/project/`.
