# heyjustin backend

Receipts sent to a bot on a messaging app (Discord today) → AI extraction →
validation by the user → Pennylane. NestJS, Prisma, PostgreSQL.

Domain, modules and decisions: [`docs/project/`](../../docs/project/README.md).
Coding rules: [`docs/best-practices/`](../../docs/best-practices/README.md).

## Run locally

```bash
docker compose up -d          # from the repo root: PostgreSQL
cp .env.example .env          # then fill it in (see the comments)
npm install                   # also generates the Prisma client
npm run prisma:deploy         # applies the migrations
npm run start:dev
```

Users are inserted by hand for now (one `Company`, one `User` with its
`channel` and `externalId`, e.g. the Discord user id).

## Checks

```bash
npx prettier --write src
npx oxlint src
npx tsc --noEmit -p .
npx vitest run src
```

`NODE_ENV=production` switches logs to JSON (for Loki/Grafana).
