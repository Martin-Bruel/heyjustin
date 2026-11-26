# Domain

## What the product does

Employees of a company send photos or PDFs of their receipts to a bot on a
messaging app. The bot reads the receipt with AI, asks the employee to
validate the recap, imports the invoice into Pennylane (the company's
accounting software), then follows its matching with a bank transaction. The
employee sees the progress through a reaction on their message.

## Vocabulary

| Term | Meaning |
|---|---|
| **Company** | A customer of the product, with its Pennylane account. |
| **User** | An employee sending receipts. Belongs to one company, talks to us on **exactly one channel**. |
| **Channel** | The messaging app (`WHATSAPP`, `DISCORD`). Owned by the `messaging` module. |
| **External id** | The user on their channel: phone number on WhatsApp (`33612345678`), user id on Discord. |
| **Ticket** | One receipt sent by a user, followed from reception to accounting. |
| **Source message** | The user's message carrying the receipt: channel + message id. Idempotency key, target of reactions and replies. |
| **Extraction** | What the AI read on the receipt: supplier (name, VAT number and SIREN if printed, the matched Pennylane supplier if any), date, total (VAT included) and VAT in cents, VAT rate in basis points (if printed), currency. Owned by the `receipts` module. |
| **Recap** | The message showing the extraction, with *Validate* / *Cancel* buttons. |
| **Reaction** | The emoji put on the source message to show the ticket progress. |

User-facing texts are in English, with day-first dates (en-GB format).

## Ticket lifecycle

```
RECEIVED ──recordExtraction──▶ AWAITING_VALIDATION ──startImport──▶ IMPORTING ──recordPennylaneImport──▶ PENDING_MATCH
  │                               │                                  │                                     │
  ├──markAsDuplicate──▶ DUPLICATE  ├──cancel──▶ CANCELLED             │ recordImportSupplier (stays)        ├──matchTransaction──▶ MATCHED
  └──fail──▶ FAILED ◀─────────────┴──────────────────────────────────┘ (fail)                              └──requireManualMatching──▶ MANUAL
```

| Status | Meaning | Data | Reaction |
|---|---|---|---|
| `RECEIVED` | File stored, extraction in progress | — | — ("is typing…") |
| `AWAITING_VALIDATION` | Recap sent, waiting for the user | extraction | — (the recap) |
| `IMPORTING` | Validated, Pennylane import in progress | extraction, Pennylane supplier id once it exists | — (the recap) |
| `PENDING_MATCH` | Imported in Pennylane, bank transaction not there yet | extraction, Pennylane supplier + invoice ids | 🕓 |
| `MATCHED` | Matched with a bank transaction (final) | + transaction id | ✅ |
| `MANUAL` | No transaction found, to match by hand in Pennylane (final) | extraction, Pennylane ids | ⚠️ |
| `FAILED` | Processing failed, the user must send it again (final) | reason, extraction if it got that far | ❌ |
| `CANCELLED` | The user rejected the recap (final) | extraction | 🚫 |
| `DUPLICATE` | Already sent before (final) | — | 🔁 |

Source of truth in code: `tickets/models/ticket-state.ts` (data per status),
`ticket-transitions.ts` (allowed transitions), `reaction.ts` (reaction per status).
No reaction before the import: the conversation shows the progress
([decision 014](decisions/014-no-reaction-before-import.md)).

## Receiving a receipt (implemented)

1. A user sends a message on their channel. `messaging` normalizes it.
2. `users` identifies the sender from (channel, external id); unknown senders
   are dropped there.
3. `tickets` keeps messages with an image or PDF. Several receipts in one
   message: none is processed, the user is asked to send one per message.
   A format Pennylane refuses (HEIC, WebP…): the user is asked for a JPEG,
   PNG or PDF.
4. The file is downloaded, the ticket is created `RECEIVED` with its file;
   the user sees "is typing…" until the recap (best-effort).
5. The company's Pennylane suppliers are listed (no token or Pennylane
   down → `FAILED`, ❌).
6. Extraction, one AI call with the file and the suppliers
   ([decision 010](decisions/010-ai-extraction.md)); the receipt is attached
   to an existing supplier or marked as new
   ([decision 012](decisions/012-supplier-matching.md)): success →
   `AWAITING_VALIDATION` and the recap is sent as a reply; failure or
   rejection → `FAILED` with the reason, told as a reply (which also ends
   "is typing…"), then ❌ is shown.

Rejected for now: credit notes and refunds, several VAT rates on one
receipt, several receipts in one document, missing or unreadable fields.

A message already turned into a ticket (same source message) is ignored.

## Validating a receipt (implemented)

[Decision 013](decisions/013-pennylane-import.md).

1. The user clicks *Validate* or *Cancel* on the recap. `messaging`
   acknowledges the click and normalizes it, `users` identifies the sender.
2. `tickets` ignores a click on another user's ticket, or on a ticket no
   longer `AWAITING_VALIDATION` (the new status is saved only if it still is:
   a double click imports once).
3. *Cancel* → `CANCELLED`, 🚫, the recap says so.
4. *Validate* → `IMPORTING`, the recap loses its buttons ("Importing…"), then:
   the supplier is created in Pennylane if new (its id saved at once), the
   file is uploaded, the supplier invoice is imported with the ticket id as
   `external_reference` (a non-French or missing VAT rate: imported as
   incomplete). Success → `PENDING_MATCH`, the recap says "Imported", 🕓 is shown;
   failure → `FAILED` with the reason, ❌, the recap asks to send it again.

## Modules

```
src/
├── messaging/   # generic transport: gateway + one strategy per app (discord/). Owns Channel.
├── users/       # users and their channel; identifies senders (UserMessagesService)
├── companies/   # companies and their secrets (Pennylane token, encrypted)
├── tickets/     # the ticket lifecycle, from reception to the Pennylane import
├── receipts/    # what a receipt is and how it is read: schema, prompt, rules. Owns Extraction.
├── ai/          # language models (@nestjs/ai): provider by config, generic document reading, no business
├── pennylane/   # Pennylane API v2 client: suppliers, files, invoices; token passed per call, no business
├── logging/     # JSON logger, per-flow log context, identifier hashing
└── prisma/      # database client
```

Dependencies: `tickets → users → messaging`, `tickets → receipts → ai`,
`tickets → companies`, `tickets → pennylane`, everyone → `prisma`. Each module
exposes its public API in `index.ts`.

## Channels

| Channel | Inbound | Status |
|---|---|---|
| Discord | Bot connected to the Discord Gateway (websocket), direct messages | Implemented |
| WhatsApp | Meta webhook (HTTP, signature guard), one media per message | Not yet |

## Environment

Every variable is listed and explained in
[`apps/back/.env.example`](../../apps/back/.env.example); copy it to `.env`.
Each module validates its own variables at startup. Messaging channels are
loaded only when configured (at least one is required).

`HEYJUSTIN_EDITION` picks the edition ([decision 015](decisions/015-editions.md)):
`self-hosted` (default, the open-source app: AI provider and model chosen
with `AI_PROVIDER` and `AI_EXTRACTION_MODEL`, at the model's default
reasoning; `PENNYLANE_API_TOKEN` creates a default company,
[decision 011](decisions/011-pennylane-api-token.md)) or `saas` (our
service: Mistral Large 4 at low reasoning, fixed in code; those variables
are refused). Pennylane tokens are per company, stored encrypted with
`SECRETS_ENCRYPTION_KEY`.
