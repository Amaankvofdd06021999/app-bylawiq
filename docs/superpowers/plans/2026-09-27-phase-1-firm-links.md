# Phase 1 — Building organizations, firm links and review hand-off — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A building owns its own organization, invites a strata management firm with a one-time code, can revoke that firm at any time, and can send drafts to the firm for review — with every rule enforced in Postgres.

**Architecture:** Buildings move into their own `kind='building'` organizations; firms are `kind='firm'` organizations. An active `firm_building_links` row materializes `building_members` rows for the firm's staff (tagged `via_link_id`), so `authorize()` and every existing RLS policy keep working unchanged. Revoking suspends exactly those rows in the same transaction. Review hand-off extends `generated_documents` with `review_by` and three security-definer functions.

**Tech Stack:** Supabase Postgres (plpgsql, RLS), PGlite + Vitest for database tests, Next.js 16 App Router server actions, Zod, React client components.

**Spec:** `docs/superpowers/specs/2026-09-27-roles-billing-design.md` (§3, §4, §8, §11, §12 — Phase 1 only)

## Global Constraints

- AGENTS.md §0: building-scoped data is never fetched with `service_role` in response to user input. All new reads go through the user's client and RLS.
- RLS enabled on every new table, with a test proving building A cannot read building B's rows.
- Every column used in an RLS policy or join helper is indexed.
- Every server action starts with `requireUser()`, then Zod `parse`, then `requirePermission(...)` when a building is known. Where no building is known (accepting a firm code), the security-definer function is the permission check.
- Error messages never include building names, emails or SQL. New error codes are mapped in `lib/errors.ts` `checkDb`.
- User-facing strings: sentence case, active voice.
- Migrations are additive with a documented rollback in the file header.
- No `SELECT *` in application queries.
- Match the surrounding code style: compact one-line functions in `features/*`, `security definer set search_path=''` for every SQL function.
- Firm staff roles (copied onto linked buildings): `org_owner`, `org_admin`, `portfolio_manager`, `portfolio_assistant`. Roles that may accept a firm code: `org_owner`, `org_admin`, `portfolio_manager`.
- Code format: `XXXX-XXXX` from alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`; firm codes expire after 7 days and are single-use; only the SHA-256 hex hash is stored.

## Deviations from the spec (decided while planning)

- **No `pending` link status.** A pending invitation is an unused, unexpired, unrevoked firm code. `firm_building_links.status` is `active | revoked`, so `firm_org_id` is never null.
- **Firm review inbox lives on `/workspace`**, not in a new `b/[id]/reviews` section. The building side sees review status in the existing Notices list and editor.
- **Rate limiting of code acceptance** uses the existing `rateLimit(user.id,'auth')` helper (10 per 15 minutes) in the server action, not a new SQL limiter.
- **Linking a firm grants all active firm staff** (including assistants) access, not only the creating manager and admins as `create_building` did before.

## Review Focus

1. A code typed in lowercase, with spaces, or without the dash must still be accepted → `normalizeCode` tests in Task 6.
2. A firm code used once must not work a second time, even for a different firm → test in Task 4.
3. A revoked firm member re-invited by email must become a normal member, not a link member that a later revoke silently ignores → `accept_invitation` clears `via_link_id`; test in Task 4.
4. Linked firm staff must not be able to archive the building or remove its building manager or council president (which would stop the building from ever revoking them) → tests in Task 4.
5. A building manager must not be able to approve a draft that was sent to the firm for review → test in Task 5.

---

## File structure

| File | Responsibility |
|---|---|
| `tests/db-harness.ts` (create) | Shared PGlite setup: Supabase role/schema stubs, apply migrations, identity helpers |
| `tests/database.test.ts` (modify) | Use the harness; fix `create_building` call to pass the firm org |
| `tests/firm-links.test.ts` (create) | All Phase 1 database tests |
| `supabase/migrations/20260927090000_firm_links_schema.sql` (create) | Org kinds, link tables, `via_link_id`, permissions, helpers |
| `supabase/migrations/20260927091000_building_orgs.sql` (create) | Building-org tenancy in `bootstrap_workspace`/`create_building`, data split, oversight and invitation fixes, letterhead RPC |
| `supabase/migrations/20260927092000_firm_link_codes.sql` (create) | Code create/accept/revoke, staff sync trigger, guards, status RPC |
| `supabase/migrations/20260927093000_firm_review.sql` (create) | `review_by`, `changes_requested`, review comments, review functions |
| `supabase/tests/isolation.test.sql` (modify) | pgTAP assertions for the new tables |
| `lib/link-codes.ts` (create) | Generate, normalize and hash codes |
| `tests/link-codes.test.ts` (create) | Unit tests for `lib/link-codes.ts` |
| `lib/errors.ts` (modify) | Safe messages for new error codes |
| `features/firm-links/schema.ts` (create) | Zod inputs for firm-link actions |
| `features/firm-links/actions.ts` (create) | `createFirmCodeAction`, `revokeFirmLinkAction`, `acceptFirmCodeAction` |
| `features/firm-links/queries.ts` (create) | `firmLinkStatus`, `firmOrganizations`, `firmReviewInbox` |
| `features/firm-links/components/strata-management-card.tsx` (create) | Building-side link card |
| `features/firm-links/components/join-building-form.tsx` (create) | Firm-side code entry |
| `features/firm-links/components/review-inbox.tsx` (create) | Firm-side pending reviews |
| `features/workspace/schema.ts`, `actions.ts`, `queries.ts` (modify) | Review operations, `review_by` and comments columns, org `kind` |
| `features/workspace/components/review-thread.tsx` (create) | Comment thread under a notice |
| `features/workspace/components/resources.tsx` (modify) | Review buttons and thread in the notice editor |
| `app/(app)/b/[buildingId]/[section]/page.tsx` (modify) | Render the link card on Settings; redirect on lost access; load comments |
| `app/(app)/workspace/page.tsx` (modify) | Join form, review inbox, access-removed banner |
| `app/api/artifacts/[id]/export/route.ts` (modify) | Letterhead from `building_letterhead` RPC |

---

### Task 1: Shared database test harness

**Files:**
- Create: `tests/db-harness.ts`
- Modify: `tests/database.test.ts:1-17`

**Interfaces:**
- Produces: `migratedDb(): Promise<{db:PGlite; sql:(s:string)=>Promise<unknown>; identity:(id:string)=>Promise<void>; admin:()=>Promise<void>; rows:<T>(q:string,p?:unknown[])=>Promise<T[]>}>`, `uid(n:number):string`, `addUsers(t, ...ids:string[])`.

- [ ] **Step 1: Create the harness**

```ts
// tests/db-harness.ts
import {PGlite} from '@electric-sql/pglite';
import {vector} from '@electric-sql/pglite-pgvector';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {pg_trgm} from '@electric-sql/pglite/contrib/pg_trgm';
import {readFile,readdir} from 'node:fs/promises';
// Minimal stand-ins for the Supabase roles and schemas the migrations expect.
const SUPABASE_STUBS=`create role anon; create role authenticated; create role service_role bypassrls; create role supabase_auth_admin;
 create schema auth; create schema storage; create schema extensions;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth,storage,public to authenticated,anon,service_role,supabase_auth_admin;
 grant execute on function auth.uid() to authenticated,anon,service_role,supabase_auth_admin;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;
 create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name,'/') $$;
 grant select,insert on storage.objects to authenticated;`;
export const uid=(n:number)=>'10000000-0000-4000-8000-'+String(n).padStart(12,'0');
export async function migratedDb(){
 const db=new PGlite({extensions:{vector,pgcrypto,pg_trgm}});const sql=(s:string)=>db.exec(s);
 await sql(SUPABASE_STUBS);
 for(const file of (await readdir('supabase/migrations')).filter(f=>f.endsWith('.sql')).sort())await sql(await readFile('supabase/migrations/'+file,'utf8'));
 const identity=async(id:string)=>{await sql("reset role; select set_config('request.jwt.claim.sub','"+id+"',false); set role authenticated;");};
 const admin=async()=>{await sql('reset role;');};
 const rows=async<T>(q:string,p?:unknown[])=>(await db.query<T>(q,p)).rows;
 return {db,sql,identity,admin,rows};
}
export type TestDb=Awaited<ReturnType<typeof migratedDb>>;
export async function addUsers(t:TestDb,...ids:string[]){await t.admin();await t.sql(`insert into auth.users(id,email,email_confirmed_at) values ${ids.map(id=>`('${id}','${id.slice(-4)}@example.test',now())`).join(',')};`);}
```

- [ ] **Step 2: Point `tests/database.test.ts` at the harness**

Replace lines 1–17 (imports through the end of the migration loop inside `beforeAll`) so the file begins:

```ts
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createHmac} from 'node:crypto';
import type {PGlite} from '@electric-sql/pglite';
import {migratedDb} from './db-harness';
let db:PGlite;let sql:(s:string)=>Promise<unknown>;let identity:(id:string)=>Promise<void>;let admin:()=>Promise<void>;
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002',assistant='10000000-0000-4000-8000-000000000003',counsel='10000000-0000-4000-8000-000000000004';
let ba:string,bb:string,chat:string,notice:string;
const embedding=JSON.stringify([1,...Array(1023).fill(0)]);
beforeAll(async()=>{
 ({db,sql,identity,admin}=await migratedDb());
```

Keep everything from the original `await sql(\`insert into auth.users(id,email,email_confirmed_at) values ('${a}'...` line onward unchanged.

- [ ] **Step 3: Run the existing suite**

Run: `pnpm vitest run tests/database.test.ts`
Expected: PASS, same test count as before (no behavior change).

- [ ] **Step 4: Commit**

```bash
git add tests/db-harness.ts tests/database.test.ts
git commit -m "Share the PGlite database test setup"
```

---

### Task 2: Organization kinds and firm link tables

**Files:**
- Create: `supabase/migrations/20260927090000_firm_links_schema.sql`
- Create: `tests/firm-links.test.ts`
- Modify: `supabase/tests/isolation.test.sql`

**Interfaces:**
- Consumes: `migratedDb`, `uid`, `addUsers` (Task 1).
- Produces: tables `firm_building_links(id,building_id,firm_org_id,status,invited_by,accepted_by,revoked_by,created_at,accepted_at,revoked_at)`, `link_codes(id,building_id,kind,code_hash,created_by,expires_at,used_at,revoked_at,created_at)`; columns `organizations.kind`, `building_members.via_link_id`; SQL `public.linked_firm_id(uuid) returns uuid`, `public.managing_org_ids(uuid) returns setof uuid`, `private.add_link_members(uuid) returns void`; permissions `building.link_firm`, `review.act`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/firm-links.test.ts
import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {migratedDb,uid,addUsers,type TestDb} from './db-harness';
let t:TestDb;
const firmOwner=uid(101),firmManager=uid(102),firmAssistant=uid(103),manager=uid(104),otherManager=uid(105),rivalOwner=uid(106),councillor=uid(107);
let firmOrg:string,rivalOrg:string,building:string,otherBuilding:string,firmBuilding:string;
const hash=(code:string)=>createHash('sha256').update(code).digest('hex');
const one=async<T>(q:string)=>(await t.rows<T>(q))[0];
beforeAll(async()=>{
 t=await migratedDb();await addUsers(t,firmOwner,firmManager,firmAssistant,manager,otherManager,rivalOwner,councillor);
 await t.identity(firmOwner);firmBuilding=(await one<{id:string}>(`select public.bootstrap_workspace('Coastline Strata','admin','Harbour View','Fiona') id`)).id;
 await t.identity(manager);building=(await one<{id:string}>(`select public.bootstrap_workspace('Seaside Towers','single_building','Seaside Towers','Maya') id`)).id;
 await t.identity(otherManager);otherBuilding=(await one<{id:string}>(`select public.bootstrap_workspace('Parkside','single_building','Parkside','Omar') id`)).id;
 await t.identity(rivalOwner);await t.sql(`select public.bootstrap_workspace('Rival Strata','multi_building','Rival tower','Rita')`);
 await t.admin();
 firmOrg=(await one<{org_id:string}>(`select org_id from public.org_members where user_id='${firmOwner}'`)).org_id;
 rivalOrg=(await one<{org_id:string}>(`select org_id from public.org_members where user_id='${rivalOwner}'`)).org_id;
 await t.sql(`update public.profiles set account_type='multi_building' where id in ('${firmManager}','${firmAssistant}');
  insert into public.org_members(org_id,user_id,role) values('${firmOrg}','${firmManager}','portfolio_manager'),('${firmOrg}','${firmAssistant}','portfolio_assistant');
  update public.profiles set account_type='single_building' where id='${councillor}';
  insert into public.building_members(building_id,user_id,role) values('${building}','${councillor}','council_president');`);
},60000);
afterAll(()=>t.db.close());

describe('firm link tables',()=>{
 let link:string;
 beforeAll(async()=>{await t.admin();
  link=(await one<{id:string}>(`insert into public.firm_building_links(building_id,firm_org_id,status,accepted_at) values('${otherBuilding}','${rivalOrg}','active',now()) returning id`)).id;
  await t.sql(`insert into public.link_codes(building_id,kind,code_hash,created_by,expires_at) values('${otherBuilding}','firm','${hash('PARK-SIDE')}','${otherManager}',now()+interval '7 days')`);});
 it('marks firm and building organizations by kind',async()=>{await t.admin();expect((await one<{kind:string}>(`select kind from public.organizations where id='${firmOrg}'`)).kind).toBe('firm');expect((await one<{kind:string}>(`select o.kind from public.organizations o join public.buildings b on b.org_id=o.id where b.id='${building}'`)).kind).toBe('building');});
 it('hides another building’s firm link',async()=>{await t.identity(manager);expect(await t.rows(`select id from public.firm_building_links where building_id='${otherBuilding}'`)).toHaveLength(0);});
 it('hides another building’s codes',async()=>{await t.identity(manager);expect(await t.rows(`select id from public.link_codes where building_id='${otherBuilding}'`)).toHaveLength(0);});
 it('shows the link to the building and to the firm',async()=>{await t.identity(otherManager);expect(await t.rows(`select id from public.firm_building_links where id='${link}'`)).toHaveLength(1);await t.identity(rivalOwner);expect(await t.rows(`select id from public.firm_building_links where id='${link}'`)).toHaveLength(1);});
 it('never exposes a stored code hash',async()=>{await t.identity(otherManager);await expect(t.sql(`select code_hash from public.link_codes`)).rejects.toThrow();});
 it('does not let a user write link rows directly',async()=>{await t.identity(otherManager);await expect(t.sql(`update public.firm_building_links set status='revoked' where id='${link}'`)).rejects.toThrow();await expect(t.sql(`insert into public.firm_building_links(building_id,firm_org_id,status) values('${building}','${rivalOrg}','active')`)).rejects.toThrow();});
 it('adds every active firm staff member to the building through the link',async()=>{await t.admin();await t.sql(`select private.add_link_members('${link}')`);const r=await t.rows<{user_id:string;via_link_id:string}>(`select user_id,via_link_id from public.building_members where building_id='${otherBuilding}' and via_link_id is not null`);expect(r.map(x=>x.user_id)).toEqual([rivalOwner]);});
 it('does not let an authenticated user call the link helper',async()=>{await t.identity(manager);await expect(t.sql(`select private.add_link_members('${link}')`)).rejects.toThrow();});
});
```

Note: `bootstrap_workspace('Coastline Strata','admin',…)` must produce `kind='firm'`. Until Task 3 rewrites `bootstrap_workspace`, the backfill below plus an `organizations_kind_default` trigger sets it.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run tests/firm-links.test.ts`
Expected: FAIL — `relation "public.firm_building_links" does not exist` / `column "kind" does not exist`.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/20260927090000_firm_links_schema.sql
-- Phase 1 of docs/superpowers/specs/2026-09-27-roles-billing-design.md: buildings own their organization and
-- link a strata management firm. A link materializes building_members rows tagged via_link_id, so authorize()
-- and every existing policy keep working; revoking suspends exactly those rows.
-- Rollback: drop trigger organizations_kind_from_member on public.org_members; drop function private.set_org_kind();
--  drop function private.add_link_members(uuid); drop function public.managing_org_ids(uuid); drop function public.linked_firm_id(uuid);
--  alter table public.building_members drop column via_link_id; drop table public.link_codes; drop table public.firm_building_links;
--  alter table public.organizations drop column kind;
--  delete from public.role_permissions where permission in ('building.link_firm','review.act');
alter table public.organizations add column kind text not null default 'building' check(kind in ('building','firm'));
update public.organizations o set kind='firm' where exists(select 1 from public.org_members m where m.org_id=o.id and m.role in ('org_owner','org_admin','portfolio_manager','portfolio_assistant'));
-- Until bootstrap_workspace sets kind itself (next migration), an organization whose first member holds a firm role is a firm.
create function private.set_org_kind() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.role in ('org_owner','org_admin','portfolio_manager','portfolio_assistant') then update public.organizations set kind='firm' where id=new.org_id and kind<>'firm'; end if;
 return new;
end; $$;
create trigger organizations_kind_from_member after insert on public.org_members for each row execute function private.set_org_kind();

create table public.firm_building_links (
 id uuid primary key default gen_random_uuid(),
 building_id uuid not null references public.buildings(id),
 firm_org_id uuid not null references public.organizations(id),
 status text not null check(status in ('active','revoked')),
 invited_by uuid references auth.users(id), accepted_by uuid references auth.users(id), revoked_by uuid references auth.users(id),
 created_at timestamptz not null default now(), accepted_at timestamptz, revoked_at timestamptz,
 check(status<>'revoked' or revoked_at is not null)
);
create unique index firm_links_active_idx on public.firm_building_links(building_id) where status='active';
create index firm_links_building_idx on public.firm_building_links(building_id);
create index firm_links_firm_idx on public.firm_building_links(firm_org_id,status);

create table public.link_codes (
 id uuid primary key default gen_random_uuid(),
 building_id uuid not null references public.buildings(id),
 kind text not null check(kind in ('firm','resident')),
 code_hash text not null unique check(code_hash ~ '^[0-9a-f]{64}$'),
 created_by uuid not null references auth.users(id),
 expires_at timestamptz not null, used_at timestamptz, revoked_at timestamptz,
 created_at timestamptz not null default now()
);
create index link_codes_building_idx on public.link_codes(building_id,kind);

alter table public.building_members add column via_link_id uuid references public.firm_building_links(id);
create index building_members_link_idx on public.building_members(via_link_id) where via_link_id is not null;

insert into public.role_permissions(role,permission) values
 ('building_manager','building.link_firm'),('council_president','building.link_firm'),
 ('org_owner','review.act'),('org_admin','review.act'),('portfolio_manager','review.act');

alter table public.firm_building_links enable row level security;
alter table public.link_codes enable row level security;
create policy firm_links_read on public.firm_building_links for select to authenticated using(public.authorize('member.read',building_id) or public.is_org_member(firm_org_id));
create policy link_codes_read on public.link_codes for select to authenticated using(public.authorize('building.link_firm',building_id) or (kind='resident' and public.authorize('member.invite',building_id)));
revoke all on public.firm_building_links,public.link_codes from public,anon,authenticated;
grant select on public.firm_building_links to authenticated;
grant select(id,building_id,kind,created_by,expires_at,used_at,revoked_at,created_at) on public.link_codes to authenticated;
create trigger audit_firm_links after insert or update on public.firm_building_links for each row execute function public.audit_change();

create function public.linked_firm_id(p_building uuid) returns uuid language sql stable security definer set search_path='' as $$
 select firm_org_id from public.firm_building_links where building_id=p_building and status='active'; $$;
create function public.managing_org_ids(p_building uuid) returns setof uuid language sql stable security definer set search_path='' as $$
 select org_id from public.buildings where id=p_building
 union select firm_org_id from public.firm_building_links where building_id=p_building and status='active'; $$;
-- Firm staff join the building with their firm role. An existing active personal membership is left untouched.
create function private.add_link_members(p_link uuid) returns void language plpgsql security definer set search_path='' as $$
declare l public.firm_building_links;
begin
 select * into l from public.firm_building_links where id=p_link and status='active';
 if not found then return; end if;
 insert into public.building_members(building_id,user_id,role,via_link_id)
 select l.building_id,m.user_id,m.role,l.id from public.org_members m
 where m.org_id=l.firm_org_id and m.status='active' and m.role in ('org_owner','org_admin','portfolio_manager','portfolio_assistant')
 on conflict(building_id,user_id) do update set role=excluded.role,status='active',via_link_id=excluded.via_link_id,expires_at=null
 where public.building_members.via_link_id is not null or public.building_members.status<>'active';
end; $$;
revoke all on function private.add_link_members(uuid),private.set_org_kind() from public,anon,authenticated;
revoke all on function public.linked_firm_id(uuid),public.managing_org_ids(uuid) from public,anon;
grant execute on function public.linked_firm_id(uuid),public.managing_org_ids(uuid) to authenticated;
```

- [ ] **Step 4: Add pgTAP assertions**

In `supabase/tests/isolation.test.sql`, change `select plan(8);` to `select plan(10);` and add after the `foreign chat permission denies` line:

```sql
select is((select count(*)::integer from public.firm_building_links where building_id=current_setting('test.building_b')::uuid),0,'foreign firm links are hidden');
select is((select count(*)::integer from public.link_codes where building_id=current_setting('test.building_b')::uuid),0,'foreign link codes are hidden');
```

- [ ] **Step 5: Run the tests**

Run: `pnpm vitest run tests/firm-links.test.ts tests/database.test.ts`
Expected: PASS (including the existing "enables RLS on every public table").

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260927090000_firm_links_schema.sql tests/firm-links.test.ts supabase/tests/isolation.test.sql
git commit -m "Add organization kinds and firm link tables"
```

---

### Task 3: Buildings in their own organizations

**Files:**
- Create: `supabase/migrations/20260927091000_building_orgs.sql`
- Modify: `tests/firm-links.test.ts` (append describe block)
- Modify: `tests/database.test.ts` (the `single-building conflicts when inviting` `beforeAll`)
- Modify: `app/api/artifacts/[id]/export/route.ts`

**Interfaces:**
- Consumes: `private.add_link_members`, `public.managing_org_ids` (Task 2).
- Produces: `private.create_firm_building(p_firm uuid,p_name text,p_plan text,p_address text,p_units integer) returns uuid`; `private.split_firm_buildings() returns integer`; `public.building_letterhead(p_building uuid) returns table(letterhead text,signature_block text)`; `bootstrap_workspace` and `create_building` now put every building in its own `kind='building'` organization with an active link to the creating firm.

- [ ] **Step 1: Write the failing tests** (append to `tests/firm-links.test.ts`)

```ts
describe('buildings own their organization',()=>{
 it('puts a firm’s first building in its own building organization linked to the firm',async()=>{await t.admin();const r=await one<{kind:string;firm:string}>(`select o.kind,l.firm_org_id firm from public.buildings b join public.organizations o on o.id=b.org_id join public.firm_building_links l on l.building_id=b.id and l.status='active' where b.id='${firmBuilding}'`);expect(r).toEqual({kind:'building',firm:firmOrg});});
 it('gives all firm staff access to a building the firm creates',async()=>{await t.identity(firmOwner);const created=(await one<{id:string}>(`select public.create_building('${firmOrg}','Marina Court',null,'',null) id`)).id;for(const u of [firmOwner,firmManager,firmAssistant]){await t.identity(u);expect((await one<{ok:boolean}>(`select public.has_building_access('${created}') ok`)).ok).toBe(true);}});
 it('does not let a building organization create buildings',async()=>{await t.identity(manager);const org=(await one<{org_id:string}>(`select org_id from public.buildings where id='${building}'`)).org_id;await expect(t.sql(`select public.create_building('${org}','Sneaky annex',null,'',null)`)).rejects.toThrow('forbidden');});
 it('moves an existing firm-owned building into its own organization without losing access',async()=>{
  const legacyOwner=uid(120);await addUsers(t,legacyOwner);await t.admin();
  const org=(await one<{id:string}>(`insert into public.organizations(name,created_by,kind,letterhead) values('Legacy Strata','${legacyOwner}','firm','Legacy letterhead') returning id`)).id;
  await t.sql(`update public.profiles set account_type='admin' where id='${legacyOwner}';insert into public.org_members(org_id,user_id,role) values('${org}','${legacyOwner}','org_owner');`);
  const old=(await one<{id:string}>(`insert into public.buildings(org_id,name) values('${org}','Legacy Place') returning id`)).id;
  await t.sql(`insert into public.building_members(building_id,user_id,role) values('${old}','${legacyOwner}','org_owner')`);
  expect((await one<{n:number}>(`select private.split_firm_buildings() n`)).n).toBe(1);
  const r=await one<{kind:string;letterhead:string;via:string|null}>(`select o.kind,o.letterhead,m.via_link_id via from public.buildings b join public.organizations o on o.id=b.org_id join public.building_members m on m.building_id=b.id and m.user_id='${legacyOwner}' where b.id='${old}'`);
  expect(r.kind).toBe('building');expect(r.letterhead).toBe('Legacy letterhead');expect(r.via).not.toBeNull();
  await t.identity(legacyOwner);expect((await one<{ok:boolean}>(`select public.authorize('chat.use','${old}') ok`)).ok).toBe(true);});
 it('uses the linked firm’s letterhead for a managed building',async()=>{await t.admin();await t.sql(`update public.organizations set letterhead='Coastline letterhead' where id='${firmOrg}'`);await t.identity(firmOwner);expect((await one<{letterhead:string}>(`select letterhead from public.building_letterhead('${firmBuilding}')`)).letterhead).toBe('Coastline letterhead');});
 it('returns no letterhead for a building the caller cannot use',async()=>{await t.identity(manager);expect(await t.rows(`select letterhead from public.building_letterhead('${firmBuilding}')`)).toHaveLength(0);});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/firm-links.test.ts -t "own their organization"`
Expected: FAIL — `firm_org_id` null join / `function private.split_firm_buildings() does not exist`.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/20260927091000_building_orgs.sql
-- Every building gets its own kind='building' organization. Firms reach buildings through firm_building_links.
-- Rollback (restores firm ownership for split buildings, then drop the functions below and re-apply the previous
-- definitions of bootstrap_workspace, create_building, user_org_ids, list_account_links_for_building, create_invitation):
--  update public.buildings b set org_id=l.firm_org_id from public.firm_building_links l
--   where l.building_id=b.id and l.status='active' and not exists(select 1 from public.org_members m where m.org_id=b.org_id);
drop trigger organizations_kind_from_member on public.org_members;
drop function private.set_org_kind();

create function private.create_firm_building(p_firm uuid,p_name text,p_plan text,p_address text,p_units integer) returns uuid language plpgsql security definer set search_path='' as $$
declare f public.organizations; o uuid; b uuid; l uuid;
begin
 select * into f from public.organizations where id=p_firm and kind='firm';
 if not found then raise exception 'forbidden'; end if;
 insert into public.organizations(name,created_by,kind,letterhead,signature_block,separation_of_duties)
 values(left(p_name,120),auth.uid(),'building',f.letterhead,f.signature_block,f.separation_of_duties) returning id into o;
 insert into public.buildings(org_id,name,strata_plan_no,address,unit_count) values(o,left(p_name,120),nullif(p_plan,''),coalesce(p_address,''),p_units) returning id into b;
 insert into public.firm_building_links(building_id,firm_org_id,status,invited_by,accepted_by,accepted_at) values(b,p_firm,'active',auth.uid(),auth.uid(),now()) returning id into l;
 perform private.add_link_members(l);
 return b;
end; $$;

create or replace function public.bootstrap_workspace(p_name text,p_account_type public.account_type,p_building_name text,p_display_name text) returns uuid language plpgsql security definer set search_path='' as $$
declare o uuid; b uuid; r public.app_role;
begin
 if auth.uid() is null then raise exception 'unauthorized'; end if;
 perform 1 from public.profiles where id=auth.uid() and account_type is null for update;
 if not found then raise exception 'already_configured'; end if;
 if length(p_name)<2 or length(p_building_name)<2 then raise exception 'invalid_input'; end if;
 update public.profiles set account_type=p_account_type,display_name=left(p_display_name,100),consent_at=now() where id=auth.uid();
 r:=case p_account_type when 'admin' then 'org_owner'::public.app_role when 'multi_building' then 'portfolio_manager'::public.app_role else 'building_manager'::public.app_role end;
 if p_account_type='single_building' then
  insert into public.organizations(name,created_by,kind) values(left(p_name,120),auth.uid(),'building') returning id into o;
  insert into public.org_members(org_id,user_id,role) values(o,auth.uid(),r);
  insert into public.buildings(org_id,name) values(o,left(p_building_name,120)) returning id into b;
  insert into public.building_members(building_id,user_id,role) values(b,auth.uid(),r);
 else
  insert into public.organizations(name,created_by,kind) values(left(p_name,120),auth.uid(),'firm') returning id into o;
  insert into public.org_members(org_id,user_id,role) values(o,auth.uid(),r);
  b:=private.create_firm_building(o,p_building_name,null,'',null);
 end if;
 return b;
end; $$;

create or replace function public.create_building(p_org_id uuid,p_name text,p_plan text,p_address text,p_units integer) returns uuid language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.org_members m join public.profiles p on p.id=m.user_id join public.organizations o on o.id=m.org_id
  where m.org_id=p_org_id and m.user_id=auth.uid() and m.status='active' and o.kind='firm' and p.account_type<>'single_building' and m.role in ('org_owner','org_admin','portfolio_manager')) then raise exception 'forbidden'; end if;
 if length(coalesce(p_name,''))<2 then raise exception 'invalid_input'; end if;
 return private.create_firm_building(p_org_id,p_name,p_plan,p_address,p_units);
end; $$;

-- One-time move of buildings that still sit inside a firm organization. Returns how many moved.
create function private.split_firm_buildings() returns integer language plpgsql security definer set search_path='' as $$
declare r record; o uuid; l uuid; n integer:=0;
begin
 for r in select b.id,b.name,f.id firm,f.created_by,f.letterhead,f.signature_block,f.separation_of_duties
  from public.buildings b join public.organizations f on f.id=b.org_id where f.kind='firm' loop
  insert into public.organizations(name,created_by,kind,letterhead,signature_block,separation_of_duties)
  values(r.name,r.created_by,'building',r.letterhead,r.signature_block,r.separation_of_duties) returning id into o;
  update public.buildings set org_id=o where id=r.id;
  insert into public.firm_building_links(building_id,firm_org_id,status,accepted_at) values(r.id,r.firm,'active',now()) returning id into l;
  update public.building_members set via_link_id=l where building_id=r.id and user_id in (select user_id from public.org_members where org_id=r.firm and role in ('org_owner','org_admin','portfolio_manager','portfolio_assistant'));
  n:=n+1;
 end loop;
 return n;
end; $$;
select private.split_firm_buildings();

-- Organization oversight follows the firm that manages a building, not only the building's own organization.
create or replace function public.user_org_ids(p_user uuid) returns setof uuid language sql stable security definer set search_path='' as $$
 select org_id from public.org_members where user_id=p_user
 union select b.org_id from public.building_members m join public.buildings b on b.id=m.building_id where m.user_id=p_user
 union select l.firm_org_id from public.building_members m join public.firm_building_links l on l.building_id=m.building_id and l.status='active' where m.user_id=p_user and m.via_link_id is null; $$;
create or replace function public.list_account_links_for_building(p_building uuid) returns table(id uuid,first_account text,second_account text,created_at timestamptz,expires_at timestamptz,revoked_at timestamptz) language sql stable security definer set search_path='' as $$
 select l.id,pa.display_name||' · '||ua.email::text,pb.display_name||' · '||ub.email::text,l.created_at,l.expires_at,l.revoked_at
 from public.linked_accounts l
 join public.profiles pa on pa.id=l.user_a join auth.users ua on ua.id=l.user_a
 join public.profiles pb on pb.id=l.user_b join auth.users ub on ub.id=l.user_b
 where exists(select 1 from public.buildings b where b.id=p_building and b.deleted_at is null)
 and exists(select 1 from public.managing_org_ids(p_building) as o(org_id) where public.is_org_admin(o.org_id)
  and (o.org_id in (select public.user_org_ids(l.user_a)) or o.org_id in (select public.user_org_ids(l.user_b))))
 order by l.created_at desc; $$;

-- Same-organization warning now means "managed by the same organization or firm".
create or replace function public.create_invitation(p_building uuid,p_email text,p_role public.app_role,p_hash text,p_expires timestamptz) returns uuid language plpgsql security definer set search_path='' as $$
declare i uuid;
begin
 if not public.authorize('member.invite',p_building) or not public.can_assign(p_building,p_role) then raise exception 'forbidden'; end if;
 if exists(select 1 from public.building_members m join auth.users u on u.id=m.user_id where m.building_id=p_building and lower(u.email)=lower(trim(p_email)) and m.status='active' and (m.expires_at is null or m.expires_at>now())) then raise exception 'already_member'; end if;
 -- Leftover rows from a revoked firm link do not block re-inviting that person as an ordinary member.
 if exists(select 1 from public.building_members m join auth.users u on u.id=m.user_id where m.building_id=p_building and lower(u.email)=lower(trim(p_email)) and m.via_link_id is null and not public.can_assign(p_building,m.role)) then raise exception 'forbidden'; end if;
 if exists(select 1 from auth.users u join public.profiles p on p.id=u.id
  where lower(u.email)=lower(trim(p_email)) and p.account_type='single_building' and p.bound_building_id<>p_building
  and exists(select 1 from public.managing_org_ids(p.bound_building_id) as x(org_id) where x.org_id in (select public.managing_org_ids(p_building)))) then raise exception 'single_building_conflict'; end if;
 if p_role='external_counsel' and (p_expires is null or p_expires<=now() or p_expires>now()+interval '90 days') then raise exception 'expiry_required'; end if;
 insert into public.invitations(building_id,email,role,invited_by,token_hash,membership_expires_at) values(p_building,lower(trim(p_email)),p_role,auth.uid(),p_hash,p_expires) returning id into i;
 return i;
end; $$;

-- Letterhead of the firm managing the building, otherwise the building's own organization.
create function public.building_letterhead(p_building uuid) returns table(letterhead text,signature_block text) language sql stable security definer set search_path='' as $$
 select o.letterhead,o.signature_block from public.buildings b
 join public.organizations o on o.id=coalesce(public.linked_firm_id(b.id),b.org_id)
 where b.id=p_building and public.authorize('chat.use',p_building); $$;
revoke all on function private.create_firm_building(uuid,text,text,text,integer),private.split_firm_buildings() from public,anon,authenticated;
revoke all on function public.building_letterhead(uuid) from public,anon;
grant execute on function public.building_letterhead(uuid) to authenticated;
```

Before writing `create_invitation`, open `supabase/migrations/20260915095000_invitation_conflict_same_org.sql` and confirm the body above matches it except for the `single_building_conflict` condition; if that file has changed, carry its other lines over verbatim.

- [ ] **Step 4: Fix the existing test that passed a building's org to `create_building`**

In `tests/database.test.ts`, inside `describe('single-building conflicts when inviting'…)`'s `beforeAll`, replace

```ts
const org=(await db.query<{org_id:string}>(`select org_id from public.buildings where id='${ba}'`)).rows[0].org_id;
```

with

```ts
const org=(await db.query<{org_id:string}>(`select org_id from public.org_members where user_id='${a}'`)).rows[0].org_id;
```

- [ ] **Step 5: Use the letterhead RPC in the export route**

In `app/api/artifacts/[id]/export/route.ts` replace

```ts
const b=await user.client.from('buildings').select('name,org_id').eq('id',data.building_id).single();checkDb(b.error);if(!b.data)throw new NotFoundError();const org=await user.client.from('organizations').select('letterhead,signature_block').eq('id',b.data.org_id).maybeSingle();
```

with

```ts
const b=await user.client.from('buildings').select('name').eq('id',data.building_id).single();checkDb(b.error);if(!b.data)throw new NotFoundError();const org=await user.client.rpc('building_letterhead',{p_building:data.building_id}).maybeSingle<{letterhead:string;signature_block:string}>();checkDb(org.error);
```

- [ ] **Step 6: Run the tests**

Run: `pnpm vitest run tests/firm-links.test.ts tests/database.test.ts && pnpm typecheck`
Expected: PASS. In particular the existing `organization oversight of linked accounts` and `single-building conflicts when inviting` blocks still pass.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260927091000_building_orgs.sql tests/firm-links.test.ts tests/database.test.ts "app/api/artifacts/[id]/export/route.ts"
git commit -m "Give every building its own organization, linked to its firm"
```

---

### Task 4: Firm codes, accept, revoke and guards

**Files:**
- Create: `supabase/migrations/20260927092000_firm_link_codes.sql`
- Modify: `tests/firm-links.test.ts` (append)

**Interfaces:**
- Consumes: Task 2 tables and `private.add_link_members`.
- Produces (all callable by `authenticated`):
  - `public.create_firm_code(p_building uuid,p_hash text) returns uuid`
  - `public.accept_firm_code(p_hash text,p_firm_org uuid) returns uuid` (returns the building id)
  - `public.revoke_firm_link(p_building uuid) returns void`
  - `public.building_firm_status(p_building uuid) returns table(status text,firm_name text,since timestamptz,code_expires_at timestamptz)` — `status` is `'none'|'invited'|'active'`
  - Error codes: `invalid_code`, `revoked_code`, `expired_code`, `wrong_code_kind`, `firm_already_linked`, `no_firm_link`, `linked_member`, `forbidden`.

- [ ] **Step 1: Write the failing tests** (append)

```ts
describe('inviting, accepting and removing a firm',()=>{
 const code='SEAS-7QK4';
 const hasAccess=async(u:string)=>{await t.identity(u);return (await one<{ok:boolean}>(`select public.has_building_access('${building}') ok`)).ok;};
 it('does not let a council member without link rights create a firm code',async()=>{const member=uid(130);await addUsers(t,member);await t.admin();await t.sql(`update public.profiles set account_type='single_building' where id='${member}';insert into public.building_members(building_id,user_id,role) values('${building}','${member}','council_member')`);await t.identity(member);await expect(t.sql(`select public.create_firm_code('${building}','${hash('NOPE-NOPE')}')`)).rejects.toThrow('forbidden');});
 it('shows no firm before an invitation',async()=>{await t.identity(manager);expect((await one<{status:string}>(`select status from public.building_firm_status('${building}')`)).status).toBe('none');});
 it('lets the building manager create a code and shows the invitation as pending',async()=>{await t.identity(manager);await t.sql(`select public.create_firm_code('${building}','${hash(code)}')`);expect((await one<{status:string}>(`select status from public.building_firm_status('${building}')`)).status).toBe('invited');});
 it('hides the firm status from another building',async()=>{await t.identity(otherManager);expect(await t.rows(`select status from public.building_firm_status('${building}')`)).toHaveLength(0);});
 it('does not let a firm assistant accept a code',async()=>{await t.identity(firmAssistant);await expect(t.sql(`select public.accept_firm_code('${hash(code)}','${firmOrg}')`)).rejects.toThrow('forbidden');});
 it('does not let someone accept on behalf of a firm they do not belong to',async()=>{await t.identity(rivalOwner);await expect(t.sql(`select public.accept_firm_code('${hash(code)}','${firmOrg}')`)).rejects.toThrow('forbidden');});
 it('rejects an unknown code',async()=>{await t.identity(firmManager);await expect(t.sql(`select public.accept_firm_code('${hash('ZZZZ-ZZZZ')}','${firmOrg}')`)).rejects.toThrow('invalid_code');});
 it('links the firm and gives all its staff access when a manager accepts',async()=>{await t.identity(firmManager);expect((await one<{b:string}>(`select public.accept_firm_code('${hash(code)}','${firmOrg}') b`)).b).toBe(building);for(const u of [firmOwner,firmManager,firmAssistant])expect(await hasAccess(u)).toBe(true);await t.identity(manager);expect((await one<{status:string;firm_name:string}>(`select status,firm_name from public.building_firm_status('${building}')`))).toMatchObject({status:'active',firm_name:'Coastline Strata'});});
 it('does not accept the same code twice, even for another firm',async()=>{await t.identity(rivalOwner);await expect(t.sql(`select public.accept_firm_code('${hash(code)}','${rivalOrg}')`)).rejects.toThrow('invalid_code');});
 it('does not create a second code while a firm is linked',async()=>{await t.identity(manager);await expect(t.sql(`select public.create_firm_code('${building}','${hash('SECO-NDCD')}')`)).rejects.toThrow('firm_already_linked');});
 it('gives a new firm staff member access and removes it when they leave',async()=>{const hire=uid(131);await addUsers(t,hire);await t.admin();await t.sql(`update public.profiles set account_type='multi_building' where id='${hire}';insert into public.org_members(org_id,user_id,role) values('${firmOrg}','${hire}','portfolio_assistant')`);expect(await hasAccess(hire)).toBe(true);await t.admin();await t.sql(`update public.org_members set status='suspended' where user_id='${hire}'`);expect(await hasAccess(hire)).toBe(false);});
 it('does not let linked firm staff remove the building manager',async()=>{await t.admin();const m=(await one<{id:string}>(`select id from public.building_members where building_id='${building}' and user_id='${manager}'`)).id;await t.identity(firmOwner);await expect(t.sql(`select public.change_membership('${m}','council_member',true)`)).rejects.toThrow('forbidden');});
 it('does not let linked firm staff archive the building',async()=>{await t.identity(firmOwner);await expect(t.sql(`select public.archive_building('${building}')`)).rejects.toThrow('forbidden');});
 it('does not let the building remove one linked firm member on their own',async()=>{await t.admin();const m=(await one<{id:string}>(`select id from public.building_members where building_id='${building}' and user_id='${firmAssistant}'`)).id;await t.identity(manager);await expect(t.sql(`select public.change_membership('${m}','council_member',true)`)).rejects.toThrow('linked_member');});
 it('does not let the firm remove itself',async()=>{await t.identity(firmOwner);await expect(t.sql(`select public.revoke_firm_link('${building}')`)).rejects.toThrow('forbidden');});
 it('removes every firm staff member’s access immediately when the building revokes',async()=>{await t.identity(councillor);await t.sql(`select public.revoke_firm_link('${building}')`);for(const u of [firmOwner,firmManager,firmAssistant])expect(await hasAccess(u)).toBe(false);await t.identity(manager);expect((await one<{status:string}>(`select status from public.building_firm_status('${building}')`)).status).toBe('none');});
 it('keeps the building’s own people after revoking',async()=>{expect(await hasAccess(manager)).toBe(true);expect(await hasAccess(councillor)).toBe(true);});
 it('rejects an expired code',async()=>{await t.identity(manager);await t.sql(`select public.create_firm_code('${building}','${hash('OLDC-ODE2')}')`);await t.admin();await t.sql(`update public.link_codes set expires_at=now()-interval '1 minute' where code_hash='${hash('OLDC-ODE2')}'`);await t.identity(firmManager);await expect(t.sql(`select public.accept_firm_code('${hash('OLDC-ODE2')}','${firmOrg}')`)).rejects.toThrow('expired_code');});
 it('rejects a code the building replaced with a newer one',async()=>{await t.identity(manager);await t.sql(`select public.create_firm_code('${building}','${hash('FRST-CODE')}')`);await t.sql(`select public.create_firm_code('${building}','${hash('SCND-CODE')}')`);await t.identity(firmManager);await expect(t.sql(`select public.accept_firm_code('${hash('FRST-CODE')}','${firmOrg}')`)).rejects.toThrow('revoked_code');});
 it('rejects a resident code offered as a firm code',async()=>{await t.admin();await t.sql(`insert into public.link_codes(building_id,kind,code_hash,created_by,expires_at) values('${building}','resident','${hash('RESI-DENT')}','${manager}',now()+interval '1 day')`);await t.identity(firmManager);await expect(t.sql(`select public.accept_firm_code('${hash('RESI-DENT')}','${firmOrg}')`)).rejects.toThrow('wrong_code_kind');});
 it('turns a revoked firm member re-invited by email into an ordinary member',async()=>{await t.identity(manager);await t.sql(`select public.create_invitation('${building}','${firmAssistant.slice(-4)}@example.test','council_member','reinvite-hash',null)`);await t.identity(firmAssistant);await t.sql(`select public.accept_invitation('reinvite-hash')`);await t.admin();expect((await one<{via:string|null}>(`select via_link_id via from public.building_members where building_id='${building}' and user_id='${firmAssistant}'`)).via).toBeNull();});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/firm-links.test.ts -t "inviting, accepting"`
Expected: FAIL — `function public.create_firm_code(uuid, unknown) does not exist`.

- [ ] **Step 3: Write the migration**

Before writing, open `supabase/migrations/20260915090000_invitation_member_guard.sql` (`accept_invitation`) and `20260914092517_members_and_retrieval.sql` (`change_membership`) and confirm the bodies below match them apart from the marked lines.

```sql
-- supabase/migrations/20260927092000_firm_link_codes.sql
-- Firm codes: the building creates, a firm manager accepts once, the building revokes. Staff changes in the firm
-- follow automatically. Linked staff cannot archive the building or remove the people who can revoke them.
-- Rollback: drop trigger sync_firm_member on public.org_members; drop the functions created here; re-apply the previous
--  change_membership, archive_building and accept_invitation definitions.
create function public.create_firm_code(p_building uuid,p_hash text) returns uuid language plpgsql security definer set search_path='' as $$
declare c uuid;
begin
 if not public.authorize('building.link_firm',p_building) then raise exception 'forbidden'; end if;
 if p_hash !~ '^[0-9a-f]{64}$' then raise exception 'invalid_input'; end if;
 if exists(select 1 from public.firm_building_links where building_id=p_building and status='active') then raise exception 'firm_already_linked'; end if;
 update public.link_codes set revoked_at=now() where building_id=p_building and kind='firm' and revoked_at is null and used_at is null;
 insert into public.link_codes(building_id,kind,code_hash,created_by,expires_at) values(p_building,'firm',p_hash,auth.uid(),now()+interval '7 days') returning id into c;
 return c;
end; $$;

create function public.accept_firm_code(p_hash text,p_firm_org uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.link_codes; l uuid;
begin
 if auth.uid() is null then raise exception 'unauthorized'; end if;
 if not exists(select 1 from public.org_members m join public.organizations o on o.id=m.org_id where m.org_id=p_firm_org and m.user_id=auth.uid() and m.status='active' and o.kind='firm' and m.role in ('org_owner','org_admin','portfolio_manager')) then raise exception 'forbidden'; end if;
 select * into c from public.link_codes where code_hash=p_hash for update;
 if not found or c.used_at is not null then raise exception 'invalid_code'; end if;
 if c.kind<>'firm' then raise exception 'wrong_code_kind'; end if;
 if c.revoked_at is not null then raise exception 'revoked_code'; end if;
 if c.expires_at<=now() then raise exception 'expired_code'; end if;
 if exists(select 1 from public.firm_building_links where building_id=c.building_id and status='active') then raise exception 'firm_already_linked'; end if;
 insert into public.firm_building_links(building_id,firm_org_id,status,invited_by,accepted_by,accepted_at) values(c.building_id,p_firm_org,'active',c.created_by,auth.uid(),now()) returning id into l;
 update public.link_codes set used_at=now() where id=c.id;
 perform private.add_link_members(l);
 return c.building_id;
end; $$;

create function public.revoke_firm_link(p_building uuid) returns void language plpgsql security definer set search_path='' as $$
declare l uuid;
begin
 if not public.authorize('building.link_firm',p_building) then raise exception 'forbidden'; end if;
 select id into l from public.firm_building_links where building_id=p_building and status='active' for update;
 if not found then raise exception 'no_firm_link'; end if;
 update public.firm_building_links set status='revoked',revoked_by=auth.uid(),revoked_at=now() where id=l;
 update public.building_members set status='suspended' where via_link_id=l;
 update public.link_codes set revoked_at=now() where building_id=p_building and kind='firm' and revoked_at is null and used_at is null;
end; $$;

create function public.building_firm_status(p_building uuid) returns table(status text,firm_name text,since timestamptz,code_expires_at timestamptz) language sql stable security definer set search_path='' as $$
 select case when l.id is not null then 'active' when c.id is not null then 'invited' else 'none' end,o.name,l.accepted_at,c.expires_at
 from (select 1) x
 left join public.firm_building_links l on l.building_id=p_building and l.status='active'
 left join public.organizations o on o.id=l.firm_org_id
 left join lateral (select id,expires_at from public.link_codes where building_id=p_building and kind='firm' and revoked_at is null and used_at is null and expires_at>now() order by created_at desc limit 1) c on true
 where public.authorize('member.read',p_building); $$;

-- Joining or leaving a firm updates access to every building the firm is linked to.
create function private.sync_firm_member() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='active' and new.role in ('org_owner','org_admin','portfolio_manager','portfolio_assistant') then
  insert into public.building_members(building_id,user_id,role,via_link_id)
  select l.building_id,new.user_id,new.role,l.id from public.firm_building_links l where l.firm_org_id=new.org_id and l.status='active'
  on conflict(building_id,user_id) do update set role=excluded.role,status='active',via_link_id=excluded.via_link_id,expires_at=null
  where public.building_members.via_link_id is not null or public.building_members.status<>'active';
 else
  update public.building_members m set status='suspended' from public.firm_building_links l where m.via_link_id=l.id and l.firm_org_id=new.org_id and m.user_id=new.user_id;
 end if;
 return new;
end; $$;
create trigger sync_firm_member after insert or update on public.org_members for each row execute function private.sync_firm_member();

create or replace function public.change_membership(p_id uuid,p_role public.app_role,p_remove boolean default false) returns void language plpgsql security definer set search_path='' as $$
declare m public.building_members;
begin
 select * into m from public.building_members where id=p_id for update;
 if not found or not public.authorize('member.update_role',m.building_id) then raise exception 'forbidden'; end if;
 -- New: firm access is granted and removed as a whole through the link (checked before rank, so the message is specific).
 if m.via_link_id is not null then raise exception 'linked_member'; end if;
 if m.user_id=auth.uid() or not public.can_assign(m.building_id,m.role) or not public.can_assign(m.building_id,p_role) then raise exception 'forbidden'; end if;
 -- New: linked firm staff cannot remove or demote the people who can revoke the firm.
 if m.role in ('building_manager','council_president') and exists(select 1 from public.building_members me where me.building_id=m.building_id and me.user_id=auth.uid() and me.via_link_id is not null) then raise exception 'forbidden'; end if;
 update public.building_members set role=p_role,status=case when p_remove then 'suspended' else 'active' end where id=p_id;
end; $$;

create or replace function public.archive_building(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.authorize('building.delete',p_id) then raise exception 'forbidden'; end if;
 -- New: a linked firm cannot archive a building it does not own.
 if exists(select 1 from public.building_members where building_id=p_id and user_id=auth.uid() and via_link_id is not null) then raise exception 'forbidden'; end if;
 update public.buildings set deleted_at=now() where id=p_id;
end; $$;

create or replace function public.accept_invitation(p_hash text) returns uuid language plpgsql security definer set search_path='' as $$
declare i public.invitations; em text;
begin
 select email into em from auth.users where id=auth.uid() and email_confirmed_at is not null;
 select * into i from public.invitations where token_hash=p_hash and email=lower(em) and expires_at>now() and accepted_at is null and revoked_at is null for update;
 if not found then raise exception 'invalid_invitation'; end if;
 update public.profiles set account_type=coalesce(account_type,case when i.role in ('org_admin','org_owner') then 'admin'::public.account_type when i.role in ('portfolio_manager','portfolio_assistant') then 'multi_building'::public.account_type else 'single_building'::public.account_type end),consent_at=now() where id=auth.uid();
 insert into public.building_members(building_id,user_id,role,expires_at) values(i.building_id,auth.uid(),i.role,i.membership_expires_at)
 on conflict(building_id,user_id) do update set role=excluded.role,status='active',expires_at=excluded.expires_at,via_link_id=null -- New: an invited person is an ordinary member
 where public.building_members.status<>'active' or (public.building_members.expires_at is not null and public.building_members.expires_at<=now());
 if not found then raise exception 'already_member'; end if;
 update public.invitations set accepted_at=now() where id=i.id;
 return i.building_id;
end; $$;

revoke all on function private.sync_firm_member() from public,anon,authenticated;
revoke all on function public.create_firm_code(uuid,text),public.accept_firm_code(text,uuid),public.revoke_firm_link(uuid),public.building_firm_status(uuid) from public,anon;
grant execute on function public.create_firm_code(uuid,text),public.accept_firm_code(text,uuid),public.revoke_firm_link(uuid),public.building_firm_status(uuid) to authenticated;
```

- [ ] **Step 4: Run the tests**

Run: `pnpm vitest run tests/firm-links.test.ts tests/database.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260927092000_firm_link_codes.sql tests/firm-links.test.ts
git commit -m "Let a building invite, accept and revoke its strata firm"
```

---

### Task 5: Review hand-off to the firm (database)

**Files:**
- Create: `supabase/migrations/20260927093000_firm_review.sql`
- Modify: `tests/firm-links.test.ts` (append)

**Interfaces:**
- Consumes: Task 4 functions.
- Produces: `generated_documents.review_by text ('building'|'firm')`; status `changes_requested`; table `document_review_comments(id,document_id,building_id,author_id,body,created_at)`; functions `public.request_firm_review(p_id uuid)`, `public.decide_firm_review(p_id uuid,p_decision text,p_comment text)`, `public.comment_on_review(p_id uuid,p_body text) returns uuid`; `revoke_firm_link` now returns open firm reviews to draft. Error codes `no_firm_link`, `comment_required`, `firm_review_pending`, `self_approval_not_permitted`, `invalid_transition`.

- [ ] **Step 1: Write the failing tests** (append)

```ts
describe('sending a draft to the firm for review',()=>{
 let draft:string;const code='REVW-CODE';
 const statusOf=async()=>{await t.admin();return (await one<{status:string;review_by:string}>(`select status,review_by from public.generated_documents where id='${draft}'`));};
 beforeAll(async()=>{await t.identity(manager);draft=(await one<{id:string}>(`insert into public.generated_documents(building_id,created_by,title,kind,body_md) values('${building}','${manager}','Noise notice','s135_notice','A draft for review') returning id`)).id;});
 it('cannot be sent while no firm is linked',async()=>{await t.identity(manager);await expect(t.sql(`select public.request_firm_review('${draft}')`)).rejects.toThrow('no_firm_link');});
 it('goes to the firm once a firm is linked',async()=>{await t.identity(manager);await t.sql(`select public.create_firm_code('${building}','${hash(code)}')`);await t.identity(firmManager);await t.sql(`select public.accept_firm_code('${hash(code)}','${firmOrg}')`);await t.identity(manager);await t.sql(`select public.request_firm_review('${draft}')`);expect(await statusOf()).toEqual({status:'pending_review',review_by:'firm'});});
 it('cannot be approved by the building while the firm is reviewing it',async()=>{await t.identity(councillor);await expect(t.sql(`select public.transition_artifact('${draft}','approved')`)).rejects.toThrow('firm_review_pending');});
 it('needs a comment to request changes',async()=>{await t.identity(firmManager);await expect(t.sql(`select public.decide_firm_review('${draft}','changes_requested','')`)).rejects.toThrow('comment_required');});
 it('does not let a firm assistant decide',async()=>{await t.identity(firmAssistant);await expect(t.sql(`select public.decide_firm_review('${draft}','approved','')`)).rejects.toThrow('forbidden');});
 it('returns to the author with the firm’s comment',async()=>{await t.identity(firmManager);await t.sql(`select public.decide_firm_review('${draft}','changes_requested','Cite bylaw 4.1 and the date of the complaint.')`);expect((await statusOf()).status).toBe('changes_requested');await t.identity(manager);expect((await t.rows<{body:string}>(`select body from public.document_review_comments where document_id='${draft}'`)).map(r=>r.body)).toContain('Cite bylaw 4.1 and the date of the complaint.');});
 it('lets the author edit and resend, and the firm approve',async()=>{await t.identity(manager);await t.sql(`select public.save_artifact('${draft}','Noise notice','A revised draft citing bylaw 4.1')`);await t.sql(`select public.request_firm_review('${draft}')`);await t.identity(firmManager);await t.sql(`select public.decide_firm_review('${draft}','approved','')`);expect((await statusOf()).status).toBe('approved');});
 it('hides review comments from another building',async()=>{await t.identity(otherManager);expect(await t.rows(`select id from public.document_review_comments where building_id='${building}'`)).toHaveLength(0);});
 it('does not let anyone write a comment row directly',async()=>{await t.identity(manager);await expect(t.sql(`insert into public.document_review_comments(document_id,building_id,author_id,body) values('${draft}','${building}','${manager}','Forged')`)).rejects.toThrow();});
 it('returns an open firm review to draft when the firm is removed',async()=>{await t.identity(manager);const second=(await one<{id:string}>(`insert into public.generated_documents(building_id,created_by,title,kind,body_md) values('${building}','${manager}','Parking notice','s135_notice','Another draft') returning id`)).id;await t.sql(`select public.request_firm_review('${second}')`);await t.sql(`select public.revoke_firm_link('${building}')`);await t.admin();expect(await one(`select status,review_by from public.generated_documents where id='${second}'`)).toEqual({status:'draft',review_by:'building'});});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/firm-links.test.ts -t "firm for review"`
Expected: FAIL — `function public.request_firm_review(unknown) does not exist`.

- [ ] **Step 3: Write the migration**

```sql
-- supabase/migrations/20260927093000_firm_review.sql
-- A building can send a draft to its linked firm. Only the firm's reviewers decide; the building cannot approve
-- around them. Revoking the firm returns open reviews to draft.
-- Rollback: drop the functions created here; drop table public.document_review_comments;
--  update public.generated_documents set status='draft' where status='changes_requested';
--  alter table public.generated_documents drop constraint generated_documents_status_check,
--   add constraint generated_documents_status_check check(status in ('draft','pending_review','approved','sent','void')),
--   drop column review_by; re-apply the previous transition_artifact, save_artifact and revoke_firm_link.
alter table public.generated_documents add column review_by text not null default 'building' check(review_by in ('building','firm'));
alter table public.generated_documents drop constraint generated_documents_status_check;
alter table public.generated_documents add constraint generated_documents_status_check check(status in ('draft','pending_review','changes_requested','approved','sent','void'));

create table public.document_review_comments (
 id uuid primary key default gen_random_uuid(), document_id uuid not null, building_id uuid not null references public.buildings(id),
 author_id uuid not null references auth.users(id), body text not null check(length(body) between 1 and 4000),
 created_at timestamptz not null default now(),
 foreign key(document_id,building_id) references public.generated_documents(id,building_id)
);
create index document_review_comments_scope_idx on public.document_review_comments(building_id,document_id,created_at);
alter table public.document_review_comments enable row level security;
create policy review_comments_read on public.document_review_comments for select to authenticated using(public.authorize('chat.use',building_id));
revoke all on public.document_review_comments from public,anon,authenticated;
grant select on public.document_review_comments to authenticated;

create function private.is_linked_member(p_building uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.building_members m join public.firm_building_links l on l.id=m.via_link_id and l.status='active'
  where m.building_id=p_building and m.user_id=auth.uid() and m.status='active'); $$;

create function public.request_firm_review(p_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare d public.generated_documents;
begin
 select * into d from public.generated_documents where id=p_id and deleted_at is null for update;
 if not found or not public.authorize('document.draft',d.building_id) or private.is_linked_member(d.building_id) then raise exception 'forbidden'; end if;
 if d.status not in ('draft','changes_requested') then raise exception 'invalid_transition'; end if;
 if public.linked_firm_id(d.building_id) is null then raise exception 'no_firm_link'; end if;
 update public.generated_documents set status='pending_review',review_by='firm',updated_at=now() where id=p_id;
end; $$;

create function public.decide_firm_review(p_id uuid,p_decision text,p_comment text) returns void language plpgsql security definer set search_path='' as $$
declare d public.generated_documents; c text:=trim(coalesce(p_comment,''));
begin
 select * into d from public.generated_documents where id=p_id and deleted_at is null for update;
 if not found or not public.authorize('review.act',d.building_id) or not private.is_linked_member(d.building_id) then raise exception 'forbidden'; end if;
 if d.status<>'pending_review' or d.review_by<>'firm' or p_decision not in ('approved','changes_requested') then raise exception 'invalid_transition'; end if;
 if p_decision='changes_requested' and c='' then raise exception 'comment_required'; end if;
 if p_decision='approved' then
  if d.kind in ('s135_notice','decision_letter','fine_notice') and d.created_by=auth.uid() then raise exception 'self_approval_not_permitted'; end if;
  update public.generated_documents set status='approved',approved_by=auth.uid(),approved_at=now(),updated_at=now() where id=p_id;
 else
  update public.generated_documents set status='changes_requested',updated_at=now() where id=p_id;
 end if;
 if c<>'' then insert into public.document_review_comments(document_id,building_id,author_id,body) values(d.id,d.building_id,auth.uid(),left(c,4000)); end if;
end; $$;

create function public.comment_on_review(p_id uuid,p_body text) returns uuid language plpgsql security definer set search_path='' as $$
declare d public.generated_documents; i uuid;
begin
 select * into d from public.generated_documents where id=p_id and deleted_at is null;
 if not found or not public.authorize('chat.use',d.building_id) then raise exception 'forbidden'; end if;
 if length(trim(coalesce(p_body,''))) not between 1 and 4000 then raise exception 'invalid_input'; end if;
 insert into public.document_review_comments(document_id,building_id,author_id,body) values(d.id,d.building_id,auth.uid(),trim(p_body)) returning id into i;
 return i;
end; $$;

-- Editing a draft sent back by the firm reopens it for the author.
create or replace function public.save_artifact(p_id uuid,p_title text,p_body text) returns void language plpgsql security definer set search_path='' as $$
declare d public.generated_documents;
begin
 select * into d from public.generated_documents where id=p_id and deleted_at is null for update;
 if not found or not public.authorize('document.draft',d.building_id) then raise exception 'forbidden'; end if;
 if d.status not in ('draft','pending_review','changes_requested') then raise exception 'immutable_approved_document'; end if;
 insert into public.artifact_versions(building_id,artifact_id,body_md,edited_by) values(d.building_id,d.id,d.body_md,auth.uid());
 update public.generated_documents set title=p_title,body_md=p_body,status='draft',review_by='building',updated_at=now() where id=p_id;
end; $$;

create or replace function public.transition_artifact(p_id uuid,p_status text,p_occurred_at timestamptz default null) returns void language plpgsql security definer set search_path='' as $$
declare d public.generated_documents; sep boolean;
begin
 select * into d from public.generated_documents where id=p_id and deleted_at is null for update;
 if not found or not public.authorize('chat.use',d.building_id) then raise exception 'forbidden'; end if;
 if d.status=p_status then return; end if;
 -- New: while the firm is reviewing, only decide_firm_review may move the document forward.
 if d.status='pending_review' and d.review_by='firm' and p_status<>'void' then raise exception 'firm_review_pending'; end if;
 if p_status='pending_review' and d.status in ('draft','changes_requested') and public.authorize('document.draft',d.building_id) then
  update public.generated_documents set status=p_status,review_by='building' where id=p_id;
 elsif p_status='approved' and d.status='pending_review' and public.authorize('document.approve',d.building_id) then
  select o.separation_of_duties into sep from public.organizations o join public.buildings b on b.org_id=o.id where b.id=d.building_id;
  if sep and d.kind in ('s135_notice','decision_letter','fine_notice') and d.created_by=auth.uid() then raise exception 'self_approval_not_permitted'; end if;
  update public.generated_documents set status='approved',approved_by=auth.uid(),approved_at=now() where id=p_id;
 elsif p_status='sent' and d.status='approved' and public.authorize('document.send',d.building_id) then
  if p_occurred_at is null or p_occurred_at>now() then raise exception 'invalid_occurred_at'; end if;
  update public.generated_documents set status='sent',sent_at=p_occurred_at where id=p_id;
  if d.dispute_id is not null then
   insert into public.dispute_events(building_id,dispute_id,stage,occurred_at,summary,actor_id,idempotency_key) values(d.building_id,d.dispute_id,'notice_sent',p_occurred_at,'Approved correspondence marked as sent',auth.uid(),d.id) on conflict(idempotency_key) do nothing;
  end if;
 elsif p_status='void' and d.status<>'sent' and public.authorize('document.approve',d.building_id) then update public.generated_documents set status='void',deleted_at=now() where id=p_id;
 else raise exception 'invalid_transition'; end if;
end; $$;

create or replace function public.revoke_firm_link(p_building uuid) returns void language plpgsql security definer set search_path='' as $$
declare l uuid;
begin
 if not public.authorize('building.link_firm',p_building) then raise exception 'forbidden'; end if;
 select id into l from public.firm_building_links where building_id=p_building and status='active' for update;
 if not found then raise exception 'no_firm_link'; end if;
 update public.firm_building_links set status='revoked',revoked_by=auth.uid(),revoked_at=now() where id=l;
 update public.building_members set status='suspended' where via_link_id=l;
 update public.link_codes set revoked_at=now() where building_id=p_building and kind='firm' and revoked_at is null and used_at is null;
 -- New: open firm reviews go back to their authors.
 insert into public.document_review_comments(document_id,building_id,author_id,body)
 select id,building_id,auth.uid(),'Strata management access was removed, so this review was returned to draft.' from public.generated_documents
 where building_id=p_building and review_by='firm' and status='pending_review' and deleted_at is null;
 update public.generated_documents set status='draft',review_by='building',updated_at=now() where building_id=p_building and review_by='firm' and status='pending_review' and deleted_at is null;
end; $$;

revoke all on function private.is_linked_member(uuid) from public,anon,authenticated;
revoke all on function public.request_firm_review(uuid),public.decide_firm_review(uuid,text,text),public.comment_on_review(uuid,text) from public,anon;
grant execute on function public.request_firm_review(uuid),public.decide_firm_review(uuid,text,text),public.comment_on_review(uuid,text) to authenticated;
```

Before writing, check the constraint name with `grep -n "status in ('draft'" supabase/migrations/20260914092416_governance.sql`; the inline check on `status` is auto-named `generated_documents_status_check`. If `save_artifact` or `transition_artifact` was redefined in a later migration, copy from the newest definition.

- [ ] **Step 4: Run all database tests**

Run: `pnpm vitest run tests/firm-links.test.ts tests/database.test.ts`
Expected: PASS (existing `requires an independent approver for enforcement notices` still passes).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260927093000_firm_review.sql tests/firm-links.test.ts
git commit -m "Let a building send drafts to its firm for review"
```

---

### Task 6: Server layer — codes, errors, actions and queries

**Files:**
- Create: `lib/link-codes.ts`, `tests/link-codes.test.ts`
- Create: `features/firm-links/schema.ts`, `features/firm-links/actions.ts`, `features/firm-links/queries.ts`
- Modify: `lib/errors.ts` (the `safe` map in `checkDb`)
- Modify: `features/workspace/schema.ts`, `features/workspace/actions.ts`, `features/workspace/queries.ts`

**Interfaces:**
- Produces:
  - `generateCode(): string`, `normalizeCode(input:string): string|null`, `hashCode(code:string): string` from `@/lib/link-codes`
  - `createFirmCodeAction(raw:unknown): Promise<{ok:true;code:string;url:string}|{ok:false;error:string}>`
  - `revokeFirmLinkAction(raw:unknown): Promise<{ok:true}|{ok:false;error:string}>`
  - `acceptFirmCodeAction(raw:unknown): Promise<{ok:true;buildingId:string}|{ok:false;error:string}>`
  - `firmLinkStatus(buildingId:string): Promise<FirmLinkStatus|null>` where `type FirmLinkStatus={status:'none'|'invited'|'active';firmName:string|null;since:string|null;codeExpiresAt:string|null}`
  - `firmOrganizations(): Promise<{id:string;name:string}[]>`
  - `firmReviewInbox(): Promise<{id:string;building_id:string;title:string;kind:string;created_at:string}[]>`
  - `mutateAction` operations `notice.firm_review`, `notice.firm_decision`, `notice.comment`; resource `comments`; `notices` rows include `review_by`; `workspace().organizations` rows include `kind`.

- [ ] **Step 1: Write the failing unit tests**

```ts
// tests/link-codes.test.ts
import {describe,it,expect} from 'vitest';
import {generateCode,normalizeCode,hashCode} from '@/lib/link-codes';
describe('link codes',()=>{
 it('generates codes in the XXXX-XXXX format without ambiguous characters',()=>{for(let i=0;i<200;i++)expect(generateCode()).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{4}$/);});
 it('accepts lowercase, spaces and a missing dash',()=>{expect(normalizeCode(' seas 7qk4 ')).toBe('SEAS-7QK4');expect(normalizeCode('seas7qk4')).toBe('SEAS-7QK4');expect(normalizeCode('SEAS–7QK4')).toBe('SEAS-7QK4');});
 it('rejects input of the wrong length or with ambiguous characters',()=>{expect(normalizeCode('SEAS-7QK')).toBeNull();expect(normalizeCode('SEAS-7QK40')).toBeNull();expect(normalizeCode('SEAS-0QK4')).toBeNull();});
 it('hashes the normalized code so typing style does not matter',()=>{expect(hashCode('SEAS-7QK4')).toMatch(/^[0-9a-f]{64}$/);expect(hashCode(normalizeCode('seas7qk4')!)).toBe(hashCode('SEAS-7QK4'));});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `pnpm vitest run tests/link-codes.test.ts`
Expected: FAIL — cannot resolve `@/lib/link-codes`.

- [ ] **Step 3: Implement `lib/link-codes.ts`**

```ts
import 'server-only';
import {createHash,randomInt} from 'node:crypto';
// No 0/O or 1/I, so codes survive being read aloud or copied from paper.
const ALPHABET='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export function generateCode(){let s='';for(let i=0;i<8;i++)s+=ALPHABET[randomInt(ALPHABET.length)];return s.slice(0,4)+'-'+s.slice(4);}
export function normalizeCode(input:string){const s=input.toUpperCase().replace(/[^A-Z0-9]/g,'');if(s.length!==8||[...s].some(c=>!ALPHABET.includes(c)))return null;return s.slice(0,4)+'-'+s.slice(4);}
export function hashCode(code:string){return createHash('sha256').update(code).digest('hex');}
```

- [ ] **Step 4: Run the unit tests**

Run: `pnpm vitest run tests/link-codes.test.ts`
Expected: PASS.

- [ ] **Step 5: Add safe error messages**

In `lib/errors.ts`, add these entries to the `safe` object in `checkDb` (before the closing `}` of the object literal):

```ts
invalid_code:'That code isn’t valid. Check it and try again.',revoked_code:'That code was replaced or cancelled. Ask the building for a new one.',expired_code:'That code has expired. Ask the building for a new one.',wrong_code_kind:'That’s a resident code. Ask the building for a strata management code.',firm_already_linked:'This building already has a strata management firm. The building must remove that firm first.',no_firm_link:'This building has no strata management firm linked.',linked_member:'Strata management access is managed as a whole. Remove the firm from Settings instead.',comment_required:'Add a comment explaining the changes you need.',firm_review_pending:'This draft is waiting for your strata management firm to review it.'
```

- [ ] **Step 6: Create the firm-link feature**

```ts
// features/firm-links/schema.ts
import {z} from 'zod';
import {id} from '@/lib/schema';
export const buildingInput=z.object({buildingId:id});
export const acceptInput=z.object({code:z.string().trim().min(8).max(20),firmOrgId:id});
export const firmLinkStatusSchema=z.object({status:z.enum(['none','invited','active']),firm_name:z.string().nullable(),since:z.string().nullable(),code_expires_at:z.string().nullable()}).transform(r=>({status:r.status,firmName:r.firm_name,since:r.since,codeExpiresAt:r.code_expires_at}));
export type FirmLinkStatus=z.output<typeof firmLinkStatusSchema>;
```

```ts
// features/firm-links/actions.ts
'use server';
import {revalidatePath} from 'next/cache';
import {requireUser,requirePermission} from '@/lib/auth/guards';
import {checkDb,errorMessage,AppError} from '@/lib/errors';
import {rateLimit} from '@/lib/security/rate-limit';
import {generateCode,normalizeCode,hashCode} from '@/lib/link-codes';
import {buildingInput,acceptInput} from './schema';
import {z} from 'zod';
export async function createFirmCodeAction(raw:unknown):Promise<{ok:true;code:string;url:string}|{ok:false;error:string}>{try{const user=await requireUser();const input=buildingInput.parse(raw);await requirePermission(user,'building.link_firm',input.buildingId);const code=generateCode();checkDb((await user.client.rpc('create_firm_code',{p_building:input.buildingId,p_hash:hashCode(code)})).error);revalidatePath('/b/'+input.buildingId+'/settings');return {ok:true,code,url:(process.env.NEXT_PUBLIC_APP_URL||'http://localhost:3000')+'/workspace?code='+code};}catch(e){return {ok:false,error:errorMessage(e)};}}
export async function revokeFirmLinkAction(raw:unknown):Promise<{ok:true}|{ok:false;error:string}>{try{const user=await requireUser();const input=buildingInput.parse(raw);await requirePermission(user,'building.link_firm',input.buildingId);checkDb((await user.client.rpc('revoke_firm_link',{p_building:input.buildingId})).error);revalidatePath('/b','layout');return {ok:true};}catch(e){return {ok:false,error:errorMessage(e)};}}
// No building is known until the code is redeemed; accept_firm_code checks the caller's firm role itself.
export async function acceptFirmCodeAction(raw:unknown):Promise<{ok:true;buildingId:string}|{ok:false;error:string}>{try{const user=await requireUser();const input=acceptInput.parse(raw);await rateLimit(user.id,'auth');const code=normalizeCode(input.code);if(!code)throw new AppError('invalid_code','That code isn’t valid. Check it and try again.');const {data,error}=await user.client.rpc('accept_firm_code',{p_hash:hashCode(code),p_firm_org:input.firmOrgId});checkDb(error);revalidatePath('/workspace','layout');return {ok:true,buildingId:z.uuid().parse(data)};}catch(e){return {ok:false,error:errorMessage(e)};}}
```

```ts
// features/firm-links/queries.ts
import 'server-only';
import {z} from 'zod';
import {requireUser} from '@/lib/auth/guards';
import {checkDb} from '@/lib/errors';
import {firmLinkStatusSchema} from './schema';
export async function firmLinkStatus(buildingId:string){const user=await requireUser();const {data,error}=await user.client.rpc('building_firm_status',{p_building:buildingId}).maybeSingle();checkDb(error);return data?firmLinkStatusSchema.parse(data):null;}
export async function firmOrganizations(){const user=await requireUser();const {data,error}=await user.client.from('organizations').select('id,name').eq('kind','firm').order('name');checkDb(error);return z.array(z.object({id:z.uuid(),name:z.string()})).parse(data);}
export async function firmReviewInbox(){const user=await requireUser();const {data,error}=await user.client.from('generated_documents').select('id,building_id,title,kind,created_at').eq('review_by','firm').eq('status','pending_review').is('deleted_at',null).order('created_at').limit(50);checkDb(error);return z.array(z.object({id:z.uuid(),building_id:z.uuid(),title:z.string(),kind:z.string(),created_at:z.string()})).parse(data);}
```

- [ ] **Step 7: Add review operations to the workspace feature**

In `features/workspace/schema.ts`, add `'notice.firm_review','notice.firm_decision','notice.comment'` to the `operation` enum after `'notice.transition'`.

In `features/workspace/actions.ts`:
- In the `permissions` record, after `'notice.transition':'chat.use',` add `'notice.firm_review':'document.draft','notice.firm_decision':'review.act','notice.comment':'chat.use',`.
- After the `case 'notice.transition':…break;}` line add:

```ts
   case 'notice.firm_review':{z.object({confirmed:z.literal(true)}).parse(input.values);result=await db.rpc('request_firm_review',{p_id:requiredId()});break;}
   case 'notice.firm_decision':{const v=z.object({decision:z.enum(['approved','changes_requested']),comment:z.string().trim().max(4000).default(''),confirmed:z.literal(true)}).parse(input.values);result=await db.rpc('decide_firm_review',{p_id:requiredId(),p_decision:v.decision,p_comment:v.comment});break;}
   case 'notice.comment':{const v=z.object({body:z.string().trim().min(1).max(4000)}).parse(input.values);result=await db.rpc('comment_on_review',{p_id:requiredId(),p_body:v.body});break;}
```

In `features/workspace/queries.ts`:
- In `workspace()`, change the organizations select to `'id,name,kind,plan,letterhead,signature_block'`.
- In `resources`, change the `notices` column list to add `review_by` after `status`, and add a new entry after `notices`:

```ts
 comments:['document_review_comments','id,building_id,document_id,author_id,body,created_at'],
```

- [ ] **Step 8: Typecheck, lint, test**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: all pass.

- [ ] **Step 9: Commit**

```bash
git add lib/link-codes.ts tests/link-codes.test.ts lib/errors.ts features/firm-links features/workspace/schema.ts features/workspace/actions.ts features/workspace/queries.ts
git commit -m "Add server actions for firm codes and review hand-off"
```

---

### Task 7: Building side — strata management card and lost-access redirect

**Files:**
- Create: `features/firm-links/components/strata-management-card.tsx`
- Modify: `app/(app)/b/[buildingId]/[section]/page.tsx`

**Interfaces:**
- Consumes: `createFirmCodeAction`, `revokeFirmLinkAction`, `firmLinkStatus`, `FirmLinkStatus` (Task 6); `Button`, `Badge`, `Modal` from `@/components/ui`.
- Produces: `<StrataManagementCard buildingId canManage status/>`.

- [ ] **Step 1: Create the card**

```tsx
// features/firm-links/components/strata-management-card.tsx
'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Briefcase,Copy,RefreshCw} from 'lucide-react';
import {Button,Badge,Modal} from '@/components/ui';
import {createFirmCodeAction,revokeFirmLinkAction} from '../actions';
import type {FirmLinkStatus} from '../schema';
export function StrataManagementCard({buildingId,canManage,status}:{buildingId:string;canManage:boolean;status:FirmLinkStatus|null}){
 const router=useRouter();const[code,setCode]=useState<{code:string;url:string}|null>(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[confirm,setConfirm]=useState(false),[copied,setCopied]=useState(false);
 if(!status)return <section className="card"><h2>Strata management</h2><p role="alert" className="form-error">Strata management details couldn’t be loaded. Refresh the page to try again.</p></section>;
 async function invite(){setBusy(true);setError('');const r=await createFirmCodeAction({buildingId});setBusy(false);if(r.ok){setCode({code:r.code,url:r.url});router.refresh();}else setError(r.error);}
 async function revoke(){setBusy(true);setError('');const r=await revokeFirmLinkAction({buildingId});setBusy(false);setConfirm(false);if(r.ok){setCode(null);router.refresh();}else setError(r.error);}
 async function copy(text:string){try{await navigator.clipboard.writeText(text);setCopied(true);setTimeout(()=>setCopied(false),2000);}catch{setError('Copy failed. Select the code and copy it manually.');}}
 return <section className="card" aria-labelledby="strata-management-heading"><h2 id="strata-management-heading"><Briefcase size={18}/> Strata management</h2>
  {status.status==='active'?<><dl><dt>Firm</dt><dd>{status.firmName}</dd><dt>Connected since</dt><dd>{status.since?.slice(0,10)}</dd></dl><p className="form-note">Everyone at this firm can work on this building. Removing access takes effect immediately and returns drafts they’re reviewing to you.</p>{canManage&&<Button variant="secondary" style={{marginTop:20}} disabled={busy} onClick={()=>setConfirm(true)}>Remove access</Button>}</>
  :<><p className="form-note">{status.status==='invited'?'An invitation code is waiting to be used.':'No strata management firm is connected. Invite your firm so they can work on this building and review your drafts.'}</p>{status.status==='invited'&&<Badge tone="warning">Invitation expires {status.codeExpiresAt?.slice(0,10)}</Badge>}
   {code&&<div className="card" style={{marginTop:16}}><p className="form-note">Share this code with your strata manager. It works once and expires in 7 days.</p><p style={{fontSize:28,fontFamily:'var(--font-mono, monospace)',letterSpacing:2}} aria-label={'Invitation code '+code.code.split('').join(' ')}>{code.code}</p><div className="action-line"><Button variant="secondary" size="small" onClick={()=>copy(code.code)}><Copy size={14}/>{copied?'Copied':'Copy code'}</Button><Button variant="secondary" size="small" onClick={()=>copy(code.url)}><Copy size={14}/>Copy link</Button></div></div>}
   {canManage&&<Button variant="secondary" style={{marginTop:20}} disabled={busy} onClick={invite}>{status.status==='invited'||code?<><RefreshCw size={14}/>Create a new code</>:'Invite your strata management firm'}</Button>}</>}
  {error&&<p role="alert" className="form-error" style={{marginTop:12}}>{error}</p>}
  {confirm&&<Modal open={confirm} onOpenChange={setConfirm} title="Remove strata management access?"><p>{status.firmName} will lose access to this building straight away. Drafts they’re reviewing go back to their authors.</p><div className="action-line" style={{marginTop:20}}><Button variant="secondary" onClick={()=>setConfirm(false)}>Cancel</Button><Button disabled={busy} onClick={revoke}>Remove access</Button></div></Modal>}
 </section>;}
```

`Modal` takes `open`, `onOpenChange`, `title`, optional `description`, and children; `Badge` takes `tone` (`'warning'` is already used in `resources.tsx`). Do not add new variants.

- [ ] **Step 2: Render it on Settings and redirect on lost access**

In `app/(app)/b/[buildingId]/[section]/page.tsx`:
- Add imports:

```ts
import {firmLinkStatus} from '@/features/firm-links/queries';
import {StrataManagementCard} from '@/features/firm-links/components/strata-management-card';
```

- In the `buildingWorkspace(buildingId).catch(...)` handler, replace `if(e instanceof NotFoundError)notFound();` with `if(e instanceof NotFoundError)redirect('/workspace?notice=access_removed');`.
- Change the `needed` expression so `section==='notices'` loads comments: replace the final `:[section as Resource]` with `:section==='notices'?['notices','comments']:[section as Resource]`.
- Before the `return`, add:

```ts
 const firm=section==='settings'&&state.permissions.includes('member.read')?await firmLinkStatus(buildingId):null;
```

- In the returned JSX, after the `<Resources …/>` branch and still inside `<Shell>`, render:

```tsx
{firm&&<div style={{marginTop:24}}><StrataManagementCard buildingId={buildingId} canManage={state.permissions.includes('building.link_firm')} status={firm}/></div>}
```

- [ ] **Step 3: Verify in the browser**

Run `pnpm dev`. Sign in as a single-building manager, open Settings: the card shows "No strata management firm is connected" and "Invite your strata management firm". Click it: a code appears with Copy code / Copy link. Reload: badge shows the expiry. Tab through the card: every button is reachable with a visible focus ring.

- [ ] **Step 4: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: pass.

- [ ] **Step 5: Commit**

```bash
git add features/firm-links/components/strata-management-card.tsx "app/(app)/b/[buildingId]/[section]/page.tsx"
git commit -m "Show strata management access on building settings"
```

---

### Task 8: Firm side — join a building and review inbox

**Files:**
- Create: `features/firm-links/components/join-building-form.tsx`, `features/firm-links/components/review-inbox.tsx`
- Modify: `app/(app)/workspace/page.tsx`

**Interfaces:**
- Consumes: `acceptFirmCodeAction`, `firmOrganizations`, `firmReviewInbox` (Task 6).
- Produces: `<JoinBuildingForm firms initialCode/>`, `<ReviewInbox items buildings/>`.

- [ ] **Step 1: Create the join form**

```tsx
// features/firm-links/components/join-building-form.tsx
'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {KeyRound} from 'lucide-react';
import {Button} from '@/components/ui';
import {acceptFirmCodeAction} from '../actions';
export function JoinBuildingForm({firms,initialCode=''}:{firms:{id:string;name:string}[];initialCode?:string}){
 const router=useRouter();const[code,setCode]=useState(initialCode),[firm,setFirm]=useState(firms[0]?.id||''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');const r=await acceptFirmCodeAction({code,firmOrgId:firm});setBusy(false);if(r.ok)router.push('/b/'+r.buildingId+'/ask');else setError(r.error);}
 return <section className="card" aria-labelledby="join-building-heading"><h2 id="join-building-heading"><KeyRound size={18}/> Join a building</h2><p className="form-note">Enter the code the building gave you. Everyone at your firm gets access once it’s accepted.</p>
  <form onSubmit={submit} style={{display:'grid',gap:12,marginTop:16}}>
   <label className="field"><span>Building code</span><input value={code} onChange={e=>setCode(e.target.value)} placeholder="ABCD-EFGH" autoComplete="off" autoCapitalize="characters" required maxLength={20} aria-describedby={error?'join-building-error':undefined}/></label>
   {firms.length>1&&<label className="field"><span>Firm</span><select value={firm} onChange={e=>setFirm(e.target.value)}>{firms.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select></label>}
   {error&&<p id="join-building-error" role="alert" className="form-error">{error}</p>}
   <Button type="submit" disabled={busy||!code.trim()}>{busy?'Joining…':'Join building'}</Button>
  </form></section>;}
```

Before writing, check how `features/workspace/components/resource-form.tsx` marks up a labelled input (class names) and use the same classes instead of `field` if they differ.

- [ ] **Step 2: Create the review inbox**

```tsx
// features/firm-links/components/review-inbox.tsx
import Link from 'next/link';
import {ClipboardCheck} from 'lucide-react';
import {Badge,Empty} from '@/components/ui';
import {pretty} from '@/lib/constants';
export function ReviewInbox({items,buildings}:{items:{id:string;building_id:string;title:string;kind:string;created_at:string}[];buildings:{id:string;name:string}[]}){
 const name=(id:string)=>buildings.find(b=>b.id===id)?.name||'Building';
 return <section aria-labelledby="review-inbox-heading" style={{marginTop:32}}><div className="section-title"><h2 id="review-inbox-heading">Waiting for your review</h2><Badge>{items.length}</Badge></div>
  {items.length?<ul className="card" style={{listStyle:'none',padding:0}}>{items.map(i=><li key={i.id} style={{padding:'12px 16px',borderBottom:'1px solid var(--border)'}}><Link href={'/b/'+i.building_id+'/notices'}><strong>{i.title}</strong></Link><div className="form-note">{name(i.building_id)} · {pretty(i.kind)} · sent {i.created_at.slice(0,10)}</div></li>)}</ul>
  :<Empty icon={<ClipboardCheck/>} title="Nothing to review" description="Drafts your buildings send you for review will appear here, oldest first."/>}</section>;}
```

- [ ] **Step 3: Wire up the workspace page**

Replace the body of `app/(app)/workspace/page.tsx` with:

```tsx
import {redirect} from 'next/navigation';
import {workspace} from '@/features/workspace/queries';
import {firmOrganizations,firmReviewInbox} from '@/features/firm-links/queries';
import {configured} from '@/lib/env';
import {Onboarding} from '@/features/auth/components/auth-form';
import {UnauthorizedError} from '@/lib/errors';
import {Shell} from '@/components/shell';
import {Portfolio} from '@/features/workspace/components/portfolio';
import {JoinBuildingForm} from '@/features/firm-links/components/join-building-form';
import {ReviewInbox} from '@/features/firm-links/components/review-inbox';
export const dynamic='force-dynamic';
export default async function WorkspacePage({searchParams}:{searchParams:Promise<{notice?:string;code?:string}>}){if(!configured())redirect('/login');const {notice,code}=await searchParams;const state=await workspace().catch(e=>{if(e instanceof UnauthorizedError)redirect('/login');throw e;});if(!state.profile.account_type)return <Onboarding/>;if(state.profile.account_type==='single_building'&&state.buildings[0]&&notice!=='access_removed')redirect('/b/'+state.buildings[0].id+'/ask');const [firms,inbox]=await Promise.all([firmOrganizations(),firmReviewInbox()]);
 return <Shell profile={state.profile} buildings={state.buildings}>{notice==='access_removed'&&<p role="status" className="card" style={{marginBottom:20}}>You no longer have access to that building, or it doesn’t exist.</p>}<Portfolio {...state}/>{firms.length>0&&<><div style={{marginTop:32}}><JoinBuildingForm firms={firms} initialCode={code||''}/></div><ReviewInbox items={inbox} buildings={state.buildings}/></>}</Shell>;}
```

- [ ] **Step 4: Fix "Add building" to use the firm organization**

In `features/workspace/components/resources.tsx` `SettingsView`, the `building.create` form sends `extra:{orgId:building.org_id}`, which is now the building's own organization. Replace that `extra` with:

```tsx
extra:{orgId:(related.organizations||[]).find(o=>str(o,'kind')==='firm')?.id}
```

and render the "Add building" button only when such a firm organization exists: change `{can('building.create')&&<Button …Add building…` to `{can('building.create')&&(related.organizations||[]).some(o=>str(o,'kind')==='firm')&&<Button …`. Confirm by reading the page that `related.organizations` is populated for the settings section (it comes from `state.organizations` via `buildingWorkspace`); if it is not, pass `organizations={state.organizations}` into `Resources` and use that instead.

- [ ] **Step 5: Verify in the browser**

With a firm account (signed up as "multi-building"), open `/workspace`: the "Join a building" card and "Waiting for your review" (empty state) appear. Enter the code from Task 7 in lowercase without the dash: you land on the building's Ask page and it appears in the portfolio. Enter it again: "That code isn’t valid." A single-building account does not see either card.

- [ ] **Step 6: Typecheck and lint**

Run: `pnpm typecheck && pnpm lint`
Expected: pass.

- [ ] **Step 7: Commit**

```bash
git add features/firm-links/components "app/(app)/workspace/page.tsx" features/workspace/components/resources.tsx
git commit -m "Let a firm join a building by code and see its review inbox"
```

---

### Task 9: Review buttons and comment thread in the notice editor

**Files:**
- Create: `features/workspace/components/review-thread.tsx`
- Modify: `features/workspace/components/resources.tsx` (the `Editor` component, line 51, and its call site in `Resources`)
- Modify: `app/(app)/b/[buildingId]/[section]/page.tsx` (pass `firmLinked`)
- Modify: `lib/constants.ts` only if `pretty('changes_requested')` does not read well (check first)

**Interfaces:**
- Consumes: `mutateAction` operations `notice.firm_review`, `notice.firm_decision`, `notice.comment`; `related.comments`; `firmLinkStatus`.
- Produces: `<ReviewThread buildingId documentId comments canComment preview/>`; `Resources` and `Editor` accept `firmLinked?:boolean` and `comments?:Row[]`.

- [ ] **Step 1: Create the thread**

```tsx
// features/workspace/components/review-thread.tsx
'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import {Button} from '@/components/ui';
import {mutateAction} from '../actions';
import type {Row} from '@/lib/schema';
import {str} from './resource-form';
export function ReviewThread({buildingId,documentId,comments,canComment,preview=false}:{buildingId:string;documentId:string;comments:Row[];canComment:boolean;preview?:boolean}){
 const router=useRouter();const[body,setBody]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const mine=comments.filter(c=>str(c,'document_id')===documentId).sort((a,b)=>str(a,'created_at').localeCompare(str(b,'created_at')));
 async function send(e:React.FormEvent){e.preventDefault();if(preview){setError('This sample is read-only.');return;}setBusy(true);setError('');const r=await mutateAction({buildingId,operation:'notice.comment',id:documentId,values:{body}});setBusy(false);if(r.ok){setBody('');router.refresh();}else setError(r.error);}
 return <section aria-labelledby={'thread-'+documentId} style={{marginTop:24}}><h3 id={'thread-'+documentId}>Review comments</h3>
  {mine.length?<ol style={{listStyle:'none',padding:0,display:'grid',gap:10}}>{mine.map(c=><li key={c.id} className="card"><p style={{whiteSpace:'pre-wrap'}}>{str(c,'body')}</p><span className="form-note">{str(c,'created_at').slice(0,16).replace('T',' ')}</span></li>)}</ol>:<p className="form-note">No comments yet.</p>}
  {canComment&&<form onSubmit={send} style={{display:'grid',gap:8,marginTop:12}}><label className="field"><span>Add a comment</span><textarea value={body} onChange={e=>setBody(e.target.value)} maxLength={4000} rows={3}/></label>{error&&<p role="alert" className="form-error">{error}</p>}<Button type="submit" variant="secondary" disabled={busy||!body.trim()}>{busy?'Posting…':'Post comment'}</Button></form>}
 </section>;}
```

Confirm `str` is exported from `./resource-form` (it is imported that way in `resources.tsx`).

- [ ] **Step 2: Add the review buttons to `Editor`**

In `features/workspace/components/resources.tsx`, in `Editor`:

1. Add `firmLinked=false,comments=[]` to the destructured props and `firmLinked?:boolean;comments?:Row[]` to its type.
2. Stop the building approving a firm review: in the existing condition `{status==='pending_review'&&permissions.includes('document.approve')&&<Button …>Approve document</Button>}` add `&&str(row,'review_by')!=='firm'` after `permissions.includes('document.approve')`.
3. Let an author resubmit after changes: in the existing "Submit for review" condition, replace `status==='draft'` with `['draft','changes_requested'].includes(status)`. (Search for `Submit for review` to find it.)
4. Immediately after the "Submit for review" button expression, insert:

```tsx
{['draft','changes_requested'].includes(status)&&permissions.includes('document.draft')&&firmLinked&&row.id&&<Button variant="secondary" onClick={()=>setTransition({title:'Send to strata management',operation:'notice.firm_review',id:row.id,fields:[{name:'confirmed',label:'Send this draft to your strata management firm to review.',type:'checkbox',required:true}]})}>Send to strata management</Button>}
{status==='pending_review'&&str(row,'review_by')==='firm'&&permissions.includes('review.act')&&<><Button variant="secondary" onClick={()=>setTransition({title:'Approve for the building',operation:'notice.firm_decision',id:row.id,fields:[{name:'comment',label:'Comment (optional)',type:'textarea'},{name:'confirmed',label:'I have checked the facts, sources and procedure.',type:'checkbox',required:true}],extra:{decision:'approved'}})}>Approve</Button><Button variant="secondary" onClick={()=>setTransition({title:'Request changes',operation:'notice.firm_decision',id:row.id,fields:[{name:'comment',label:'What needs to change?',type:'textarea',required:true},{name:'confirmed',label:'Send this back to the author.',type:'checkbox',required:true}],extra:{decision:'changes_requested'}})}>Request changes</Button></>}
{status==='pending_review'&&str(row,'review_by')==='firm'&&!permissions.includes('review.act')&&<Badge tone="warning">With strata management for review</Badge>}
```

Before relying on `extra:{decision:…}`, read how `Editor` submits the `transition` form (search for `transition&&`) and confirm `extra` is merged into `values` the same way `extra:{status:'pending_review'}` is for "Submit for review". If it is not, merge it there.

5. Where `Editor` renders the notice body (inside its returned JSX, after the body editor and the action buttons), add:

```tsx
{section==='notices'&&row.id&&<ReviewThread buildingId={building.id} documentId={row.id} comments={comments} canComment={permissions.includes('chat.use')} preview={preview}/>}
```

and import it at the top: `import {ReviewThread} from './review-thread';`.

6. In `Resources`, add `firmLinked=false` to its destructured props (type `firmLinked?:boolean`) and pass `firmLinked={firmLinked} comments={related.comments||[]}` where `Resources` renders `<Editor …/>` (search for `<Editor`).

7. In the notices list row badge, add `'changes_requested'` to the warning tone list: change `['review','pending_review','adopted'].includes(status)` to `['review','pending_review','changes_requested','adopted'].includes(status)`.

- [ ] **Step 3: Pass `firmLinked` from the page**

In `app/(app)/b/[buildingId]/[section]/page.tsx`, change the `firm` line from Task 7 to load status for notices too:

```ts
 const firm=(section==='settings'||section==='notices')&&state.permissions.includes('member.read')?await firmLinkStatus(buildingId):null;
```

keep the card render guarded by `section==='settings'&&firm`, and pass `firmLinked={firm?.status==='active'}` to `<Resources …/>`.

- [ ] **Step 4: Verify in the browser**

As the building manager with a linked firm: open Notices, open a draft → "Send to strata management" appears; confirm → status shows "Pending review" and the "With strata management for review" badge; "Approve document" is not shown. As the firm manager: `/workspace` inbox lists it; open it → Approve / Request changes. Request changes with a comment → the building sees "Changes requested", the comment in the thread, and "Submit for review" / "Send to strata management" again. Keyboard: all new buttons and the comment form reachable, focus ring visible.

- [ ] **Step 5: Typecheck, lint, tests**

Run: `pnpm typecheck && pnpm lint && pnpm test`
Expected: pass.

- [ ] **Step 6: Commit**

```bash
git add features/workspace/components/review-thread.tsx features/workspace/components/resources.tsx "app/(app)/b/[buildingId]/[section]/page.tsx"
git commit -m "Add strata review buttons and comments to notices"
```

---

### Task 10: End-to-end verification

**Files:** none new.

- [ ] **Step 1: Full checks**

Run: `pnpm typecheck && pnpm lint && pnpm test && pnpm build`
Expected: all pass. Record the test count.

- [ ] **Step 2: Walk the whole loop in the browser**

Against a Supabase project with the four new migrations applied (they are applied by the normal deploy pipeline; locally, apply them to the dev project the same way earlier migrations were applied):
1. Building manager: Settings → Invite → copy code.
2. Firm manager: `/workspace` → Join a building → code → lands in the building.
3. Building manager: Notices → draft → Send to strata management.
4. Firm manager: inbox → open → Request changes (comment) → building edits and resends → firm approves.
5. Building manager: Settings → Remove access → confirm.
6. Firm manager: reload the building URL → redirected to `/workspace` with "You no longer have access to that building, or it doesn’t exist."

- [ ] **Step 3: Confirm nothing is left uncommitted**

Run: `git status --short`
Expected: clean (apart from `next-env.d.ts`, which `next dev` rewrites).
