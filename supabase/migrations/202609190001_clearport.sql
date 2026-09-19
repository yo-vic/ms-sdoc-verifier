-- ClearPort Phase 1. Apply to a new Supabase project with SQL Editor.
begin;
create extension if not exists pgcrypto;

create table public.emails (
  id text primary key,
  received_at timestamptz,
  sender text not null,
  subject text not null,
  body text not null,
  source text not null check (source in ('dataset','live_inbox')),
  category text check (category in ('BL_COMPARISON','SI_REQUEST','INVOICE_QUERY','GENERAL','SPAM')),
  category_confidence double precision check (category_confidence between 0 and 1),
  category_decided_by text check (category_decided_by in ('rule','llm')),
  created_at timestamptz not null default now()
);

create table public.attachments (
  id uuid primary key default gen_random_uuid(),
  email_id text not null references public.emails(id) on delete cascade,
  filename text not null,
  doc_type text not null default 'unknown' check (doc_type in ('SI','BL','unknown')),
  storage_path text not null unique,
  raw_text text,
  is_readable boolean,
  read_method text check (read_method in ('native','ocr','vision')),
  -- Phase 1 retains source identity, before Phase 3 attempts parsing.
  source_path text not null,
  content_sha256 text,
  byte_size bigint check (byte_size >= 0),
  ingest_state text not null default 'pending' check (ingest_state in ('pending','stored','missing')),
  ingest_error text,
  unique (email_id, source_path)
);

create table public.extracted_fields (
  id uuid primary key default gen_random_uuid(),
  attachment_id uuid not null references public.attachments(id) on delete cascade,
  field_name text not null check (field_name in ('shipper','consignee','notify_party','port_of_loading','port_of_discharge','container_count','gross_weight_kg')),
  raw_value text,
  normalized_value text,
  evidence_snippet text,
  evidence_line integer check (evidence_line > 0),
  extracted_by text not null check (extracted_by in ('lexicon','llm')),
  unique (attachment_id, field_name)
);

create table public.comparisons (
  id uuid primary key default gen_random_uuid(),
  email_id text not null unique references public.emails(id) on delete cascade,
  status text not null check (status in ('OK','MISMATCH','NEEDS_REVIEW')),
  review_reason text check (review_reason in ('unreadable','missing_attachment','wrong_doc_type','missing_value')),
  mismatched_fields jsonb not null default '[]'::jsonb check (jsonb_typeof(mismatched_fields) = 'array'),
  reviewed boolean not null default false,
  reviewed_at timestamptz,
  reviewer_note text,
  created_at timestamptz not null default now(),
  check ((status = 'NEEDS_REVIEW' and review_reason is not null) or (status <> 'NEEDS_REVIEW' and review_reason is null)),
  check (status <> 'OK' or jsonb_array_length(mismatched_fields) = 0),
  check (status <> 'MISMATCH' or jsonb_array_length(mismatched_fields) > 0)
);

create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  email_id text references public.emails(id) on delete set null,
  actor text not null check (actor in ('system','human')),
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index emails_received_idx on public.emails(received_at desc nulls last);
create index attachments_email_idx on public.attachments(email_id);
create index comparisons_review_idx on public.comparisons(status, created_at);
create index audit_email_idx on public.audit_log(email_id, created_at);

-- No anonymous access to shipping documents. Server-side seed uses service role.
-- Browser/authenticated policies will be added with the authenticated UI.
alter table public.emails enable row level security;
alter table public.attachments enable row level security;
alter table public.extracted_fields enable row level security;
alter table public.comparisons enable row level security;
alter table public.audit_log enable row level security;

insert into storage.buckets(id, name, public, file_size_limit)
values ('clearport-documents', 'clearport-documents', false, 20971520)
on conflict (id) do nothing;

-- Preserve existing publication membership if running against an existing project.
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'emails') then
    alter publication supabase_realtime add table public.emails;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comparisons') then
    alter publication supabase_realtime add table public.comparisons;
  end if;
end $$;
commit;
