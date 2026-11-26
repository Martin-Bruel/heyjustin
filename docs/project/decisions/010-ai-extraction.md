# 010: AI extraction in one call, provider chosen by config

Date: 2026-11-24 · Status: accepted

## Context

Receipts (images, PDF) must be read into an `Extraction`. `@nestjs/ai`
(0.0.2, unstable, chosen in 007) gives structured output validated by a zod
schema, retries, timeouts and usage events on top of the AI SDK. We want to
change provider without code changes, and self-hosted installs may want a
local model.

## Decision

- **One AI call per receipt**: the file is sent as is (no OCR on our side)
  with a system prompt and a schema; `generateObject` returns a
  `ReceiptReading`. No multi-step pipeline until measurements show a need.
- **The AI reports facts, the code decides**: `ReceiptReading` (amounts in
  currency units, nullable fields, `documentKind`, `receiptCount`,
  `vatRates`) is kept apart from `Extraction`; `toExtraction` applies the
  rules and converts to cents.
- **Rejected for now**: credit notes and refunds (`credit_note`, negative
  amounts), several distinct VAT rates, several receipts in one document,
  any missing or unreadable field, a date after tomorrow.
- **Three modules, `tickets → receipts → ai`**:
  - `ai` is technical: providers, config, and a generic
    `DocumentReaderService.read({ document, schema, instructions })` that
    owns the attachment, the settings and the failure mapping
    (`DocumentReadError` with fixed reasons). It knows nothing of receipts
    and does not export the raw `AiService`. Models are named by role
    (`AI_MODELS.extraction`).
  - `receipts` is the business of a receipt: schema, prompt, the rules
    (`toExtraction`) and `Extraction`. Stateless, never imports `tickets`
    (it reads any document, e.g. a `TicketFile`).
  - `tickets` keeps the lifecycle: it calls `ReceiptReaderService.read(file)`.
  Prompts and schemas never go into `ai`: each new AI use would add its
  business to a technical module.
- **Provider by config**: `AI_PROVIDER` (`mistral` | `openai-compatible`),
  `AI_API_KEY`, `AI_BASE_URL`, `AI_EXTRACTION_MODEL`. Since
  [015](015-editions.md), only in the self-hosted edition: the saas fixes
  Mistral Large 4 at low reasoning. Every supported SDK is
  installed (small HTTP clients, like the messaging SDKs); one is used per
  install. Keys are passed explicitly, never read from the SDKs' own env
  variables. No AI gateway: receipts would go through one more third party.
- **Default: Mistral Large 4** (`mistral-large-4`, pinned, not `-latest`):
  multimodal, structured output, $0.7 / $2.1 per million tokens (Nov 2026).
  It reasons before answering and the reasoning counts in `maxOutputTokens`:
  set to `reasoningEffort: 'low'`, the least Large 4 accepts (`none` is
  refused; Small 4 accepts only `none` or `high`). Since
  [015](015-editions.md): `low` in the saas edition only, the model's
  default when self-hosted, with 10 000 output tokens. No setting per model,
  to keep the config simple. At `low`, Large 4 still spends 700 to 1 400 output
  tokens on any receipt, a clean PDF as much as a blurry photo: ~0.003 to
  0.005 $ per receipt. A prompt line asking to think only about hard fields
  was tried and removed: no effect on a clean PDF (833 → 855).
  Medium 3.5 is deprecated; Mistral OCR is a separate API outside the AI SDK,
  kept as a fallback idea if reading quality is poor.
- **Privacy**: the model's answer is logged at debug only (it holds the
  receipt's data). Failure reasons are fixed texts (`DocumentReadError`),
  never the model's answer nor the provider's message. At error level, a
  provider failure keeps only its status, endpoint and an allow-list of its
  error body (`type`, `code`, `message` truncated to 300 characters); the
  whole body goes to debug, minus its `input` fields. The SDK's own messages
  are never logged: they quote the answer (`Value: {...}`).
- **Two logs for one failed reading, on purpose** (an exception to "one
  error, one log" of logging.md): `ai.document.read_failed` /
  `ai.document.invalid_answer` is the technical incident, with the provider's
  details only `ai` can read; `ticket.extraction.failed` is the business
  outcome (the ticket becomes `FAILED`), with the ticket's log context. They
  answer different questions (is the provider healthy? how many receipts
  fail?).

## Consequences

- A new AI use (another document type) = a schema and a prompt in its own
  module, calling `DocumentReaderService`; no change in `ai`.
- Adding a provider = its `@ai-sdk/*` package, a literal in `AI_PROVIDERS`,
  a case in `ai-providers.ts` (the switch is exhaustive).
- Changing provider or model by config does not guarantee the same accuracy:
  check it on real receipts first (no evaluation set yet).
- Retries (3 attempts) and a 60 s timeout per attempt can delay the recap.
- `@nestjs/ai` 0.0.x: its API may change on upgrade.
