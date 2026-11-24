# 003: Unknown senders are dropped in the users module

Date: 2026-11-20 · Status: accepted

## Context

Messages from people not registered must be ignored, never answered. The
check was duplicated in the ticket handler and the ticket service.

## Decision

`UserMessagesService.onUserMessage((message, sender) => …)` in `users`
subscribes to the messaging gateway, identifies the sender and only relays
registered users. Business modules subscribe there.

Not in `messaging`: it would make the transport depend on users (cycle, since
users uses `Channel`), and a future onboarding module must still be able to
receive messages from unknown senders through the gateway directly.

## Consequences

- One place for the rule; services receive an identified `User`.
- One user lookup per received message, even plain text.
