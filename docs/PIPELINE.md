[← Back to README](../README.md)

# Pipeline

Three stages, run in strict order: **seed → classify → compare**. Each stage depends on the previous one having completed — running them out of order processes nothing (`compare` only looks at emails already marked `BL_COMPARISON`, and only reads attachments already uploaded to Storage by `seed`).

## 1. Seed — `npm run seed`

Uploads every email and attachment from the local dataset (`inbox/`, `attachments/`) into Supabase: an `emails` row per message, attachment bytes into the private `clearport-documents` Storage bucket, and a row per attachment recording its content hash and ingest state (`stored`/`missing`). Re-running is safe — content already stored with a matching hash isn't re-uploaded, and every import writes an audit event.

Full step-by-step Supabase project setup: see [Phase 1](PHASE-1.md).

## 2. Classify — `npm run classify`

For each email, a deterministic rule pass runs first — checking for comparison verbs, SI/BL attachment-name signals, invoice language, and spam markers. Only when the rule confidence is below `0.75` does it fall back to a single Gemini call. In practice this means the large majority of emails are classified for free, in microseconds, with Gemini reserved for genuinely ambiguous cases.

Rule design and verified distribution across the dataset: see [Phase 2](PHASE-2.md).

## 3. Compare — `npm run compare`

Processes every email classified `BL_COMPARISON`. For each: downloads its attachments from Storage, parses them (`.txt`/`.xlsx`/`.docx`/`.pdf`), detects which one is the SI and which is the BL, extracts the seven scored fields via label-synonym matching, normalizes values (legal-entity suffixes stripped from names, port codes resolved, weights converted to kg), and compares. Result is one of:

- `OK` — all seven fields match
- `MISMATCH` — one or more fields differ, with both values recorded
- `NEEDS_REVIEW` — a document is missing, unreadable, the wrong type, or a field value is missing; a specific `review_reason` is recorded rather than a generic failure

Every result — and every field extracted along the way, with its source evidence — is written to Supabase and immediately visible in the `/review` and `/report/[emailId]` pages.

## Submission export - `GET /api/export/submission`

Accessible directly via the `/admin` portal, the export endpoint queries the `emails` and `comparisons` tables to generate the official `submission.json` artifact required for self-evaluation.

For each processed `email_id`, the generated JSON schema includes:

- `category` — Email classification result
- `status` — Comparison outcome (`OK`, `MISMATCH`, or `NEEDS_REVIEW`)
- `review_reason` — Trigger flag if escalated for human review
- `has_defect` — Boolean flag indicating a discrepancy or document error
- `defect_fields` — List of non-matching or unreadable target fields
