# 007: No port/adapter layer

Date: 2026-11-20 · Status: accepted

## Context

The first version had abstract ports for the ticket repository, the user lookup,
the messenger and the AI extractor, each with an adapter.

## Decision

Use dependencies directly through concrete classes: `TicketRepository`
injects Prisma, internal modules are used through their `index.ts`, and AI
goes through `@nestjs/ai` (official NestJS package on the Vercel AI SDK),
which already abstracts the provider. The only strategy pattern left is in
`messaging`, where several apps really coexist.

## Consequences

- Less code and wiring; services still only see domain objects.
- Test fakes for classes with private fields are plain objects checked with
  `satisfies Record<keyof X, unknown>`.
- `@nestjs/ai` was at 0.0.2 when chosen (published Nov 2026): its API may change.
