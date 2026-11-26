# 013: The validated receipt is imported through an IMPORTING status

Date: 2026-11-26 · Status: accepted

Adds a status to the lifecycle of [001](001-ticket-state-machine.md); the
mechanism of 001 is unchanged.

## Context

A click on *Validate* starts three Pennylane writes: the supplier (when
new), the file, then the supplier invoice. They take a few seconds, can fail
in the middle, and the user can click twice (or Validate, then Cancel).
Checked against the Pennylane sandbox
(`test/pennylane/pennylane.e2e-spec.ts`, `npm run test:e2e`):

- a second import with the same `external_reference` is refused (422
  "External reference has already been taken");
- an invoice is found back with a filter on `external_reference`;
- `vat_rate: mixed` with `import_as_incomplete` is accepted, the invoice
  arrives with `accounting_status: validation_needed` (`complete` otherwise).

## Decision

- **`IMPORTING` status** between `AWAITING_VALIDATION` and `PENDING_MATCH`
  (reaction 🕓). It carries the extraction and `supplierId`, set once the
  supplier exists.
- **One answer per ticket**: the new status is saved only if the ticket is
  still `AWAITING_VALIDATION` in the database (`saveIfStatus`, a conditional
  `UPDATE`). A second click is ignored.
- **Idempotent import** (`tickets/services/import-ticket.service.ts`):
  - the supplier id (matched, or just created) is saved before the file is
    sent: a retry does not create the supplier again;
  - the invoice carries the ticket id as `external_reference`; when Pennylane
    rejects the import, the invoice is looked up by that reference and reused
    if a previous attempt created it;
  - only the file may be uploaded twice (unattached, harmless).
- **VAT**: a French rate is sent as such; any other rate, or none printed, is
  sent as `mixed` with `import_as_incomplete` (the accountant completes it).
- **Failure**: the ticket becomes `FAILED` with the reason (❌); the user is
  asked to send the receipt again. No automatic retry yet.
- **The recap is rewritten**, without its buttons: "Importing…" at once, then
  the outcome (imported, cancelled, not imported and why). Best-effort: a
  failed edit is logged, the ticket goes on.
- **Files Pennylane refuses (HEIC, WebP…) are refused at reception**, before
  the AI call: the user is asked for a JPEG, PNG or PDF. No conversion.
- **Clicks reach tickets like messages**: messaging normalizes them
  (`ButtonClick`) and acknowledges them to the app (Discord wants it within
  3 s), users identifies the sender (`onUserClick`), each click runs in a
  `click` log context.

## Consequences

- A ticket left `IMPORTING` by a crash is not resumed yet: the import can be
  run again safely, but nothing triggers it (stuck tickets, open questions).
- A failed import costs the user a new upload, which reads the receipt again
  with the AI.
- WhatsApp cannot edit a sent message: its strategy will have to send the
  outcome as a new message.
