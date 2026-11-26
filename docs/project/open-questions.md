# Open questions and known gaps

Settle these before building on them; turn a settled point into a decision record.

## To decide

- **How the user follows a ticket: reactions, replies, edits, or a mix?**
  Today: no reaction until the import, the recap edited with the outcome,
  then 🕓 → ✅ / ⚠️ on the user's message; a failed reading is told by a
  reply with its reason, plus ❌. To check against WhatsApp: a reply within
  24 h of the user's message is free, anything later (the bank match comes
  days later) needs a paid template, a reaction included (to verify); a sent
  message cannot be edited. Options: keep reactions on Discord only; replies
  during the flow, nothing per ticket afterwards (a periodic summary?).
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

## Product (later)

To validate with users before building.

- **Pricing** (saas edition). AI cost per receipt with Large 4 at `low`:
  ~0.003 to 0.005 €, ~0.01 € with 500 suppliers (the list is sent with each
  receipt). Ideas: independent 5 €/month for 100 receipts (yearly payment
  to absorb the fixed card fees); SMB 20 €/month capped at 2 500 is at a
  loss at the cap with many suppliers: lower the cap (1 000), raise the
  price, or price per employee. Sending the supplier list before the file
  would let Mistral cache it (cached input 10× cheaper, conditions to check).
- **Accounting firms**, likely the main customer: many client files (one
  company and one Pennylane token each, check whether Pennylane offers a
  firm-level access), invoices received in batches, no chatting with a bot
  per invoice. Priced per client file and per month, with volume tiers.
  Pennylane already has a collection email address and OCR: our value must
  be less review work. To ask 3 to 5 firms: how they receive invoices, what
  costs them time in Pennylane, what they would pay per file.
- **Batch inputs**, useful to everyone: an email address per company
  (inbound email service, one ticket per attachment; "one receipt per
  message" stays a messaging rule) and a web upload of several files.
- **Review by exception**: "safe" invoices go to Pennylane without a click
  (supplier matched by VAT number or SIREN, consistent amounts, known VAT
  rate), the others wait in a list validated in bulk. Needs a web app with
  authentication and an automatic validation in the lifecycle.
