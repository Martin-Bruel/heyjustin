# 015: Two editions, self-hosted and saas, chosen by HEYJUSTIN_EDITION

Date: 2026-11-26 · Status: accepted · Amends [010](010-ai-extraction.md) and [011](011-pennylane-api-token.md)

## Context

The same code runs as an open-source app, installed and configured by its
user, and as our hosted service. The open-source user must be free to pick
the AI (their key, their model, a local one). The service must not let a
setting degrade reading: a weaker model misreads receipts (Small 4 got a
blurry photo wrong), which costs more than it saves. Its AI cost must also
be known to price the subscriptions: Large 4 at low reasoning spends ~900
output tokens per receipt, ~2 400 at its default.

## Decision

- `HEYJUSTIN_EDITION`: `self-hosted` (default) or `saas`, validated by the
  app config (`config/edition.ts`). Each module's config is discriminated on
  it (`withEdition`).
- **saas**: the AI is fixed in code (`SAAS_EXTRACTION_MODEL`: Mistral,
  `mistral-large-4`, reasoning `low`); only `AI_API_KEY` is set.
  `AI_PROVIDER`, `AI_EXTRACTION_MODEL`, `AI_BASE_URL` and
  `PENNYLANE_API_TOKEN` are refused: each company brings its own token.
- **self-hosted**: `AI_PROVIDER` and `AI_EXTRACTION_MODEL` are required,
  the reasoning is the model's default (no setting: each model accepts other
  values). `PENNYLANE_API_TOKEN` creates the default company (011).
- **Refused rather than ignored**: a variable the edition does not use stops
  the startup ("not available in the saas edition: remove it").
- `maxOutputTokens` raised from 4 000 to 10 000, for models at their default
  reasoning (Large 4: ~2 400 on a receipt).

## Consequences

- A self-hosted install pays the reasoning of its model: about twice the
  cost of the saas with Large 4.
- The saas has no way yet to set a company's token: onboarding (or OAuth)
  comes before it can run.
- Supersedes the parts of 010 on the model and the reasoning: 010 chose
  them for every install.
