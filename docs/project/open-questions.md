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
- **Reaction failure:** reactions are sent at the end of a step only
  (decision 014); a failed one leaves the ticket saved with an outdated
  `displayedReaction`, never retried. A job resyncing them?
- **Recap failure:** if sending the recap fails, the ticket stays
  `AWAITING_VALIDATION` without a recap. Retry strategy to define.

## Not built yet

- Extraction accuracy is not measured: no evaluation set of real receipts
  yet. Needed before changing the model, the provider or the prompt.
- AI cost is not reported: no `pricing` on the models (tokens are logged).
- Subscriptions will have to cap the AI tokens per company (or the number
  of receipts): ~0.003 to 0.005 $ per receipt with Large 4 at `low`,
  whatever the document, more with a long supplier list. A fixed cost per
  page (Mistral Document AI) is an option if it becomes an issue.
- Several VAT rates and credit notes are rejected (decision 010).
- With `openai-compatible`, PDF support depends on the server: Mistral reads
  images and PDF, many local servers only images.
- The matching cron: follow `PENDING_MATCH` tickets until their bank
  transaction (`MATCHED`), or `MANUAL` after a delay. The user is done once
  they validate: a card payment reaches Pennylane days later (bank, then
  Pennylane's bank sync). Delay to choose: with a deferred debit card the
  transaction may appear only at the end of the month, so 30 days may be too
  short (45? per company?).
- A failed import is not retried: the user sends the receipt again (and the
  AI reads it again).
- Supplier matching accuracy is not measured (only `supplierMatched` is
  logged): to check on real receipts, with the evaluation set.
- Enrich new suppliers (improvement): Pennylane's web app finds a company
  in its directory and fills its identifiers (easyJet: VAT number…), its
  API v2 does not. Ours are created with the name and the identifiers read
  on the receipt only. Options: the API Recherche d'entreprises
  (recherche-entreprises.api.gouv.fr: free, French companies only, by name →
  SIREN/SIRET), keeping only unambiguous results (one match, same name or
  postcode); or check whether Pennylane enriches a supplier created with a
  `reg_no`.
- An expired Pennylane token (401): how the company is told.
- WhatsApp strategy (webhook controller, signature guard, `rawBody: true`).
- User onboarding: users are inserted by hand today.
- Channel selection per install (self-hosting).
- Stuck tickets recovery: a ticket left `RECEIVED` or `IMPORTING` after a
  restart is never resumed (the import is safe to run again, decision 013).
- Ticket ids are UUID v4 (`randomUUID`), while Prisma defaults to v7.
- Authentication, before any HTTP API.
