# 001: Ticket state as a discriminated union with a transition table

Date: 2026-11-20 · Status: accepted

## Context

A ticket carries different data depending on its status (no extraction when
received, Pennylane ids once imported, a transaction once matched). Nullable
fields allowed inconsistent tickets, and some transitions start from several
statuses (a ticket can fail before or after extraction).

## Decision

- `Ticket` holds the data present in every status; the rest lives in
  `state: TicketState`, a union with one variant per status.
- Allowed transitions are declared in `TICKET_TRANSITIONS`, keyed by the
  method name (`recordExtraction`, `fail`…); one guard checks it and returns
  the narrowed state.
- Not chosen: one class per status (an object cannot change class, the
  lifecycle is not a tree), XState (too heavy for a persisted entity).

## Consequences

- Inconsistent tickets cannot be built; a new path is one line in the table.
- The database stays flat; the Prisma mapper rebuilds the union and rejects
  inconsistent rows.
