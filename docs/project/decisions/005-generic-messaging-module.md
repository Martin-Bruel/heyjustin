# 005: A generic messaging module with one strategy per app

Date: 2026-11-20 · Status: accepted

## Context

The product must not depend on WhatsApp: a self-hosted install may prefer
Discord, Slack or Telegram, and a hosted one may serve several at once.

## Decision

- `messaging` is a transport knowing channels, never tickets: a
  `MessagingGateway` routes each call to the `ChannelStrategy` of the channel.
- Provider-neutral types: `IncomingMessage`, `OutgoingMessage` (text, reply-to,
  buttons), `ReactionUpdate` (emoji), attachments downloaded through the gateway.
- `tickets` formats its own content (`ticket-messages.ts`: emoji per reaction,
  English recap, button ids `ticket:<validate|cancel>:<ticketId>`) in
  `TicketNotifierService`, and receives messages in `TicketMessageHandler`.
- Discord: bot on the Gateway, direct messages only (no privileged intent),
  previous bot reaction removed before adding the new one. WhatsApp: to do,
  as a webhook controller + signature guard inside `messaging/whatsapp/`.

## Consequences

- Adding an app touches `messaging/` only.
- Button ids are shared by every channel; the click handling (scenario 2) is
  still to build.
