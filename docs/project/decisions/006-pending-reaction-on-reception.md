# 006: Show 🕓 as soon as a receipt is received

Date: 2026-11-20 · Status: accepted

## Context

Extraction takes seconds; without feedback the user does not know the
receipt was taken into account.

## Decision

`RECEIVED`, `AWAITING_VALIDATION` and `PENDING_MATCH` all show `PENDING` (🕓).
The ticket stores the reaction actually displayed (`displayedReaction`);
`TicketReactionService.syncReaction()` sends the expected one only when it
differs, then saves it.

## Consequences

- Safe to retry: syncing an up-to-date reaction does nothing.
- If sending the reaction fails, the flow stops before extraction (the
  ticket stays `RECEIVED`): see open questions.
