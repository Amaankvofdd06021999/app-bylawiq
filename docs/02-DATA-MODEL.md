# 02 — Data Model

## 1. Entity map

```
organizations (management company OR self-managed strata)
  └── org_members (user ↔ org, role)
  └── buildings (a strata corporation)
        ├── building_members (user ↔ building, role)   ← drives shell shape
        ├── documents (vault)
        │     └── document_versions
        │           └── document_chunks (vector + tsvector)
        ├── chats
        │     └── messages
        │           ├── message_citations
        │           └── message_attachments
        ├── disputes
        │     └── dispute_events (append-only timeline)
        ├── generated_documents (notices, letters, packs)
        └── building_settings

-- system-wide, not building-scoped, readable by all authenticated users
legal_sources          (SPA, regs, HR Code, CRT decisions, guidance)
  └── legal_chunks     (vector + tsvector)
corpus_versions

-- cross-cutting
audit_log (append-only)
retrieval_traces
```

Two corpora, two access rules. **Building corpora** are strictly tenant-isolated. **Legal corpora** are shared and world-readable to authenticated users. Keeping them in separate tables means an RLS mistake on one cannot expose the other, and it lets the shared corpus be indexed and cached aggressively.

## 2. Extensions and conventions

```sql
create extension if not exists vector;
create extension if not exists pg_trgm;
create extension if not exists pgcrypto;

-- every table gets these
--   id           uuid primary key default gen_random_uuid()
--   created_at   timestamptz not null default now()
--   updated_at   timestamptz not null default now()  (trigger-maintained)
--   deleted_at   timestamptz                          (soft delete where applicable)
```

Soft delete on anything a user can remove that might be needed for legal defensibility: documents, disputes, generated documents, messages. Hard delete only on PIPA erasure requests, which run through a dedicated purge job that also removes chunks and storage objects.

## 3. Core DDL

### Organizations and buildings

```sql
create type org_type as enum ('management_company', 'self_managed');

create table organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  type        org_type not null default 'management_company',
  jurisdiction text not null default 'BC',      -- forward-compat, doc 00 §8
  plan        text not null default 'trial',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table buildings (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete restrict,
  name            text not null,                 -- 'Oakridge Towers'
  strata_plan_no  text,                          -- 'EPS 4482' — the legal identifier
  address         text,
  unit_count      int,
  jurisdiction    text not null default 'BC',
  fiscal_year_end date,                          -- drives AGM deadline (s.41)
  corpus_version  int not null default 1,        -- bumps on vault change; cache key
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  deleted_at      timestamptz
);

create index on buildings (org_id) where deleted_at is null;
create unique index on buildings (jurisdiction, strata_plan_no)
  where strata_plan_no is not null and deleted_at is null;
```

`strata_plan_no` is unique per jurisdiction because two management companies must never both create a record for the same legal entity — that is how the same building ends up with two divergent vaults.

### Membership — the table everything hangs off

```sql
create type app_role as enum (
  'platform_admin',      -- BylawIQ staff. Never auto-granted.
  'org_owner',           -- management company principal
  'org_admin',           -- ops manager; can add buildings and members
  'strata_manager',      -- licensed manager; full building access
  'assistant_manager',   -- drafts but cannot send or finalise
  'council_president',
  'council_member',
  'owner_resident',      -- read-only, Phase 3
  'external_counsel'     -- time-boxed scoped read
);

create table org_members (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid not null references organizations(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,
  role       app_role not null,
  status     text not null default 'active',   -- active | invited | suspended
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create table building_members (
  id          uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        app_role not null,
  status      text not null default 'active',
  expires_at  timestamptz,                     -- external_counsel gets a deadline
  created_at  timestamptz not null default now(),
  unique (building_id, user_id)
);

-- RLS policies hit these constantly. Index both directions.
create index on building_members (user_id) where status = 'active';
create index on building_members (building_id) where status = 'active';
create index on org_members (user_id) where status = 'active';
```

The count of active `building_members` rows for a user is what selects the shell (doc 05 §2). Expose it as a view:

```sql
create view my_buildings as
select b.*, bm.role as my_role
from buildings b
join building_members bm on bm.building_id = b.id
where bm.user_id = (select auth.uid())
  and bm.status = 'active'
  and (bm.expires_at is null or bm.expires_at > now())
  and b.deleted_at is null;
```

### Vault documents

```sql
create type doc_type as enum (
  'bylaws','rules','strata_plan','council_minutes','agm_minutes','sgm_minutes',
  'depreciation_report','insurance','form_b','form_f','correspondence','other'
);

create type ingest_status as enum ('uploaded','parsing','chunking','embedding','ready','failed');

create table documents (
  id             uuid primary key default gen_random_uuid(),
  building_id    uuid not null references buildings(id) on delete cascade,
  type           doc_type not null,
  title          text not null,
  storage_path   text not null,                -- private bucket key
  uploaded_by    uuid not null references auth.users(id),
  -- legal currency (doc 00 §6)
  effective_date date,
  superseded_by  uuid references documents(id),
  lto_filing_ref text,                         -- Form I filing reference
  status         ingest_status not null default 'uploaded',
  error_message  text,
  page_count     int,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create index on documents (building_id, type) where deleted_at is null;
create index on documents (building_id, status);
```

```sql
create table document_chunks (
  id            uuid primary key default gen_random_uuid(),
  document_id   uuid not null references documents(id) on delete cascade,
  building_id   uuid not null references buildings(id) on delete cascade,  -- denormalised on purpose
  chunk_index   int  not null,
  content       text not null,
  -- citation metadata: what makes a chunk quotable (doc 04 §5)
  heading       text,          -- 'Bylaw 3.1 — Quiet Hours'
  section_ref   text,          -- '3.1'
  page_from     int,
  page_to       int,
  effective_date date,         -- copied from parent for as-of filtering
  embedding     vector(1536),
  tsv           tsvector generated always as (to_tsvector('english', content)) stored,
  token_count   int,
  created_at    timestamptz not null default now()
);

create index on document_chunks using hnsw (embedding vector_cosine_ops);
create index on document_chunks using gin (tsv);
create index on document_chunks (building_id);           -- RLS predicate
create index on document_chunks (document_id, chunk_index);
```

**`building_id` is denormalised onto chunks deliberately.** The RLS policy on the hottest table in the system must not require a join. A policy that joins to `documents` to find the building runs per-candidate-row during vector search and destroys performance. Denormalise, and enforce consistency with a trigger:

```sql
create or replace function chunk_building_matches_document()
returns trigger language plpgsql as $$
begin
  if new.building_id is distinct from (select building_id from documents where id = new.document_id) then
    raise exception 'chunk building_id does not match parent document';
  end if;
  return new;
end $$;

create trigger trg_chunk_building before insert or update on document_chunks
for each row execute function chunk_building_matches_document();
```

### Legal corpora (shared)

```sql
create type legal_source_type as enum (
  'statute','regulation','standard_bylaw','crt_decision','bchrt_decision',
  'bcsc_decision','bcca_decision','guidance'
);

create table legal_sources (
  id            uuid primary key default gen_random_uuid(),
  jurisdiction  text not null default 'BC',
  type          legal_source_type not null,
  citation      text not null,        -- 'SPA s.135' | '2024 BCCRT 812'
  title         text not null,
  url           text,
  decided_on    date,
  in_force_from date,
  in_force_to   date,                 -- null = current. Enables as-of queries.
  corpus_version int not null,
  created_at    timestamptz not null default now()
);

create table legal_chunks (
  id          uuid primary key default gen_random_uuid(),
  source_id   uuid not null references legal_sources(id) on delete cascade,
  chunk_index int not null,
  content     text not null,
  section_ref text,                   -- 's.135(1)(a)'
  heading     text,
  embedding   vector(1536),
  tsv         tsvector generated always as (to_tsvector('english', content)) stored,
  created_at  timestamptz not null default now()
);

create index on legal_chunks using hnsw (embedding vector_cosine_ops);
create index on legal_chunks using gin (tsv);
create index on legal_sources (jurisdiction, type, in_force_to);
```

### Chats and messages

```sql
create type chat_mode as enum ('qa','bylaw_builder','parking_rules','dispute','digest');

create table chats (
  id          uuid primary key default gen_random_uuid(),
  building_id uuid references buildings(id) on delete cascade,  -- NULL = general BC law, no building context
  user_id     uuid not null references auth.users(id) on delete cascade,
  mode        chat_mode not null default 'qa',
  title       text not null default 'New chat',
  dispute_id  uuid,                                             -- optional linkage
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index on chats (user_id, updated_at desc);
create index on chats (building_id, updated_at desc);
```

`chats.building_id` is nullable so a manager can ask a general BC-law question without picking a building. When it is null, the building retrieval tool is **not registered** for that request — the model physically cannot search building documents. That is cleaner than registering the tool and having it return empty.

```sql
create table messages (
  id          uuid primary key default gen_random_uuid(),
  chat_id     uuid not null references chats(id) on delete cascade,
  role        text not null check (role in ('user','assistant','system')),
  parts       jsonb not null,        -- AI SDK 6 UIMessage parts, verbatim
  model       text,
  input_tokens int,
  output_tokens int,
  latency_ms  int,
  finish_reason text,
  created_at  timestamptz not null default now()
);

create index on messages (chat_id, created_at);
```

Store `parts` as jsonb, not flattened text. AI SDK 6 messages are part arrays (text, tool calls, tool results, reasoning, files) and round-tripping them intact is what lets a reloaded thread render identically — including tool states and approval prompts.

```sql
create table message_citations (
  id            uuid primary key default gen_random_uuid(),
  message_id    uuid not null references messages(id) on delete cascade,
  ordinal       int not null,              -- [1], [2] as rendered
  kind          text not null check (kind in ('building','legal')),
  document_chunk_id uuid references document_chunks(id) on delete set null,
  legal_chunk_id    uuid references legal_chunks(id)    on delete set null,
  quoted_span   text,                      -- exact substring the claim rests on
  relevance     numeric,
  created_at    timestamptz not null default now(),
  check (num_nonnulls(document_chunk_id, legal_chunk_id) = 1)
);
```

Citations are rows, not markdown artefacts. That makes them clickable, verifiable, countable in evals, and auditable when a notice is challenged.

### Disputes — the audit spine

```sql
create type dispute_stage as enum (
  'reported','investigating','warning_sent','notice_sent','hearing_offered',
  'hearing_held','decision_issued','fine_levied','resolved','escalated_crt','withdrawn'
);

create table disputes (
  id           uuid primary key default gen_random_uuid(),
  building_id  uuid not null references buildings(id) on delete cascade,
  reference    text not null,               -- human handle: 'D-2026-014'
  subject_unit text,
  category     text,                        -- noise | parking | pets | alterations | fees
  stage        dispute_stage not null default 'reported',
  bylaw_refs   text[],                      -- which of THIS building's bylaws are engaged
  opened_by    uuid not null references auth.users(id),
  opened_at    timestamptz not null default now(),
  resolved_at  timestamptz,
  deleted_at   timestamptz,
  unique (building_id, reference)
);

-- append-only. never updated, never deleted.
create table dispute_events (
  id          uuid primary key default gen_random_uuid(),
  dispute_id  uuid not null references disputes(id) on delete cascade,
  building_id uuid not null references buildings(id) on delete cascade,
  stage       dispute_stage not null,
  occurred_at timestamptz not null,          -- when it happened, not when logged
  logged_at   timestamptz not null default now(),
  actor_id    uuid references auth.users(id),
  summary     text not null,
  generated_document_id uuid,
  created_at  timestamptz not null default now()
);

create index on dispute_events (dispute_id, occurred_at);
```

`dispute_events` is the s.135 paper trail. The distinction between `occurred_at` and `logged_at` matters: at the CRT, "when did you send the notice" and "when did you record that you sent it" are different questions, and conflating them has cost stratas cases.

### Generated documents

```sql
create type gen_doc_status as enum ('draft','pending_review','approved','sent','superseded','void');

create table generated_documents (
  id            uuid primary key default gen_random_uuid(),
  building_id   uuid not null references buildings(id) on delete cascade,
  dispute_id    uuid references disputes(id) on delete set null,
  chat_id       uuid references chats(id) on delete set null,
  kind          text not null,          -- s135_notice | hearing_invite | decision_letter | council_report | crt_pack
  title         text not null,
  body_md       text not null,
  status        gen_doc_status not null default 'draft',
  created_by    uuid not null references auth.users(id),
  approved_by   uuid references auth.users(id),      -- the verification gate, doc 11 §4
  approved_at   timestamptz,
  sent_at       timestamptz,
  storage_path  text,                                -- rendered PDF
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz
);
```

`approved_by` is nullable but enforced: a row cannot move to `sent` without it.

```sql
alter table generated_documents add constraint sent_requires_approval
  check (status <> 'sent' or (approved_by is not null and approved_at is not null));
```

Put the rule in the database. UI checks get bypassed; check constraints do not.

### Audit log

```sql
create table audit_log (
  id          bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  actor_id    uuid,
  org_id      uuid,
  building_id uuid,
  action      text not null,         -- 'document.view' | 'notice.send' | 'member.role_change'
  target_type text,
  target_id   uuid,
  request_id  text,
  metadata    jsonb not null default '{}'::jsonb    -- never document content
);

create index on audit_log (building_id, occurred_at desc);
create index on audit_log (actor_id, occurred_at desc);
```

Append-only, enforced by revoking UPDATE and DELETE from every role including `authenticated`. Writes go through a `SECURITY DEFINER` function.

## 4. CRUD matrix

C = create, R = read, U = update, D = delete (soft unless noted). Blank = no access.

| Resource | platform_admin | org_owner | org_admin | strata_manager | assistant_manager | council_president | council_member | owner_resident | external_counsel |
|---|---|---|---|---|---|---|---|---|---|
| organizations | CRUD | RU | R | R | R | | | | |
| buildings | CRUD | CRUD | CRU | R | R | R | R | R | R |
| building_members | CRUD | CRUD | CRUD | R | R | CRU¹ | R | | |
| documents (vault) | R² | CRUD | CRUD | CRUD | CR | CRUD | R | R³ | R |
| document_chunks | R² | R | R | R | R | R | R | R³ | R |
| chats | | CRUD⁴ | CRUD⁴ | CRUD⁴ | CRUD⁴ | CRUD⁴ | CRUD⁴ | CRUD⁴ | CRUD⁴ |
| messages | | R⁴ | R⁴ | CR⁴ | CR⁴ | CR⁴ | CR⁴ | CR⁴ | CR⁴ |
| disputes | | CRUD | CRUD | CRUD | CRU | CRUD | R | | R |
| dispute_events | | CR | CR | CR | CR | CR | R | | R |
| generated_documents | | CRUD | CRUD | CRUD | CR⁵ | CRUD | R | | R |
| → approve/send | | ✓ | ✓ | ✓ | **✗** | ✓ | ✗ | ✗ | ✗ |
| legal_sources / legal_chunks | CRUD | R | R | R | R | R | R | R | R |
| audit_log | R | R | R | R | | R | | | |
| billing | R | CRUD | R | | | | | | |

¹ Council president manages council membership only, not manager assignments.
² Platform admin reads building data only via a break-glass flow that writes an audit row and notifies the org. Not ambient access.
³ Owner/resident sees only documents flagged `owner_visible` (Phase 3).
⁴ Chats are private to their creator. No role grants read access to another user's threads — including org_owner. This is deliberate: a manager's draft reasoning about a resident is not management-company-wide information.
⁵ Assistant manager can draft but never approve or send. This is the core of the role.

The two rows worth defending: **assistant managers cannot send**, and **nobody reads anyone else's chats**. Both will be requested as "small" exceptions. Both are load-bearing.

## 5. Migration discipline

- One logical change per migration file, named `NNNN_verb_noun.sql`.
- Every migration that creates a table includes, in the same file: `enable row level security`, the policies, and the indexes on policy predicates.
- A migration that creates a table without RLS fails CI (doc 08 §4).
- Additive first: add column nullable → backfill → add constraint. Never add a NOT NULL column with a default to a large table in one step.
- Never modify a shipped migration. Write a new one.
- Destructive changes to `document_chunks` require a re-embedding plan in the PR description.
