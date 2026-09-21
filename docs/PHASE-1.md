[← Back to README](../README.md)

# ClearPort — Phase 1

The existing Python prototype is preserved. Next.js is the new application at the repository root. Phase 1 does not call any AI provider. The approved provider for later phases is Gemini, not Anthropic; the project must remain zero-cost.

## Run locally

Local verification on 2026-09-19: all 6 ingestion tests passed, TypeScript checking passed, and the Next.js production build passed. The actual dataset dry run found 520 emails, 250 attachment references, and 0 missing files. Supabase migration execution, live row counts, and Storage round-trip verification are still pending a configured Free project.

Use Node.js 20.9+ (a supported current LTS is recommended).

```powershell
npm install
npm run typecheck
npm test
npm run seed:check
npm run dev
```

Open http://localhost:3000. The Phase 1 page is a foundation screen, not a completed inbox.

## Supabase setup — required to finish cloud verification

1. Create a project in a **Free** Supabase organization. Name it ClearPort. Keep the generated database password private. Do not upgrade or activate paid add-ons.
2. In SQL Editor, run `supabase/migrations/202609190001_clearport.sql` on the new project once. It creates five tables, a private document bucket, and Realtime publication membership for emails and comparisons.
3. Copy `.env.example` to `.env.local`. Set the project URL, publishable key, and server-only service-role key from the project dashboard. Do not share keys in chat. The service-role key must never have a `NEXT_PUBLIC_` prefix.
4. Run `npm run seed`. This upserts records, uploads bytes, then verifies email IDs/counts, all attachment references, and the SHA-256 of every stored file. Repeating seed does not duplicate email or attachment rows. Each import writes an audit event.
5. Confirm the command exits successfully, then run the SQL checks below.

```sql
select count(*) as dataset_emails from public.emails where source = 'dataset';
select count(*) as attachment_references from public.attachments a
join public.emails e on e.id = a.email_id where e.source = 'dataset';
select ingest_state, count(*) from public.attachments group by ingest_state;
select tablename from pg_publication_tables
where pubname = 'supabase_realtime' and schemaname = 'public';
```

Expected counts come from `npm run seed:check`, never hardcoded in the importer. `npm run seed:verify` rechecks the cloud state without writing records. The verification count filters `source='dataset'` so later live emails do not cause false failures.

## Alternative sources

```powershell
npm run seed:check -- --source "C:\path\to\extracted-bundle"
npm run seed -- --source http://localhost:8080
```

The folder must contain inbox/ and attachments/. Extract a ZIP first; archive decompression is not part of this interface. The HTTP endpoints match loader.py (`GET /emails` and `GET /attachments/...`). A deployed Vercel app cannot reach the organizer server on your laptop's localhost; HTTP ingestion/self-evaluation against that server must run locally unless the organizers provide a reachable URL.

## Phase 1 decisions

- Dataset timestamps are absent: received_at remains NULL instead of inventing a received time.
- Ingestion stores document type as unknown. Parser/readability and evidence fields remain NULL until extraction; a zero-byte file is preserved for later diagnosis.
- Missing referenced files retain an attachment row with ingest_state=missing; no fake storage file is uploaded.
- Extra attachment columns retain source path, content hash, size, and ingestion state for verification and safe retries.
- Reimporting a changed email or stored document under the same identity is rejected to avoid stale verification. Document revisions need a versioned workflow in a later migration.
- RLS is enabled with no browser access policies yet; only the server seed can access data. Authentication/scoped read policies must be implemented before the browser can receive Realtime rows. Publication membership alone is not a working live connector.
- There is no claim of transactionality across Storage and Postgres. A failed seed can leave a partial import; rerun it to repair, then run verification. Storage upload errors abort ingestion rather than masquerading as source-file failures.
- Phase 1 must not be signed off until the real Supabase checks pass. No later phase has been implemented.

## Upcoming spec clarifications

- Export must follow the actual sample schema (`has_defect`, `defect_fields`), not the UI's `mismatched_fields` objects.
- Operational AI/network failures must remain retryable failures, distinct from source documents with missing values.
- Metrics must distinguish never-reviewed automation from cases resolved by humans.
- An actual inbound email address may require a domain/provider account; verify a zero-cost option before Phase 7. Never present a simulated event as a real email.
