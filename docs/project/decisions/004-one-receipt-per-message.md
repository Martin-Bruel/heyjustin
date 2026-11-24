# 004: One receipt per message

Date: 2026-11-20 · Status: accepted

## Context

Discord allows up to 10 attachments in a message (WhatsApp sends one media
per message). The reaction targets the message, so several tickets on one
message would conflict on the reaction and on idempotency. Processing only
the first file silently lost the others.

## Decision

A message with several receipts (images or PDFs; other files do not count)
is not processed at all. The user is answered right away, as a reply:
*« Ce message contient N justificatifs. Envoie-les un par message pour que je puisse les traiter. »*

## Consequences

- Simple model: one ticket ↔ one source message.
- The answer may be sent twice if the same message is delivered twice (no
  ticket is created to deduplicate it); unlikely on the Discord Gateway.
- Revisit if users send batches often: one ticket per file would need the
  attachment id in the source message and a rule to aggregate reactions.
