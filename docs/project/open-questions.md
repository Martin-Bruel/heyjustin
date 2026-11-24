# Open questions and known gaps

Settle these before building on them; turn a settled point into a decision record.

## To decide

- **Does `MANUAL` count as a success?** The invoice is in Pennylane, only the
  bank matching is manual. Needed for statistics.
- **Duplicates:** postponed. Detection criterion to choose (same company,
  supplier, date and amount?) and whether `DUPLICATE` should keep a reference
  to the original ticket.
- **Files of final tickets:** the schema says files are deleted once a
  ticket is final; nothing does it yet.
- **Reaction failure:** a failed reaction stops the flow before extraction.
  Should reactions be best-effort (logged, retried later) instead?
- **Recap failure:** if sending the recap fails, the ticket stays
  `AWAITING_VALIDATION` without a recap. Retry strategy to define.

## Not built yet

- AI extraction (`InvoiceExtractorService` throws "not implemented") with
  `@nestjs/ai`: until then every receipt ends `FAILED` (❌).
- Scenario 2: handling the *Validate* / *Cancel* clicks
  (`parseValidationButtonId` is ready), then the Pennylane import and matching.
- WhatsApp strategy (webhook controller, signature guard, `rawBody: true`).
- User onboarding: users are inserted by hand today.
- Channel selection per install (self-hosting).
- Stuck tickets recovery: a ticket left `RECEIVED` after a restart is never resumed.
- Ticket ids are UUID v4 (`randomUUID`), while Prisma defaults to v7.
- Authentication, before any HTTP API.
