[← Back to README](../README.md)

# ClearPort — Phase 2 classification

Phase 2 adds rule-first classification to `lib/pipeline/classify.ts` and a database command in `scripts/classify.ts`.

## What it does

- Classifies only the newest part of an email: quoted thread history, forwarded-message headers, external-email banners, and routine signatures are excluded first.
- Uses deterministic rules for strong signals. A BL comparison requires a request to check/compare/verify plus both SI and BL attachment-name signals. A bare mention of SI or BL remains `GENERAL`.
- Uses Gemini only where the rule confidence is below 0.75. The model and API key remain your existing free Gemini configuration. No Anthropic account is required.
- Validates Gemini JSON against the five permitted categories. Any invalid or failed model response falls back safely to `GENERAL` and writes `classification_fallback_invalid` to `audit_log`.
- Writes category, confidence, decision source, and an audit record for each classified email.

## Local verification completed

```text
npm run typecheck     # passed
npm test              # 11 tests passed
npm run classify:check
```

The dry run made no Gemini calls and found this initial rule distribution across 520 messages:

| Category | Count |
| --- | ---: |
| BL_COMPARISON | 119 |
| SI_REQUEST | 125 |
| INVOICE_QUERY | 72 |
| GENERAL | 188 |
| SPAM | 16 |

188 low-confidence general messages would be sent to Gemini during the live run. The script stays below Gemini Flash Lite's free 15-requests-per-minute allowance, so this fallback work can take roughly 14 minutes. I manually checked 20 source emails: four representative examples from each of the five categories. The check included the cleaned newest message and attachment names. A rule was corrected during this check so that a shipping instruction's ordinary "original invoice" document-list entry does not become an invoice query.

## Run after Phase 1 cloud seeding has succeeded

```powershell
npm run classify:check  # safe preview; no API calls or database writes
npm run classify        # writes classifications to Supabase; may call Gemini for 188 low-confidence messages
npm run classify:retry  # retries only rows where an earlier Gemini call failed
```

Do not run `npm run classify` until `npm run seed` has completed successfully. If Gemini fails for an individual email, the email is retained as `GENERAL` with confidence 0 and an audit entry so it can be retried rather than silently appearing as a confident decision.

Phase 3 has not started.
