# 03 — RBAC, RLS and Security

## 1. The model in one paragraph

A user belongs to an **organization** (a management company or a self-managed strata) and holds **memberships** in specific **buildings**. Their role in a building determines which **permissions** they hold there. Permissions are checked in two places that must agree: in the application, before doing anything (fail fast, good errors), and in Postgres, via Row Level Security (the actual guarantee). The application check is a courtesy. The database check is the security boundary.

## 2. Roles and permissions

Permissions are strings namespaced `resource.verb`. Roles map to permission sets in a table, not in code, so a role change is a migration rather than a deploy.

```sql
create type app_permission as enum (
  'building.read','building.update','building.create','building.delete',
  'member.read','member.invite','member.update_role','member.remove',
  'vault.read','vault.upload','vault.delete',
  'chat.use','chat.use_portfolio',            -- cross-building queries
  'dispute.read','dispute.create','dispute.update',
  'document.draft','document.approve','document.send',
  'audit.read','billing.manage','org.manage'
);

create table role_permissions (
  id         bigint generated always as identity primary key,
  role       app_role not null,
  permission app_permission not null,
  unique (role, permission)
);
```

Seed (abridged — full set in `supabase/seed.sql`):

```sql
insert into role_permissions (role, permission) values
  -- strata_manager: full operational control of assigned buildings
  ('strata_manager','building.read'), ('strata_manager','vault.read'),
  ('strata_manager','vault.upload'),  ('strata_manager','vault.delete'),
  ('strata_manager','chat.use'),      ('strata_manager','chat.use_portfolio'),
  ('strata_manager','dispute.create'),('strata_manager','dispute.update'),
  ('strata_manager','document.draft'),('strata_manager','document.approve'),
  ('strata_manager','document.send'), ('strata_manager','audit.read'),

  -- assistant_manager: identical MINUS approve and send
  ('assistant_manager','building.read'), ('assistant_manager','vault.read'),
  ('assistant_manager','vault.upload'),  ('assistant_manager','chat.use'),
  ('assistant_manager','dispute.create'),('assistant_manager','dispute.update'),
  ('assistant_manager','document.draft'),

  -- council_president: full control of their one building, no portfolio
  ('council_president','building.read'),  ('council_president','vault.read'),
  ('council_president','vault.upload'),   ('council_president','vault.delete'),
  ('council_president','chat.use'),
  ('council_president','dispute.create'), ('council_president','dispute.update'),
  ('council_president','document.draft'), ('council_president','document.approve'),
  ('council_president','document.send'),  ('council_president','member.invite'),

  -- council_member: read and discuss, cannot act
  ('council_member','building.read'), ('council_member','vault.read'),
  ('council_member','chat.use'),      ('council_member','dispute.read'),

  -- external_counsel: read-only, time-boxed at the membership row
  ('external_counsel','building.read'), ('external_counsel','vault.read'),
  ('external_counsel','dispute.read'),  ('external_counsel','chat.use');
```

Note `chat.use_portfolio`: only managers and org admins can run a query across multiple buildings. Council members cannot — they have one building, and the permission would be meaningless and dangerous if they ever gained a second membership.

## 3. Custom Access Token Hook

The JWT carries the user's org and role map so RLS policies avoid a table lookup per row. This runs before every token issue.

```sql
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql stable
as $$
declare
  claims    jsonb;
  v_org_id  uuid;
  v_is_admin boolean;
  v_buildings jsonb;
begin
  claims := event->'claims';

  select om.org_id into v_org_id
  from public.org_members om
  where om.user_id = (event->>'user_id')::uuid and om.status = 'active'
  limit 1;

  select exists (
    select 1 from public.org_members
    where user_id = (event->>'user_id')::uuid and role = 'platform_admin' and status = 'active'
  ) into v_is_admin;

  -- { "<building_uuid>": "strata_manager", ... }
  select coalesce(jsonb_object_agg(bm.building_id::text, bm.role::text), '{}'::jsonb)
  into v_buildings
  from public.building_members bm
  where bm.user_id = (event->>'user_id')::uuid
    and bm.status = 'active'
    and (bm.expires_at is null or bm.expires_at > now());

  claims := jsonb_set(claims, '{app_metadata}', coalesce(claims->'app_metadata','{}'::jsonb));
  claims := jsonb_set(claims, '{app_metadata,org_id}',     to_jsonb(v_org_id));
  claims := jsonb_set(claims, '{app_metadata,is_platform_admin}', to_jsonb(v_is_admin));
  claims := jsonb_set(claims, '{app_metadata,buildings}',  v_buildings);

  return jsonb_set(event, '{claims}', claims);
end;
$$;

grant execute on function public.custom_access_token_hook to supabase_auth_admin;
revoke execute on function public.custom_access_token_hook from authenticated, anon, public;

grant select on public.org_members, public.building_members to supabase_auth_admin;
```

### Three rules about claims

1. **Authorization claims live in `app_metadata`, never `user_metadata`.** `user_metadata` maps to `raw_user_meta_data`, which the user can write to via `updateUser()`. A policy reading a role from `user_metadata` is a self-service privilege escalation.

2. **Claims are stale until the token refreshes.** If you revoke a membership, the user keeps access for the remainder of their token lifetime. For revocation that must be immediate — removing a manager, expiring external counsel — the policy must check the table, not the claim. Use the claim for the hot path (`document_chunks`) and the table for the sensitive path (`generated_documents`, `audit_log`). Force a refresh on membership change by calling `supabase.auth.refreshSession()` after the mutation and, for hard revocations, invalidating refresh tokens server-side.

3. **The claim is a cache, not a source of truth.** If a policy's correctness depends on freshness, it reads the table.

## 4. Helper functions

`SECURITY DEFINER` and marked `stable` so the planner can cache within a statement.

```sql
-- Does the current user hold an active membership in this building?
create or replace function public.has_building_access(p_building_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from building_members bm
    where bm.building_id = p_building_id
      and bm.user_id = (select auth.uid())
      and bm.status = 'active'
      and (bm.expires_at is null or bm.expires_at > now())
  );
$$;

-- Fast path: read the role straight from the JWT, no table hit.
create or replace function public.building_role(p_building_id uuid)
returns app_role
language sql stable
as $$
  select nullif(
    (select auth.jwt() -> 'app_metadata' -> 'buildings' ->> p_building_id::text),
    ''
  )::app_role;
$$;

-- Permission check via the role→permission table.
create or replace function public.authorize(p_permission app_permission, p_building_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from role_permissions rp
    where rp.permission = p_permission
      and rp.role = public.building_role(p_building_id)
  );
$$;
```

`select auth.uid()` is wrapped in a subselect on purpose — Postgres evaluates it once per statement instead of once per row. On a table with a million chunks that is the difference between 20 ms and a timeout.

## 5. Policies

Enable RLS on every table, then write policies. A table with RLS enabled and no policy denies everything, which is the correct default.

```sql
alter table buildings          enable row level security;
alter table building_members   enable row level security;
alter table documents          enable row level security;
alter table document_chunks    enable row level security;
alter table chats              enable row level security;
alter table messages           enable row level security;
alter table disputes           enable row level security;
alter table dispute_events     enable row level security;
alter table generated_documents enable row level security;
alter table audit_log          enable row level security;
alter table legal_sources      enable row level security;
alter table legal_chunks       enable row level security;
```

### Buildings

```sql
create policy "read own buildings" on buildings
for select to authenticated
using (has_building_access(id));

create policy "update with permission" on buildings
for update to authenticated
using (authorize('building.update', id))
with check (authorize('building.update', id));
```

### The hot one — document_chunks

```sql
-- Single predicate, no join, uses the JWT claim map. This runs against every
-- candidate row during vector search, so it has to be cheap.
create policy "read chunks in my buildings" on document_chunks
for select to authenticated
using (
  (auth.jwt() -> 'app_metadata' -> 'buildings') ? building_id::text
);
```

The `?` operator asks "does this jsonb object have this key". Combined with `create index on document_chunks (building_id)`, retrieval stays fast. Writes to chunks happen only from the ingestion job with the service role, so there is no insert policy for `authenticated`.

### Documents

```sql
create policy "read vault" on documents
for select to authenticated
using (has_building_access(building_id) and deleted_at is null);

create policy "upload to vault" on documents
for insert to authenticated
with check (authorize('vault.upload', building_id) and uploaded_by = (select auth.uid()));

create policy "soft delete vault" on documents
for update to authenticated
using (authorize('vault.delete', building_id))
with check (authorize('vault.delete', building_id));
```

### Chats — private to their owner

```sql
create policy "own chats only" on chats
for all to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and (building_id is null or authorize('chat.use', building_id))
);

create policy "messages in own chats" on messages
for all to authenticated
using (exists (select 1 from chats c where c.id = chat_id and c.user_id = (select auth.uid())))
with check (exists (select 1 from chats c where c.id = chat_id and c.user_id = (select auth.uid())));
```

The `with check` on chats does double duty: it stops a user creating a chat owned by someone else, **and** stops them creating a chat pointed at a building they cannot use. That second clause is what prevents "create chat scoped to Building X" as an access path.

### Generated documents — table-checked, not claim-checked

```sql
create policy "read generated docs" on generated_documents
for select to authenticated
using (has_building_access(building_id) and deleted_at is null);

create policy "draft generated docs" on generated_documents
for insert to authenticated
with check (authorize('document.draft', building_id) and created_by = (select auth.uid()));

create policy "update generated docs" on generated_documents
for update to authenticated
using (authorize('document.draft', building_id))
with check (authorize('document.draft', building_id));
```

Approval and sending do **not** go through an UPDATE policy — RLS cannot express "you may change status to `approved` but not to `sent`". They go through a `SECURITY DEFINER` RPC that checks the permission explicitly:

```sql
create or replace function public.approve_generated_document(p_doc_id uuid)
returns generated_documents
language plpgsql security definer set search_path = public
as $$
declare d generated_documents;
begin
  select * into d from generated_documents where id = p_doc_id;
  if not found then raise exception 'not_found'; end if;

  -- table lookup, not JWT: revocation must be immediate here
  if not exists (
    select 1 from building_members bm
    join role_permissions rp on rp.role = bm.role
    where bm.building_id = d.building_id
      and bm.user_id = (select auth.uid())
      and bm.status = 'active'
      and rp.permission = 'document.approve'
  ) then
    raise exception 'forbidden';
  end if;

  if d.created_by = (select auth.uid()) and d.kind in ('s135_notice','decision_letter') then
    raise exception 'self_approval_not_permitted';
  end if;

  update generated_documents
     set status = 'approved', approved_by = (select auth.uid()), approved_at = now()
   where id = p_doc_id
  returning * into d;

  perform log_audit('document.approve', 'generated_document', p_doc_id, d.building_id);
  return d;
end $$;
```

The self-approval block on enforcement notices is a deliberate control. For a two-person management company it will be annoying; make it an org setting, defaulted on, with the toggle itself written to the audit log.

### Legal corpora — readable by all authenticated users

```sql
create policy "read legal sources" on legal_sources
for select to authenticated using (true);

create policy "read legal chunks" on legal_chunks
for select to authenticated using (true);
```

No write policies. Only the service role writes, from the corpus sync job.

### Audit log — append-only

```sql
create policy "read audit for my buildings" on audit_log
for select to authenticated
using (building_id is not null and authorize('audit.read', building_id));

revoke insert, update, delete on audit_log from authenticated, anon;
```

Writes go through `log_audit()`, a `SECURITY DEFINER` function. Nobody can edit history.

## 6. Column-level privileges

RLS controls rows, not columns. A policy letting a manager update a building row lets them update **every column** on it, including `org_id` — which would move the building to another organization. `WITH CHECK` cannot compare old to new values, so it cannot express "you may edit this row but not that field."

Close the gap with Postgres grants:

```sql
revoke update on buildings from authenticated;
grant update (name, address, unit_count, fiscal_year_end) on buildings to authenticated;

revoke update on building_members from authenticated;
grant update (status) on building_members to authenticated;   -- role changes go via RPC
```

This is also why `SELECT *` is banned in application queries — a later `grant select (…)` narrowing will break it silently.

## 7. Storage

Vault files live in a private bucket. Access is via short-lived signed URLs generated server-side after a permission check.

```sql
create policy "read building files" on storage.objects
for select to authenticated
using (
  bucket_id = 'vault'
  and has_building_access(((storage.foldername(name))[1])::uuid)
);
```

Path convention: `vault/{building_id}/{document_id}/{filename}`. The building id is the first path segment specifically so the policy can extract it without a join.

Signed URL TTL is 300 seconds. Never return a public URL. Never put a signed URL in an LLM prompt or tool result — it would end up in message history and outlive the check that produced it.

## 8. Application-layer guards

```ts
// lib/auth/guards.ts
import 'server-only';

export async function requireUser() {
  const supabase = await createServerClient();
  const { data, error } = await supabase.auth.getClaims();  // verified, not decoded
  if (error || !data?.claims) throw new UnauthorizedError();
  return {
    id: data.claims.sub,
    orgId: data.claims.app_metadata?.org_id as string | undefined,
    buildings: (data.claims.app_metadata?.buildings ?? {}) as Record<string, AppRole>,
  };
}

export async function requireMembership(user: SessionUser, buildingId: string) {
  if (!user.buildings[buildingId]) throw new ForbiddenError();
  return user.buildings[buildingId];
}

export async function requirePermission(
  user: SessionUser, permission: AppPermission, buildingId: string,
) {
  const role = await requireMembership(user, buildingId);
  if (!ROLE_PERMISSIONS[role].includes(permission)) throw new ForbiddenError();
}
```

Use `getClaims()`, not `getSession()`. `getSession()` returns whatever is in the cookie without verifying the signature. `getClaims()` verifies.

`ROLE_PERMISSIONS` in TypeScript is generated from `role_permissions` at build time (`pnpm gen:permissions`) so the two definitions cannot drift.

## 9. Threat model

| Threat | Control |
|---|---|
| Cross-building retrieval leak | RLS on `document_chunks` + no `building_id` in tool schema + session-derived scope |
| Prompt injection in an uploaded bylaw PDF | Retrieved content is wrapped in delimiters and labelled untrusted; tools never take identifiers from model output; no tool can widen scope |
| Privilege escalation via metadata | Authorization claims in `app_metadata` only; `user_metadata` never read for authz |
| Stale permissions after revocation | Sensitive operations check tables, not claims; refresh tokens invalidated on removal |
| Service-role misuse | Import allowlist + lint rule + `server-only` |
| Column tampering | Column-level grants |
| Unauthorised send | DB check constraint + approval RPC + separation of duties |
| Signed URL leakage | 300 s TTL, never in prompts or message history |
| Enumeration of buildings | 404 not 403 for buildings the user cannot see |
| Abuse / cost blowout | Per-user and per-org rate limits before `streamText` |

## 10. Testing RLS

Every table gets a pgTAP test proving isolation. This is not optional — see doc 08 §4 for the CI wiring.

```sql
-- supabase/tests/rls_document_chunks.test.sql
begin;
select plan(3);

select tests.create_supabase_user('mgr_a');
select tests.create_supabase_user('mgr_b');
-- ... seed building A with mgr_a, building B with mgr_b, one chunk each

select tests.authenticate_as('mgr_a');
select is((select count(*) from document_chunks)::int, 1,
          'manager A sees only building A chunks');

select tests.authenticate_as('mgr_b');
select is((select count(*) from document_chunks)::int, 1,
          'manager B sees only building B chunks');

select tests.authenticate_as('mgr_a');
select is((select count(*) from document_chunks where building_id = :building_b)::int, 0,
          'explicit cross-building query returns nothing');

select * from finish();
rollback;
```

The third assertion is the important one. It simulates a successful prompt injection: the attacker knows the other building's UUID and asks for it directly. The answer must be zero rows.
