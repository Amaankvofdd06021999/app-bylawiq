# BylawIQ — Roles, firm links, residents and billing (design)

**Date:** 2026-09-27
**Status:** Draft for review
**Replaces:** `2026-09-27-roles-billing-prototype-design.md` (written for the Vite prototype; its product decisions carry over, its technical design does not)
**Governing docs:** AGENTS.md §0, docs 02, 03, 04, 11

## 1. Goal

Bring the app in line with the commercial model on the marketing site: three connected customer groups, each with its own shell and plan.

| Group | Who | Plans |
|---|---|---|
| **Building management** (main customer) | Council members and on-site building managers | **Building**: $99/mo incl. 3 seats, +$40/seat/mo · **Building Pro**: contact us |
| **Strata management** | Strata management firms working across buildings | **Strata Manager**: $199/mo, launch price $99.50/mo · **Enterprise**: contact us |
| **Residents and owners** | Owners/residents linked to one building | **Free**: 2 AI questions · **Credits**: $20 for 100 credits |

A building owns its record, **invites** its strata firm by code, and can **revoke** that access at any time. Building management can **send drafts to the firm for review**. Residents join with a **resident join code**.

Success: each flow (invite → accept → review → approve → revoke; resident join → ask → paywall → buy credits → draft) works end to end against real Supabase, with every access decision enforced in Postgres.

### Non-goals

- Real payments. Checkout is mocked (§7); Stripe gets its own spec.
- Enterprise and Building Pro sales flows beyond a "contact us" form.
- Changing the retrieval or generation pipeline beyond the resident branch in §6.

## 2. Current state

- Next.js 16 App Router, Supabase Postgres with RLS, server actions using `requireUser` / `requirePermission` (`lib/auth/guards.ts`).
- `public.app_role`: `platform_admin, org_owner, org_admin, portfolio_manager, portfolio_assistant, building_manager, council_president, council_member, external_counsel, owner_resident`.
- `profiles.account_type`: `admin | multi_building | single_building`. `bootstrap_workspace` creates an organization and a first building for every signup.
- Every building belongs to exactly one organization (`buildings.org_id`). For a strata firm, that organization is the firm.
- `authorize(permission, building_id)` joins `building_members` × `role_permissions`; all building-scoped RLS goes through it.
- Email invitations (`invitations`, `create_invitation`, `accept_invitation`) grant a role on one building.
- `generated_documents` has `draft → pending_review → approved → sent | void` via `transition_artifact`, with `organizations.separation_of_duties`.
- `owner_resident` has only `building.read` and `vault.read`; `docs_read` already restricts residents to `owner_visible` documents. Residents cannot chat.
- `organizations.plan` exists (default `'pilot'`); `billing.manage` is granted to `org_owner` only. No billing tables.

## 3. Roles

No new `app_role` values. The marketing groups map onto existing roles:

| Group | Roles |
|---|---|
| Building management | `building_manager`, `council_president`, `council_member` (members of a building organization) |
| Strata management | `org_owner`, `org_admin`, `portfolio_manager`, `portfolio_assistant` (members of a firm organization) |
| Resident | `owner_resident` |
| BylawIQ staff | `platform_admin` |

New permissions added to `role_permissions`:

| Permission | Granted to |
|---|---|
| `building.link_firm` | `building_manager`, `council_president` |
| `bulletin.post` | `building_manager`, `council_president`, `portfolio_manager`, `portfolio_assistant`, `org_owner`, `org_admin` |
| `review.act` | `org_owner`, `org_admin`, `portfolio_manager` |
| `chat.resident` | `owner_resident` |
| `billing.manage` | add `building_manager`, `council_president` (on building organizations) |

## 4. Phase 1 — Tenancy split, firm links, review hand-off

### 4.1 Organization kinds

- `organizations.kind text not null default 'building' check (kind in ('building','firm'))`.
- `bootstrap_workspace`: `multi_building` and `admin` signups create `kind='firm'`; `single_building` creates `kind='building'`.
- `create_building` from a firm organization creates a **new building organization** for the building, then an active firm link (§4.2) back to the creating firm. The firm keeps working exactly as today; the building can later be claimed by its own management.
- **Data migration:** every existing building whose organization is `kind='firm'` gets its own building organization; `buildings.org_id` moves to it, and an active `firm_building_links` row is created to the old organization. Existing `building_members` rows for firm staff get `via_link_id` set. **Rollback:** a down migration restores `org_id` from the link row and deletes the generated organizations and links (documented in the migration header).

### 4.2 Tables

```sql
create table public.firm_building_links (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id),
  firm_org_id uuid not null references public.organizations(id),
  status text not null check (status in ('pending','active','revoked')),
  invited_by uuid references auth.users(id), accepted_by uuid references auth.users(id), revoked_by uuid references auth.users(id),
  created_at timestamptz not null default now(), accepted_at timestamptz, revoked_at timestamptz
);
create unique index firm_links_live_idx on public.firm_building_links(building_id) where status in ('pending','active');
create index firm_links_firm_idx on public.firm_building_links(firm_org_id, status);

create table public.link_codes (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id),
  kind text not null check (kind in ('firm','resident')),
  code_hash text not null unique,
  created_by uuid not null references auth.users(id),
  expires_at timestamptz not null, revoked_at timestamptz, created_at timestamptz not null default now()
);
create index link_codes_building_idx on public.link_codes(building_id, kind);

alter table public.building_members add column via_link_id uuid references public.firm_building_links(id);
create index building_members_link_idx on public.building_members(via_link_id) where via_link_id is not null;
```

RLS:
- `firm_building_links` select: `authorize('member.read', building_id) or is_org_member(firm_org_id)`. No direct insert/update; functions only.
- `link_codes` select: `authorize('member.invite', building_id)`. Plaintext codes are never stored or returned after creation.

### 4.3 Functions (all `security definer`, `set search_path=''`)

| Function | Rule |
|---|---|
| `create_firm_code(p_building) returns text` | Requires `building.link_firm`. Fails `firm_already_linked` if a live link exists. Revokes older unused firm codes, creates a code (format `XXXX-XXXX`, 32-char alphabet without 0/O/1/I), stores `sha256`, 7-day expiry. Returns plaintext once. |
| `accept_firm_code(p_code, p_firm_org) returns uuid` | Caller must be `org_owner`/`org_admin`/`portfolio_manager` of `p_firm_org` (`kind='firm'`). Code must be unexpired, unrevoked, `kind='firm'`. Creates/activates the link, then inserts `building_members` for every active firm member with their firm role and `via_link_id`. Rate limited (`private.rate_limits`, 10/hour/user). |
| `revoke_firm_link(p_building)` | Requires `building.link_firm`. In one transaction: link → `revoked`, members with that `via_link_id` → `suspended`, firm codes revoked, open firm reviews returned to `draft` (§4.4). |
| Trigger on `org_members` | When a member joins or leaves a firm, add or suspend their linked `building_members` rows for every active link. |

Errors raised: `invalid_code`, `expired_code`, `wrong_code_kind`, `firm_already_linked`, `forbidden`. The server action maps each to a specific user-facing message; none echo building names.

The access token hook already reads only active memberships, so revoked firm staff lose the building on their next token refresh, and every RLS check fails immediately because `authorize()` reads `building_members` live. The building layout re-checks access on each request and redirects to `/workspace` with a toast.

### 4.4 Review hand-off to the firm

- `generated_documents.review_by text not null default 'building' check (review_by in ('building','firm'))`.
- New status `changes_requested` (draft author may edit and resubmit).
- `transition_artifact` changes:
  - `draft → pending_review` with `review_by='firm'` requires an active firm link for the building.
  - `pending_review → approved | changes_requested` when `review_by='firm'` requires `review.act` via a membership with `via_link_id` set. Separation of duties still applies.
  - `changes_requested` requires a comment.
- `document_review_comments (id, document_id, building_id, author_id, body, created_at)`, composite FK to `generated_documents(id, building_id)`. Read: `authorize('chat.use', building_id)`. Insert: same, with `author_id = auth.uid()`. Index on `(building_id, document_id)`.
- On revoke, open `review_by='firm'` documents return to `draft` and get a system comment. The UI shows them read-only with a banner.

## 5. Phase 2 — Resident join and bulletin

- `building_members.unit text check (length(unit) <= 20)`.
- `create_resident_code(p_building) returns text`: requires `member.invite`, `kind='resident'`, 90-day expiry, regenerating revokes the previous code.
- `join_as_resident(p_code, p_unit) returns uuid`: authenticated caller; code must be `kind='resident'`; inserts `building_members(role='owner_resident', unit)`; sets `profiles.account_type='single_building'` if null. The existing `enforce_single_building` trigger rejects a second building (`single_building_bound`). Rate limited as above. Creates the resident wallet (§6.2).
- `bulletin_posts (id, building_id, author_id, title ≤ 120, body ≤ 5000, pinned, created_at, updated_at, deleted_at)`. Read: `authorize('building.read', building_id)`. Insert/update: `authorize('bulletin.post', building_id)`. Index on `(building_id, pinned, created_at desc)`.

## 6. Phase 4 — Resident AI and credits

> **Legal gate.** Resident drafting of notices to council and email replies conflicts with doc 11 ("do not draft adversarial material against the strata whose data is loaded", "no advice to residents against a strata whose data we hold"). This phase ships behind `resident_ai_enabled` (off in production) and requires an amendment to doc 11 and counsel sign-off before the flag is turned on. Code carries `// TODO(legal):` at each resident-drafting entry point.

### 6.1 Retrieval scope for residents

- Residents get `chat.resident`, **not** `chat.use` (which also unlocks `generated_documents`, `bylaw_comments`, agents).
- `chunks_read` gains a resident branch: `authorize('chat.resident', building_id) and exists (document with status='ready' and owner_visible and (type <> 'bylaws' or structure_confirmed))`. Without this, a resident question could retrieve correspondence naming other residents.
- `chats` policies accept `chat.resident` for `scope='building'` only. No portfolio or general scope.
- Chat route and `createChatAction` accept `chat.resident` where they currently require `chat.use`, only when the user's role is `owner_resident`.
- Prompt: a resident mode in `features/chat/prompts.ts` — cited answers only, non-dismissible disclaimer, "no grounding found" when retrieval is empty, no analysis of other residents.

### 6.2 Wallet and ledger

```sql
create table public.resident_wallets (
  user_id uuid not null references auth.users(id), building_id uuid not null references public.buildings(id),
  credits integer not null default 0 check (credits >= 0),
  free_questions_used integer not null default 0 check (free_questions_used between 0 and 2),
  primary key (user_id, building_id)
);
create table public.credit_ledger (
  id bigint generated always as identity primary key,
  user_id uuid not null, building_id uuid not null,
  delta integer not null, reason text not null check (reason in ('purchase','question','draft_notice','email_reply','refund','free_question')),
  chat_run_id uuid, created_at timestamptz not null default now(),
  foreign key (user_id, building_id) references public.resident_wallets(user_id, building_id)
);
create index credit_ledger_wallet_idx on public.credit_ledger(user_id, building_id, created_at desc);
```

- RLS: select where `user_id = auth.uid()`. No direct writes; no `grant insert/update`.
- `spend_credit(p_building, p_action, p_run) returns text` — `'free' | 'credits' | 'paywall'`. Questions use a free question first; `draft_notice` (5) and `email_reply` (3) always cost credits; `question` costs 1. Row-locked, writes one ledger row.
- `refund_credit(p_run)` — reverses the ledger row for a run that failed before producing output; idempotent.
- The chat route calls `spend_credit` before starting generation; `'paywall'` returns a typed `PaywallError` (402) and the UI opens the paywall dialog.

### 6.3 Resident drafts

- Stored in `generated_documents` with `kind in ('resident_notice','resident_email_reply')` and a new column `authored_by_resident boolean not null default false`. `transition_artifact` refuses any status change on resident-authored rows, so they stay `draft`.
- Read policy: residents see only their own resident-authored drafts; building staff do not see them until the resident chooses to send (out of scope — the resident copies or downloads the text).
- They never enter the building approval queue.

## 7. Phase 3 — Plans, seats, mock billing

### 7.1 Tables

```sql
create table public.billing_accounts (
  org_id uuid primary key references public.organizations(id),
  plan text not null check (plan in ('pilot','building','building_pro','strata_manager','enterprise')),
  seats integer not null default 3 check (seats >= 3),
  launch_discount boolean not null default false,
  status text not null default 'active' check (status in ('active','past_due','cancelled')),
  updated_at timestamptz not null default now()
);
create table public.plan_prices (plan text primary key, base_cents integer, included_seats integer, seat_cents integer, contact_only boolean not null);
```

- `plan_prices` seed: `building` 9900 / 3 / 4000; `strata_manager` 19900 / – / –; `building_pro`, `enterprise` contact only. Launch price = `base_cents * 0.5` when `launch_discount`.
- `lib/pricing.ts` mirrors these for display and has a test that asserts equality with the seed.
- `billing_accounts` read: organization members with `billing.manage` (via a new `has_org_permission(org, perm)` helper that checks building-organization members through their building role). Existing organizations get a row: `building` for building orgs, `strata_manager` with `launch_discount=true` for firms, current `pilot` rows kept as `pilot`.

### 7.2 Seats

- A seat is an active `building_members` row in a building organization's building whose role is a building-management role and whose `via_link_id` is null. Residents and linked firm staff do not use seats.
- `create_invitation` and `accept_invitation` raise `seat_limit` when the building is at its seat count. `pilot` has no limit.
- Reducing seats below the current count raises `seats_below_members`.

### 7.3 Plan gating

- `entitled(p_feature, p_building) returns boolean`, alongside `authorize()`:
  - `violation_letter`: building org on `building_pro`, or caller holds a linked-firm membership.
- The violation-letter insert on `generated_documents` requires `entitled('violation_letter', building_id)`.

### 7.4 Mock checkout

- `mock_checkout(p_kind text, p_quantity integer)`, `security definer`:
  - Refuses with `billing_disabled` unless `private.runtime_secrets` has `billing_mode = 'mock'`. Production is seeded `disabled`, so enabling fake purchases in production requires a deliberate database change.
  - `credit_pack`: caller must be a resident; adds 100 credits and a `purchase` ledger row.
  - `seats`: caller needs `billing.manage`; sets `seats`.
  - `plan`: only between self-serve plans; Pro and Enterprise raise `contact_sales`.
- Every payment screen is labelled **Demo — no real charge**.

## 8. Capability helper and UI

### 8.1 `lib/access.ts`

A pure, client-safe helper: `can(state, capability)` and `lockReason(state, capability) → 'plan' | 'credits' | 'role' | null`, built from the `permissions`, `entitlements`, `wallet` and `firmLink` already returned by `buildingWorkspace()` (extended to include them). It only decides what to show. Every action still calls `requirePermission` and the database still enforces.

### 8.2 Screens

| Where | What |
|---|---|
| `/workspace` (firm users) | Linked buildings; **Join a building** code entry; review inbox across linked buildings (oldest first); pending-link banner. |
| `b/[id]/settings` (building management) | **Strata management** card: linked firm and status, create/copy/regenerate code, **Remove access** with confirmation. |
| `b/[id]/reviews` | Building: sent items with status and thread. Firm: approve / request changes (comment required) / comment. |
| `b/[id]/residents` | Resident list with unit, resident join code, remove resident. |
| `b/[id]/bulletin` | Posts, pinned first; create and pin for `bulletin.post`. |
| `b/[id]/laws` | Browse CRT decisions and legislation from `legal_sources`; "Ask about this". |
| `b/[id]/updates` | Existing section; each legal change shows affected bylaws. |
| `b/[id]/billing` | Building: plan, seat stepper (min 3, not below members) with live monthly total, "Upgrade to Building Pro" contact form. Resident: balance, free questions left, buy credits, ledger. |
| `/billing` | Firm: plan card with ~~$199~~ **$99.50/mo** and launch-pricing badge; Enterprise contact form. |
| `/join/[code]` | Requires login. Resident code → unit field → join. Firm code → pick firm organization → accept. |
| Resident shell | Home, Bulletin, Documents, Ask, Credits. No building switcher. Credit cost on every AI action button. |

Add the new sections to the `valid` list in `app/(app)/b/[buildingId]/[section]/page.tsx`. Every async surface has loading, empty and error states; all strings are sentence case (doc 06 §7).

## 9. Phase 5 — Laws and law impact

- `laws` section reads `legal_sources` (already shared-readable).
- `updates` gains a per-change list of affected bylaws, computed from `notifications.target_id` and the building's bylaw nodes. No new tables.

## 10. Phases and order

| Phase | Contents | Depends on |
|---|---|---|
| 1 | Organization kinds, data migration, firm links and codes, review hand-off | — |
| 2 | Resident join codes, units, bulletin | 1 (`link_codes`) |
| 3 | Billing accounts, seats, plan gating, mock checkout | 1 |
| 4 | Resident AI, wallets, credits, resident drafts (behind the flag) | 2, 3; legal sign-off before launch |
| 5 | Laws browse, law-impact view | — |

Each phase is a separate implementation plan and ships on its own.

## 11. Errors and edge cases

- Codes: unknown, expired, revoked, wrong kind, building already linked to a firm, caller not an admin of a firm — each a specific message.
- Revoking while firm staff are viewing the building → redirect with toast; open reviews return to draft.
- A firm member leaving the firm loses all linked buildings through the `org_members` trigger.
- A resident already bound to another building → `single_building_bound` message.
- Seat limit on invite or accept; seat reduction below member count.
- Spend with 0 credits → paywall; drafting never uses free questions; failed generation refunds.
- `mock_checkout` in production → `billing_disabled`.
- Errors never include building names, emails or SQL (AGENTS §3).

## 12. Testing

pgTAP (mandatory for every new table and changed policy):
- User in building A cannot read building B's `firm_building_links`, `link_codes`, `bulletin_posts`, `document_review_comments`, `resident_wallets`, `credit_ledger`.
- After `revoke_firm_link`, firm staff fail `authorize()` for that building.
- A firm member removed from the firm loses linked building access.
- A resident cannot read chunks from a document that is not `owner_visible`.
- A resident cannot read `generated_documents` except their own resident drafts.
- A resident cannot read another resident's wallet or ledger.
- `mock_checkout` refuses when `billing_mode` is not `mock`.
- Seat limit blocks the fourth building-management invitation on a 3-seat plan.
- The data migration keeps every existing firm user's building access.

Vitest: `lib/pricing.ts` (including equality with `plan_prices` seed), `lib/access.ts` matrix, code formatting and hashing, error mapping in actions.

Playwright: invite → accept → send for review → request changes → approve → revoke; resident join → ask (free) → paywall → mock purchase → draft notice (flag on in test env).

## 13. Open questions

- `// TODO(legal):` Resident drafting against the strata (§6). Needs a doc 11 amendment and counsel sign-off.
- `// TODO(legal):` Whether a revoked firm keeps read access to documents it approved during the link (current design: no access).
- Stripe integration, taxes (GST/PST) and invoicing: separate spec.
