# 002: A user talks to us on exactly one channel

Date: 2026-11-20 · Status: accepted · Supersedes the `UserIdentity` table (never deployed)

## Context

Supporting several messaging apps needed a way to identify users per app.
A `UserIdentity (channel, externalId)` table allowed several channels per user.

## Decision

- One user = one channel: `User.channel` + `User.externalId`, unique together.
- The ticket keeps its `SourceMessage` (channel + message id) rather than
  relying on the user's current channel.
- Replies go to the user found from `ticket.userId`; there is no sender id
  stored on the ticket.

## Consequences

- Simple schema, no identity table.
- If a user changes channel, their old tickets can no longer be notified:
  `TicketRecipientUnavailableError` is thrown instead of sending a reaction to
  a message id that does not exist on the new channel.
