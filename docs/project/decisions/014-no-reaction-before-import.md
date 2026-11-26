# 014: No reaction before the import, a processing indicator while reading

Date: 2026-11-26 · Status: accepted · Supersedes [006](006-pending-reaction-on-reception.md)

## Context

006 showed 🕓 from reception to the bank match, so the user knew the receipt
was taken into account while the AI read it. Since then the recap shows
every step until the import ("Importing…", "Imported", "Cancelled", "Not
imported"): 🕓 said the same thing twice, and meant three things (reading,
awaiting validation, awaiting the bank). A failed reaction at reception also
stopped the flow before extraction.

## Decision

- **No reaction while `RECEIVED`, `AWAITING_VALIDATION` and `IMPORTING`**: the
  conversation shows the progress.
- **🕓 only for `PENDING_MATCH`**: in Pennylane, waiting for the bank
  transaction. The final reactions are unchanged (✅ ⚠️ ❌ 🚫 🔁).
- **While the AI reads, a processing indicator**, each app its own way:
  `ChannelStrategy.showProcessing(target, signal)`, shown until the signal
  aborts (the extraction ended) or our next message.
  - Discord: "is typing…" (`sendTyping`, 10 s), refreshed every 8 s, 2 min at most;
  - WhatsApp (later): the typing indicator of the Cloud API, which also
    marks the message as read;
  - Slack (later): no typing for bots; an assistant status or a 👀 reaction.
- **Best-effort**: a failed indicator is logged
  (`ticket.processing.not_shown`), the flow goes on.

## Consequences

- Nothing on the user's message until the import: a recap that fails to be
  sent leaves the user with no sign at all (open question "Recap failure").
- Reactions are sent only at the end of a step (failed, cancelled, imported,
  matched); a failed reaction no longer stops a flow before its work.
