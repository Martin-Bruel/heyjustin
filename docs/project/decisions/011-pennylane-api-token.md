# 011: Pennylane through the API v2, one company token per company

Date: 2026-11-25 · Status: accepted

## Context

Validated receipts must become supplier invoices in Pennylane, then be
matched with a bank transaction. Pennylane offers company API tokens, OAuth
and partner apps. A company token always belongs to one company; the product
serves several companies.

## Decision

- **Company API tokens for now**, no OAuth nor partner app. Each company
  creates a token in Pennylane (Settings → Connectivity → Developers, API V2,
  "Read and write") and it is stored on `Company.pennylaneApiToken`.
- **Encrypted at rest** with AES-256-GCM (`companies/secret-cipher.ts`), key
  `SECRETS_ENCRYPTION_KEY` (32 bytes, hex). The repository encrypts on write
  and decrypts on read; nobody else sees the stored form. Stored values are
  versioned (`v1.`) so the algorithm can change.
- **A default company from the env** until there is an onboarding
  (self-hosted edition only since [015](015-editions.md)): when
  `PENNYLANE_API_TOKEN` is set, the company
  `00000000-0000-7000-8000-000000000001` ("Default") is created at startup
  with that token, or gets it (upsert on the fixed id; the env wins, a new
  token replaces the old one). Users are attached to that id by hand. The
  token is not checked against Pennylane at startup: a wrong one shows at
  the first import (401).
- **Two modules**: `companies` (the company and its secrets, Prisma only)
  and `pennylane` (the HTTP API, technical, no business, no storage: each
  call takes the token). `tickets` will use both. Moving to OAuth later only
  changes where the token comes from.
- **HTTP**: native `fetch` under a `@nestjs/resilience` policy (the
  library `@nestjs/ai` already uses), no axios: retry, a circuit breaker
  shared by every company (opened by 5xx, timeouts and network errors only,
  not by 4xx) and a 30 s timeout per attempt. OAuth later needs no
  interceptor: every call goes through `PennylaneClient.request`.
- **Retries**: only what is safe to repeat. A 429 (Pennylane allows 25
  requests per 5 s and per token), following `retry-after`; a 409 on the
  invoice import (the uploaded file is not processed yet). Never a 5xx or a
  timeout: the write may have happened. The import sends
  `external_reference = ticket id`.
- **Errors** have fixed reasons (`PENNYLANE_FAILURES`); Pennylane's `code`,
  `field` and `message` are kept for logs, never its `payload` (it echoes
  the values sent) nor the token.
- **VAT**: the extraction now keeps the printed rate (basis points, 2000 =
  20%). French rates map to `FR_200`, `FR_100`, `FR_85`, `FR_55`, `FR_21`,
  0% to `exempt`. Any other rate (a receipt from abroad) or no printed rate:
  imported with `import_as_incomplete`, for the accountant to complete.
- **Supplier**: chosen before the recap, see
  [decision 012](012-supplier-matching.md).

## Consequences

- A company without a token cannot import; tokens can expire (1, 6, 12
  months or unlimited, chosen by the company): a 401 must be shown to them.
- Losing `SECRETS_ENCRYPTION_KEY` means entering every token again.
- Pennylane accepts PDF, JPEG, PNG, TIFF, BMP and GIF only: HEIC (iPhone)
  and WebP are refused before the call.
