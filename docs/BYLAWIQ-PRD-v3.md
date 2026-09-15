# BylawIQ — Product Requirements Document

**Version:** 3.0
**Date:** 27 July 2026
**Author:** Amaan Shahana
**Status:** Engineering ready
**Supersedes:** PRD v2.1 (AI Query Engine & User Actions), Data Source PRD

> This version replaces the persona model in v2.1. Account type is now explicit and set at signup, not inferred from building count. See §3.

---

# 1. Vision

**BylawIQ is the single place a strata bylaw lives its whole life** — drafted, reviewed by a lawyer, adopted, filed, questioned, enforced, and amended when the law changes underneath it.

Every other tool in this market treats bylaws as PDFs sitting in a folder. They are not documents; they are living legal instruments that go stale silently. A building's noise bylaw was valid in 2019 and unenforceable in 2026 because the city changed its noise bylaw and the province changed the Act, and nobody told the strata manager. BylawIQ is the system that tells them.

**One sentence:** Ask BylawIQ anything about your building's bylaws, draft and amend them with legal guardrails, and get told when they need to change.

## 1.1 What changed in this version

| Area | v2.1 | v3.0 |
|---|---|---|
| Personas | Council president vs manager, inferred from building count | Three explicit account types, chosen at signup (§3) |
| Single-building access | One account, many buildings | **One account = one building.** Separate logins per building (§3.3) |
| Bylaw handling | Read-only vault | Full lifecycle: create, edit, version, adopt, file (§6) |
| Legal review | Disclaimer only | Mandatory review prompt after every edit, with lawyer matching (§7) |
| Knowledge base | Provincial only | Layered: federal → provincial → regional → **municipal**, resolved from the building's address (§5) |
| Notifications | Digest feed | Targeted "this bylaw needs updating and here is why" (§8) |
| Models | Claude only | Two-tier: Groq for fast/high-volume, Claude for legal reasoning (§9) |
| Navigation | Five colour-coded modes | Six sections, one prominent **Ask BylawIQ** (§4) |

---

# 2. Problem

A BC strata corporation's bylaws are governed by four layers of law simultaneously:

1. **Federal** — Charter, PIPEDA in limited circumstances
2. **Provincial** — *Strata Property Act*, Strata Property Regulation, *Human Rights Code*, *Short-Term Rental Accommodations Act*
3. **Regional** — regional district bylaws (waste, air quality, water restrictions)
4. **Municipal** — the city's own bylaws: noise, parking, short-term rental licensing, EV readiness, waste separation, property maintenance

A strata bylaw is unenforceable if it contravenes the Act or the Human Rights Code (SPA s.121). It is also practically unenforceable if it conflicts with the municipal bylaw the city will actually enforce. A noise bylaw saying "quiet after 11 PM" in a city whose bylaw sets 10 PM creates a gap the strata cannot close.

Managers today have no way to know when any of these four layers moved. There is no notification service. Provincial changes surface through industry newsletters weeks late. **Municipal changes surface not at all** — BC municipal bylaws are not registered with the Registrar of Regulations and are not published in the BC Gazette, so there is no central record to watch.

The result: bylaws drift out of compliance, notices get sent citing provisions that no longer hold, and the strata loses at the Civil Resolution Tribunal.

---

# 3. Users and accounts

## 3.1 The three account types

Account type is chosen at signup and determines the entire interface. It is a property of the **account**, not of the person.

| | **Admin** | **Multi-building manager** | **Single-building manager** |
|---|---|---|---|
| Also called | Platform / Org admin | Portfolio manager | Building manager |
| Buildings per account | All in the org | Many (typically 8–30) | **Exactly one** |
| Building switcher | Yes, plus org selector | Yes | **No** |
| Home screen | Org dashboard | Portfolio dashboard | Building dashboard |
| Ask scope levels | 4 (org → building → corpus → bylaw) | 3 (building → corpus → bylaw) | 2 (corpus → bylaw) |
| Can create buildings | Yes | Yes | No |
| Can invite users | Yes, any role | Yes, to their buildings | Council members only |
| Can adopt/file bylaws | Yes | Yes | Yes, for their building |
| Sees billing | Yes | No | No |
| Sees audit log | Org-wide | Their buildings | Their building |
| Typical user | Management company principal, BylawIQ staff | Licensed strata manager with a portfolio | Site manager, council president, self-managed strata |

## 3.2 Why three, not a permission matrix

The three types differ in **shape**, not just permissions. A portfolio manager's screen leads with "which of my 14 buildings needs me today". A single-building manager's screen leads with "here is your building". Giving the second user a switcher containing one item, or an empty portfolio dashboard, is worse than useless — it implies a capability they do not have and adds a decision at every step.

Permissions still exist within each type (§3.5), but the type is what selects the shell.

## 3.3 One account, one building — the deliberate constraint

**A single-building manager account is permanently bound to one building.** A person managing three buildings in this capacity holds three separate accounts with three separate logins.

This is a product decision, and it has a real cost, so it is worth being explicit about the trade.

**What it buys:**
- Absolute isolation. There is no code path, no query, no prompt injection that can cross buildings, because the account has no other building to reach. The strongest possible answer to "could BylawIQ ever show me another building's bylaws?"
- Matches how site managers are actually assigned and how their employers think about access.
- Clean per-building audit: every action in the log traces to an identity that exists only for that building.
- Simple mental model. The user never asks "which building am I in" because there is only one.

**What it costs:**
- Login friction for the person holding several.
- No cross-building view for that person, by design.
- Distinct email addresses required per account.

**Required mitigations — all three ship together with the constraint:**

1. **Plus-addressing at signup.** `manager+oakridge@company.com` is accepted and normalised. The user does not need three mailboxes.
2. **Linked accounts and fast switching.** A user may explicitly link accounts they control (verified by confirming from each). Once linked, an account switcher in the top bar re-authenticates in one click without a password re-entry, using a short-lived exchange token. **Linking enables switching, never merging.** No screen ever shows data from two buildings. No query ever spans them. The link is stored, is visible to org admins, and is revocable.
3. **Invitation-time guidance.** When an org admin invites the same email to a second building, the system detects it and asks explicitly: *"Rahul already manages Cedar Court as a single-building manager. Convert to a multi-building account, or create a second separate account?"* — with the trade-off stated in one line each. Most orgs will convert; the ones that want hard separation get it.

**Type conversion** is supported both ways, is an admin action, requires re-authentication, and writes an audit record. Converting single → multi merges nothing: it creates a new portfolio account and links the existing building memberships to it. The original account can be retired or kept.

## 3.4 Council members and residents

Council members attach to a single-building manager's building as invited users with reduced permissions. They are not a fourth account type — they are a role inside the single-building shell. Owner/resident read-only access is Phase 4.

## 3.5 Roles within account types

| Role | Available in | Key limits |
|---|---|---|
| `org_owner` | Admin | Billing, org settings, all buildings |
| `org_admin` | Admin | All buildings, no billing |
| `portfolio_manager` | Multi-building | Assigned buildings only |
| `portfolio_assistant` | Multi-building | Drafts but cannot adopt, file, or send |
| `building_manager` | Single-building | Full control of the one building |
| `council_president` | Single-building | Full control, can invite council |
| `council_member` | Single-building | Read and ask; cannot edit bylaws or send notices |
| `external_counsel` | Any | Read-only, time-boxed, for legal review |

The `*_assistant` and `council_member` roles cannot approve, adopt, or send. That separation is what makes the audit trail meaningful.

---

# 4. Information architecture

Six sections. The design goal is that a manager who has never seen the product can find any of the seven jobs in one click.

```
┌──────────────────────────────────────────────────────────────┐
│  ▣ BylawIQ          [ Oakridge Towers ▾ ]        ⌘K    ◐     │  ← switcher only for multi/admin
├────────────────┬─────────────────────────────────────────────┤
│                │                                             │
│  ✦ Ask BylawIQ │        ┌─────────────────────────────┐      │
│                │        │                             │      │
│  § Bylaws      │        │    Ask BylawIQ              │      │
│  🗀 Documents   │        │                             │      │
│  ✉ Notices     │        │  ┌───────────────────────┐  │      │
│  🔔 Updates  3 │        │  │ Ask anything…    [↑]  │  │      │
│                │        │  └───────────────────────┘  │      │
│  ─────────     │        │   ⚑ Oakridge  ⌗ All sources │      │
│  ⚙ Settings    │        │                             │      │
│                │        └─────────────────────────────┘      │
│                │                                             │
│  ◐ A. Shahana  │         Recent · Suggested · Updates        │
└────────────────┴─────────────────────────────────────────────┘
```

| Section | Purpose | Primary user action |
|---|---|---|
| **Ask BylawIQ** | Every question, general or building-specific | Type a question |
| **Bylaws** | Create, edit, version, adopt, file. The bylaw's whole life | Open a bylaw and edit it |
| **Documents** | Everything that is not a bylaw: minutes, plans, reports, correspondence | Upload and find |
| **Notices** | Draft, approve, send enforcement and council correspondence | Draft a notice |
| **Updates** | What needs to change and why | Act on a flagged bylaw |
| **Settings** | Building profile, address, members, letterhead, account | Configure |

**Ask BylawIQ is the front door.** It is the first nav item, the largest element on the home screen, and available from anywhere with `⌘K`. Everything else in the product is reachable from an answer — a question about a bylaw offers "Edit this bylaw", a question about a dispute offers "Draft the notice".

The five colour-coded modes from v2 are gone. Mode is now inferred from the question and shown as a small label, not selected up front. A manager should not have to classify their own question before asking it.

---

# 5. Knowledge base — layered by jurisdiction

## 5.1 The layer model

Every building has an address. The address resolves to a jurisdiction chain, and that chain determines which law applies.

```
Building: 1200 W Georgia St, Vancouver, BC V6E 2Y3
    │
    ├── L0  Federal            Charter · PIPEDA
    ├── L1  Province: BC       Strata Property Act · Regulation · Human Rights Code
    │                          Short-Term Rental Accommodations Act
    ├── L2  Regional: Metro Vancouver   Air quality · waste · water
    ├── L3  Municipal: City of Vancouver
    │                          Noise Control Bylaw 6555
    │                          Short-Term Rental licensing
    │                          Parking · EV readiness · Waste separation
    ├── L4  Case law           CRT · BCHRT · BCSC · BCCA (province-wide)
    ├── L5  Guidance           CHOA · BCFSA · Gov BC
    └── L6  This building      Registered bylaws · rules · minutes
```

**Precedence when they conflict:**

1. **L6 tells you what this building's rules are.**
2. **L1 tells you whether those rules are valid.** A bylaw contravening the Act or the Human Rights Code is unenforceable (s.121).
3. **L3 tells you what the city will actually enforce.** A strata bylaw cannot authorise what the municipal bylaw prohibits, and where the strata bylaw is more permissive than the city's, residents are still exposed to municipal enforcement.
4. **L4 tells you how all of the above has been applied.**

Answers must surface conflicts across layers, not just report L6. "Your bylaw says quiet hours start at 11 PM. Vancouver's Noise Control Bylaw sets 10 PM on weeknights. Your bylaw does not protect a resident from a city noise complaint between 10 and 11."

## 5.2 Address to jurisdiction resolution

```
Address → geocode → { lat, lng, municipality, regional_district, province, country }
        → jurisdiction_chain [ CA, BC, Metro Vancouver, City of Vancouver ]
        → corpus set
```

Stored on the building record at creation and re-verified annually. Manual override available — boundary cases exist (unincorporated areas fall under regional district jurisdiction directly; some addresses sit ambiguously near boundaries). The resolved chain is shown in building settings and is editable by an admin with an audit record.

## 5.3 Municipal coverage — the honest constraint

**BC municipal bylaws are not centrally published.** They are not registered with the Registrar of Regulations and do not appear in the BC Gazette. Most municipalities post only their most frequently requested bylaws online; obtaining a current consolidated version of an unlisted bylaw can require contacting the City Clerk.

There is no complete API. Therefore:

- **We cannot promise complete municipal coverage, and we must never imply it.**
- Every municipality gets a **coverage status**, displayed wherever municipal law affects an answer.

| Status | Meaning | Shown as |
|---|---|---|
| `full` | Consolidated bylaws ingested, monitored for change | ● Full coverage · updated weekly |
| `partial` | Key bylaws only (noise, parking, STR, waste) | ◐ Partial — noise, parking, short-term rental |
| `linked` | Not ingested; we link to the municipal source | ○ Not indexed — [City of X bylaws] |
| `none` | No source identified | ○ No municipal data |

An answer that depends on municipal law in a `partial` or `linked` municipality says so explicitly and does not guess.

**Sourcing strategy, in priority order:**

1. **BC Laws CiviX API** — the RESTful XML API covering BC provincial legislation and some civic bylaw content. Primary source for L1, and for whatever civic content it carries.
2. **Tier 1 municipal adapters** — hand-built scrapers for the ~25 municipalities holding the large majority of BC strata inventory: Vancouver, Surrey, Burnaby, Richmond, Coquitlam, Langley, Victoria, Saanich, Kelowna, Nanaimo, Abbotsford, Kamloops, and the rest of Metro Vancouver and the CRD. Most run on a small number of platforms (CivicWeb, eSCRIBE, municipal CMS), so adapters generalise better than the count suggests.
3. **Tier 2 semi-automated** — generic crawler plus LLM extraction, human-verified before publication.
4. **Tier 3 on-demand** — when a building is added in an uncovered municipality, queue that municipality for manual sourcing. Building density drives the roadmap.
5. **Commercial fallback** — evaluate Quickscribe's civic bylaw service for coverage we cannot economically build.

**Coverage is a growth metric, not a launch blocker.** Launch with Metro Vancouver and the CRD at `full`, everything else `linked`, and let building signups drive the queue.

## 5.4 Common knowledge base structure

Shared corpora are stored once and read by all authenticated accounts — they are public law. Building corpora are strictly isolated.

```sql
create table jurisdictions (
  id            uuid primary key default gen_random_uuid(),
  level         text not null check (level in ('federal','provincial','regional','municipal')),
  code          text not null,                    -- 'CA' | 'BC' | 'metro-vancouver' | 'vancouver'
  name          text not null,
  parent_id     uuid references jurisdictions(id),
  coverage      text not null default 'none',     -- full | partial | linked | none
  source_url    text,
  last_synced_at timestamptz,
  unique (level, code)
);

alter table legal_sources add column jurisdiction_id uuid references jurisdictions(id);
alter table buildings add column jurisdiction_chain uuid[] not null default '{}';
alter table buildings add column latitude numeric;
alter table buildings add column longitude numeric;
```

Retrieval filters on `jurisdiction_id = any(building.jurisdiction_chain)`. A building in Kelowna never retrieves Vancouver's noise bylaw.

---

# 6. Bylaws — the core surface

The section that makes BylawIQ a system of record rather than a search tool.

## 6.1 Structured bylaw model

A bylaw set is not a PDF. It is a tree.

```
Bylaw Set (Oakridge Towers, v4, in force since 12 Mar 2024)
├── Part 1 — Duties of Owners
│   ├── Bylaw 1.1 — Payment of strata fees
│   └── Bylaw 1.2 — Repair and maintenance of strata lot
├── Part 3 — Use of Property
│   ├── Bylaw 3.1 — Quiet hours          ← individually addressable, versioned, citable
│   │   ├── 3.1(1)
│   │   └── 3.1(2)
│   └── Bylaw 3.2 — Pets
└── Part 5 — Enforcement
    └── Bylaw 5.1 — Fines
```

Every node has a stable id, a version history, an effective date, a status, and a link to the LTO filing that made it effective. Citations point at nodes, so `[1] Bylaw 3.1(2) · in force 12 Mar 2024` is precise and clickable.

**Import path:** an uploaded PDF is parsed into this structure by the ingestion pipeline (§9.3), then presented for human confirmation. The manager reviews the detected structure — this is a five-minute task that makes everything downstream work — and confirms. Never auto-accept a parse for the document the whole product depends on.

## 6.2 Create a bylaw

Entry points: **Bylaws → New**, or from an answer ("your bylaws do not address this — draft one?"), or from an Update notification.

```
1. Choose a starting point
   ○ From the BC Standard Bylaws (Schedule to the SPA)
   ○ From a BylawIQ template  (noise · pets · parking · EV · smoking · STR · alterations)
   ○ From another building I manage        [portfolio/admin only]
   ○ Blank

2. Describe what you need
   Conversational. AI asks about building type, unit count, existing
   provisions, and what problem prompted this. One question at a time.

3. Draft, section by section
   Each section generated separately, editable inline, with the
   compliance linter running as you type (§6.4).

4. Review
   Compliance report · conflicts with existing bylaws · municipal
   comparison · required vote threshold · filing requirement.

5. Legal review                                    ← mandatory prompt, §7
6. Propose for adoption
```

## 6.3 Edit a bylaw

Editing an in-force bylaw creates an **amendment draft**. The in-force version is never mutated.

```
┌─ Bylaw 3.1 — Quiet Hours ────────────────── in force · 12 Mar 2024 ─┐
│                                                                      │
│  ┌─ Current ──────────────┐  ┌─ Your amendment ──────────────────┐  │
│  │ (1) An owner, tenant,  │  │ (1) An owner, tenant, occupant or │  │
│  │ occupant or visitor    │  │ visitor must not cause            │  │
│  │ must not cause         │  │ unreasonable noise between        │  │
│  │ unreasonable noise     │  │ 10:00 PM and 8:00 AM ~~11:00 PM~~ │  │
│  │ between 11:00 PM and   │  │                                    │  │
│  │ 7:00 AM.               │  │ (2) [+ new] Construction and      │  │
│  │                        │  │ renovation work is permitted only │  │
│  └────────────────────────┘  │ between 8:00 AM and 6:00 PM       │  │
│                              │ Monday to Saturday.                │  │
│  ⚠ 2 compliance findings     └────────────────────────────────────┘  │
│  ⓘ 1 municipal note                                                  │
│                                                                       │
│  [ Ask BylawIQ about this ]  [ Legal review ]  [ Propose ]           │
└───────────────────────────────────────────────────────────────────────┘
```

Side-by-side diff, inline editing, redline. Amendment metadata captured: rationale, proposer, target meeting date.

## 6.4 The compliance linter

Runs continuously while editing, sub-second, on the Groq tier (§9). It is the feature that makes non-lawyers safe to draft.

| Check | Severity | Example finding |
|---|---|---|
| Exceeds statutory fine cap (s.130) | **Blocker** | "$500 exceeds the maximum $200 for a bylaw contravention." |
| Rental restriction (unenforceable post Bill 44) | **Blocker** | "Rental restrictions are unenforceable under s.126 following Bill 44 (2022)." |
| Age restriction other than 55+ | **Blocker** | "Age restrictions were removed by Bill 44 except for 55+ seniors housing." |
| No accommodation for service animals | **Blocker** | "A pet prohibition without a service-animal exception is unenforceable — Human Rights Code s.4 prevails." |
| Conflicts with another bylaw in this set | Warning | "Bylaw 5.1 sets a $50 first fine; this sets $100 for the same contravention." |
| Conflicts with the municipal bylaw | Warning | "Vancouver's Noise Control Bylaw sets 10:00 PM. Yours would permit noise until 11:00 PM, which the city can still act on." |
| Missing enforcement procedure | Warning | "This creates an obligation with no consequence. s.135 procedure applies to any fine." |
| Vague standard | Info | "'Excessive' is not defined. The CRT applies an 'unreasonable' standard — consider aligning." |
| Wrong vote threshold assumed | Info | "Bylaw amendments require a 3/4 vote (s.53), not a majority." |
| Missing filing step | Info | "Not effective until filed at the LTO with Form I (s.128)." |

Blockers prevent proposing for adoption. They can be overridden with a typed justification, which is recorded and shown to the reviewing lawyer.

## 6.5 Adoption and filing lifecycle

```
draft → in_review → proposed → voted → adopted → filed → in_force
                       ↓          ↓
                   withdrawn   defeated
```

| Stage | What happens | System support |
|---|---|---|
| `draft` | Being written | Linter, versioning, AI drafting |
| `in_review` | With a lawyer | Review packet export, comment thread |
| `proposed` | On a meeting agenda | Generates the resolution text and the 14-day notice (s.45) |
| `voted` | Vote recorded | Records for/against/abstain, checks the 3/4 threshold (s.53) |
| `adopted` | Passed | **Warns: not yet effective** |
| `filed` | Form I filed at LTO | Filing reference captured, date recorded |
| `in_force` | Effective | Supersedes the prior version; retrieval switches over |

**The gap between `adopted` and `filed` is where stratas lose cases.** A bylaw amendment is not effective until filed at the Land Title Office (s.128). Councils routinely believe a passed vote is the end of it. BylawIQ raises a persistent, escalating notification from the moment a bylaw is adopted until the filing reference is entered. This one behaviour may prevent more CRT losses than the entire Q&A feature.

## 6.6 One common place to manage bylaws

The **Bylaws** section is the single home. It shows:

- The current in-force set as a browsable tree
- Every bylaw's status, effective date, and last review date
- Drafts and pending amendments
- Full version history with diffs, per node
- Compliance health across the whole set
- Comparison against the Standard Bylaws
- Export: consolidated PDF, Form I package, lawyer review packet

For portfolio managers, a cross-building bylaw view: compare the same bylaw across the portfolio, spot buildings missing a provision the others have, apply a template to several buildings (each generating its own separate draft requiring its own separate vote — never a bulk adoption).

---

# 7. Legal review and lawyer suggestions

**Requirement: after any bylaw edit, suggest a lawyer.**

## 7.1 When it triggers

| Trigger | Prompt strength |
|---|---|
| Any bylaw drafted or amended | Always — shown at the review step |
| A blocker override was used | **Strong** — cannot propose without acknowledging |
| A conflict with the Human Rights Code was flagged | **Strong** |
| The change touches fines, enforcement, or rentals | Strong |
| Minor wording change, no findings | Soft — a single line |

Never a modal that blocks work. Always present at the point of decision, with the reason it appeared.

## 7.2 The review panel

```
┌─ Before you propose this ────────────────────────────────────┐
│                                                               │
│  Risk assessment                          ●●●○○  Elevated     │
│                                                               │
│  Why                                                          │
│  · You overrode a blocker on the fine amount                  │
│  · This bylaw restricts an activity that may engage the       │
│    Human Rights Code (family status)                          │
│  · Enforcement bylaws are the most challenged category at     │
│    the CRT                                                    │
│                                                               │
│  Have a BC strata lawyer review this                          │
│                                                               │
│  ┌───────────────────────────────────────────────────────┐   │
│  │ ◐ Find a lawyer                                        │   │
│  │   CBA-BC Lawyer Referral · 1-800-663-1919              │   │
│  │   30-minute consultation, $25 + tax                    │   │
│  ├───────────────────────────────────────────────────────┤   │
│  │ ◐ Send to our review partners        [Phase 3]         │   │
│  │   Fixed-fee bylaw review, 3–5 business days            │   │
│  ├───────────────────────────────────────────────────────┤   │
│  │ ◐ Export a review packet                               │   │
│  │   Redline, findings, and questions for counsel — PDF   │   │
│  ├───────────────────────────────────────────────────────┤   │
│  │ ◐ We already have counsel                              │   │
│  │   Invite them as a reviewer (time-boxed access)        │   │
│  └───────────────────────────────────────────────────────┘   │
│                                                               │
│  [ Proceed without review ]              [ Get review ]       │
└───────────────────────────────────────────────────────────────┘
```

Choosing "Proceed without review" is recorded on the bylaw's history and appears in the audit log. Not to shame anyone — because when a bylaw is later challenged, the record of what was known and decided is exactly what counsel will need.

## 7.3 The review packet

Auto-generated PDF containing: the current and proposed text side by side, every linter finding with its statutory basis, any overrides with their justifications, the building profile, the relevant municipal bylaw extract, and a generated list of specific questions for counsel. It turns a two-hour lawyer engagement into a twenty-minute one, which is the actual reason managers will use it.

## 7.4 External counsel access

Invited as `external_counsel`: read-only, scoped to one building, time-boxed with an expiry on the membership row, able to comment on bylaw drafts but not edit. Access expires automatically.

## 7.5 Marketplace (Phase 3)

A vetted directory of BC strata lawyers with fixed-fee review products. Revenue share. Not in the MVP — the MVP ships the CBA-BC referral, the packet export, and the invite path, which cover the requirement without a marketplace's operational burden.

---

# 8. Updates — the notification engine

**Requirement: notifications that guide which bylaw needs updating.**

This is the retention mechanism. Q&A is why someone signs up; Updates is why they are still paying in year two.

## 8.1 Notification types

| # | Type | Trigger | Example |
|---|---|---|---|
| 1 | **Provincial legislative change** | SPA/Regulation diff | "s.130 fine limits amended. Your Bylaw 5.1 references the previous cap." |
| 2 | **Municipal bylaw change** | City bylaw diff | "Vancouver amended its Noise Control Bylaw to 9 PM on weeknights. Your Bylaw 3.1 permits noise until 11 PM." |
| 3 | **Tribunal decision** | CRT/court decision matching a bylaw pattern | "A CRT decision found a pet bylaw like yours unenforceable for failing to accommodate assistance animals." |
| 4 | **Unfiled adoption** | `adopted` with no filing reference | "Bylaw 3.1 was adopted 14 Mar and is not yet filed at the LTO. **It is not in force.**" |
| 5 | **Staleness** | Not reviewed in N years | "Your bylaws have not been reviewed since 2019. Six provincial changes have taken effect since." |
| 6 | **Gap** | Building profile implies a missing provision | "Your building has a parkade and no EV charging bylaw. Owners have a right to request installation." |
| 7 | **Internal conflict** | Two bylaws contradict | "Bylaw 3.2 permits one pet; Bylaw 7.4 prohibits pets in common property including the elevator." |
| 8 | **Compliance drift** | In-force bylaw now fails the linter | "Your rental restriction in Bylaw 8.1 has been unenforceable since Bill 44 (2022)." |
| 9 | **Deadline** | Computed from the Act | "AGM due within 2 months of your 31 Mar fiscal year end." |

Types 4 and 8 are the highest value and the least served by anything on the market.

## 8.2 Anatomy of a notification

Every notification answers four questions in this order: **what changed, which of your bylaws it hits, what the risk is, what to do.**

```
┌─ 🔔 Municipal noise bylaw changed ─────────── 3 days ago ─────┐
│                                                                │
│  City of Vancouver amended Noise Control Bylaw 6555 effective  │
│  1 July 2026. Weeknight quiet hours moved from 10 PM to 9 PM.  │
│                                                                │
│  AFFECTS      Bylaw 3.1 — Quiet Hours                          │
│               Your bylaw permits noise until 11:00 PM          │
│                                                                │
│  RISK         Medium. Your bylaw is still valid, but residents │
│               complying with it can be ticketed by the city    │
│               between 9 and 11 PM. Enforcing yours while the   │
│               city enforces theirs will confuse residents.     │
│                                                                │
│  SUGGESTED    Amend Bylaw 3.1 to align weeknight quiet hours   │
│               with the municipal standard.                     │
│                                                                │
│  [ Review the change ]  [ Draft the amendment ]  [ Dismiss ]   │
│                                                                │
│  Sources: Vancouver Bylaw 6555 s.4 · your Bylaw 3.1            │
└────────────────────────────────────────────────────────────────┘
```

"Draft the amendment" opens the bylaw editor with a pre-filled draft and the linter already run. From notification to proposed amendment in two clicks is the entire design target.

## 8.3 Matching engine

Change detected → affected buildings determined by jurisdiction chain → affected bylaws determined by semantic and topical matching → risk scored → notification generated → deduplicated → delivered.

Matching runs on the Groq tier for throughput (a provincial change fans out to every building in BC); risk assessment and the human-facing explanation run on Claude, because a wrong explanation is worse than no notification.

**False positives destroy this feature.** A manager who dismisses three irrelevant notifications stops reading the fourth. Precision is weighted far above recall: only notify when the match is confident, log the near-misses for tuning, and make dismissal a training signal.

## 8.4 Delivery and digest

| Channel | Default | Content |
|---|---|---|
| In-app badge | Always | Count of unactioned |
| Email digest | Weekly, Monday | Grouped by building, highest risk first |
| Email immediate | Blockers only | Unfiled adoption, compliance drift, statutory change |
| Portfolio roll-up | Multi-building accounts | "This change affects 11 of your 14 buildings" |

Every notification has a lifecycle: `new → viewed → actioned | dismissed | snoozed`. Dismissals capture a reason. Snoozes have dates.

---

# 9. AI architecture

## 9.1 Two-tier model strategy

Groq supplements Claude. The division is by **consequence**, not by difficulty.

> **Rule: if a wrong output could end up in a legal document or a legal claim, it runs on Claude. Everything else runs on Groq.**

Groq runs open-weight models on LPU hardware at roughly 300–1,000 tokens/second — several times faster than GPU inference — with an OpenAI-compatible API at `https://api.groq.com/openai/v1`, streaming, and tool calling. Input pricing starts around $0.05/M tokens. That combination makes it the right tier for high-frequency, low-consequence work where latency is the product.

| Task | Tier | Model | Why |
|---|---|---|---|
| Intent routing | Groq | `llama-3.1-8b-instant` | Every message. Must be invisible. |
| Query expansion | Groq | `llama-3.1-8b-instant` | Adds recall, must not add latency |
| **Compliance linter** | Groq | `openai/gpt-oss-120b` | Runs on every editing pause. Latency *is* the feature |
| Document structure detection | Groq | `openai/gpt-oss-120b` | High volume during ingestion, human-verified after |
| Notification matching (fan-out) | Groq | `openai/gpt-oss-120b` | One provincial change × thousands of bylaws. Batch API |
| Chat title generation | Groq | `llama-3.1-8b-instant` | Cosmetic |
| Municipal bylaw extraction | Groq | `qwen/qwen3.6-27b` | Bulk scraping cleanup, human-verified |
| Reranking | Groq | `llama-3.1-8b-instant` | 30 candidates → 8, on the critical path |
| **Legal answers with citations** | **Claude** | `claude-sonnet-5` | The product's core claim |
| **Bylaw drafting** | **Claude** | `claude-sonnet-5` | Becomes a legal instrument |
| **Notice drafting** | **Claude** | `claude-sonnet-5` | Goes to a resident, cited at the CRT |
| **Risk assessment** | **Claude** | `claude-sonnet-5` | Drives the lawyer recommendation |
| **Notification explanation** | **Claude** | `claude-sonnet-5` | Wrong explanation destroys trust |
| Complex multi-step analysis | Claude | `claude-opus-5` | CRT packages, cross-bylaw conflict analysis |

**Model IDs to avoid.** Groq deprecated `moonshotai/kimi-k2-instruct-0905` (March 2026) and `qwen/qwen3-32b` and `meta-llama/llama-4-scout-17b-16e-instruct` (June 2026), migrating to `openai/gpt-oss-120b`. Do not pin to deprecated ids; centralise them in one config module (§9.2) so a deprecation is a one-line change.

## 9.2 Orchestration

```ts
// lib/ai/models.ts — single source of truth
import { anthropic } from '@ai-sdk/anthropic';
import { groq } from '@ai-sdk/groq';

export const MODELS = {
  route:      groq('llama-3.1-8b-instant'),
  expand:     groq('llama-3.1-8b-instant'),
  rerank:     groq('llama-3.1-8b-instant'),
  title:      groq('llama-3.1-8b-instant'),
  lint:       groq('openai/gpt-oss-120b'),
  structure:  groq('openai/gpt-oss-120b'),
  match:      groq('openai/gpt-oss-120b'),
  extract:    groq('qwen/qwen3.6-27b'),

  answer:     anthropic('claude-sonnet-5'),
  draft:      anthropic('claude-sonnet-5'),
  notice:     anthropic('claude-sonnet-5'),
  risk:       anthropic('claude-sonnet-5'),
  deep:       anthropic('claude-opus-5'),
} as const;
```

Both providers plug into the Vercel AI SDK, so tier switching is a model reference change, not a rewrite.

**Fallback:** if Groq is unavailable, the linter degrades to deterministic rule checks (fine caps, rental restrictions, and threshold checks are pure logic and need no model at all) and routing defaults to the general path. Groq being down must never block drafting. If Anthropic is unavailable, answering is disabled with an honest status message — it must never silently downgrade to an open model, because the citation guarantee is model-specific and the user cannot see the substitution.

## 9.3 Retrieval

Unchanged from the engineering docs: hybrid BM25 + vector search fused with Reciprocal Rank Fusion, over-retrieve 30–40, rerank to 8–10, structural chunking with contextual headers, structured citations resolved to database rows. Extended with `jurisdiction_id` filtering so municipal and regional layers retrieve only for the building's chain.

## 9.4 The multi-level scope selector

**Requirement: multi-level selections.**

```
Level 1  SCOPE      ○ General question    ● About a building
Level 2  BUILDING   [ Oakridge Towers ▾ ]          ← hidden for single-building accounts
Level 3  SOURCES    ☑ Our bylaws   ☑ BC law   ☑ City of Vancouver   ☐ Case law
Level 4  BYLAW      [ Any ▾ ] or [ Part 3 → Bylaw 3.1 ▾ ]
```

Rendered as chips beneath the input, not a form. Defaults are correct for the common case, so most users never touch them:

- Single-building account: Level 1 defaults to "About a building", Level 2 is fixed and hidden.
- Multi-building account: Level 2 defaults to the last active building.
- Level 3 defaults to everything available for that building.
- Level 4 auto-populates when the question mentions a bylaw number, and when the user arrives from a bylaw page.

Level 4 is what makes "ask about a specific bylaw" real: from any bylaw in the editor, **Ask BylawIQ about this** opens the composer pre-scoped to that node.

---

# 10. Notices

**Requirement: one place to draft notices as per the building bylaw.**

Notices are generated *from* the bylaw tree, not from free text. A s.135 notice cites the specific bylaw node, in the version in force on the date of the conduct.

| Template | Basis | Key generated content |
|---|---|---|
| Complaint acknowledgement | s.135(1) | Confirms receipt, states next steps |
| Written notice of contravention | s.135(1)(a) | Particulars, the bylaw cited, response window |
| Hearing invitation | s.135(1)(b) | Within 4 weeks of request |
| Hearing decision | s.135(2) | Within 1 week of hearing |
| Fine notice | s.130, s.135 | Amount validated against the building's own fine bylaw |
| Demand for compliance | s.135 | |
| Council report | — | Options with the legal basis for each |
| CRT evidence package | — | Chronology from dispute events, all documents |

**Fine amounts are validated against the building's bylaw, not the statutory maximum.** If Bylaw 5.1 sets $50 for a first contravention, the notice says $50 even though the Act permits $200. This is the single most common source of overturned fines and it is a pure data check.

Every notice: draft → human review → approval by a user with the permission → send → logged to the dispute timeline. Separation of duties on s.135 notices and decision letters — the approver cannot be the drafter, org-configurable, defaulted on.

---

# 11. Documents

**Requirement: one place to manage documents.**

Everything that is not a bylaw: strata plan, council minutes, AGM/SGM minutes, depreciation report, insurance, Form B/F, correspondence, photos and evidence.

Upload → parse → structure → chunk → embed → searchable and citable. Filter by type, date, and status. Full-text and semantic search. Evidence attaches to disputes. Minutes are especially valuable — they are what proves the 3/4 vote that adopted a bylaw, and without them the bylaw's validity is arguable.

Bylaws live in **Bylaws**, not here, because they have a lifecycle and everything else does not.

---

# 12. Non-functional requirements

| Area | Requirement |
|---|---|
| Latency | Linter < 500 ms · retrieval P50 < 200 ms · time to first token < 1.5 s · building switch < 3 s |
| Availability | 99.5% · Groq outage degrades gracefully · Anthropic outage disables answering with an honest message |
| Isolation | Zero cross-building leakage. Enforced by RLS, not prompts. Proven by test |
| Accuracy | Grounded citation rate > 95% · faithfulness > 0.90 · citation resolvability 100% |
| Notification precision | > 85% of notifications rated relevant. Precision over recall |
| Accessibility | WCAG 2.1 AA, enforced in CI |
| Privacy | PIPA compliant. No training on customer documents. Deletable, exportable |
| Audit | Append-only log of every view, edit, approval, and send |
| Scale | 10,000 buildings, 1M+ chunks, 500 concurrent sessions |

---

# 13. Metrics

| Metric | Target | Meaning |
|---|---|---|
| Bylaws under management | ↑ | The real adoption metric |
| Buildings with a structured bylaw set | > 80% of active | Product is working as a system of record |
| Notification action rate | > 40% | Updates are relevant |
| Notification dismissal-as-irrelevant | < 15% | Precision is holding |
| Amendments completed in-product | ↑ | The lifecycle loop closed |
| Unfiled-adoption warnings resolved | > 90% | Direct CRT loss prevention |
| Legal review conversion | > 25% when strongly prompted | The safety valve is used |
| Municipal coverage | 25 municipalities at `full` by month 6 | Knowledge base growth |
| Cross-building leak incidents | 0 | Existential |
| Groq share of total calls | > 70% | Cost architecture working |

---

# 14. Roadmap

| Phase | Weeks | Ships |
|---|---|---|
| **0 Foundation** | 1 | Repo, CI with RLS gates, environments |
| **1 Identity** | 2–4 | Three account types, roles, RLS, one-account-one-building with linked switching, onboarding |
| **2 Documents** | 5–6 | Upload, ingestion, vault, storage |
| **3 Bylaw structure** | 7–8 | Parse to tree, human confirmation, versioning, browse |
| **4 Ask BylawIQ** | 9–11 | Retrieval, chat, citations, multi-level scope selector |
| **5 Jurisdiction KB** | 12–13 | Address resolution, provincial corpus, Metro Van + CRD municipal, coverage indicators |
| **6 Bylaw editor** | 14–16 | Create, edit, diff, **linter**, adoption lifecycle, LTO filing tracking |
| **7 Legal review** | 17 | Risk scoring, review packet, CBA-BC referral, counsel invitation |
| **8 Notices** | 18–19 | Templates from the bylaw tree, fine validation, approval, send, dispute log |
| **9 Updates** | 20–22 | Change detection, matching, risk, delivery, digest |
| **10 Hardening** | 23–24 | Load, a11y, pen test, runbooks, cost controls |

**Deferred:** lawyer marketplace · owner portal · bylaw benchmarking · PMS connectors · Ontario and Alberta expansion.

**MVP for the first paying customer is Phases 0–6.** That is create, manage, ask, and lint — a system of record with guardrails. Updates (Phase 9) is what makes it a subscription rather than a purchase, but it needs the bylaw structure to exist first.

---

# 15. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| Cross-building leakage | Existential | RLS + session-derived scope + one-account-one-building + tested in CI |
| Municipal coverage gaps create false confidence | High | Coverage status shown wherever municipal law affects an answer; never imply completeness |
| Notification false positives | High | Precision over recall; dismissal reasons as training signal; hold launch until > 85% |
| Bylaw parsing produces an unusable tree | High | Human confirmation step is mandatory, not optional |
| Users treat drafts as legal advice | High | Non-dismissible disclaimer + mandatory review prompt + approval gate + export watermark |
| Groq model deprecation | Medium | Centralised model config; deterministic linter fallback |
| Municipal scraping breaks | Medium | Per-adapter health monitoring; degrade to `linked` rather than serving stale law |
| Separate logins frustrate users | Medium | Plus-addressing, linked-account fast switch, conversion prompt at invitation |
| Legal liability from a wrong answer | High | Citations, drafts only, human approval, audit trail, professional insurance |

---

# 16. Open questions

1. **Municipal ingestion economics.** How many hours per Tier-1 adapter, and what is the real maintenance cost when a city redesigns its site? This determines whether coverage is a moat or a treadmill.
2. **Lawyer marketplace model.** Referral fee, revenue share, or flat listing? Affects Phase 3 scope and possibly Law Society advertising rules.
3. **Pricing unit.** Per building, per manager, or per portfolio tier? Per building aligns with value and with cost, but punishes the small self-managed strata that most needs the product.
4. **LTO integration.** Is programmatic filing status verification possible, or is the filing reference always manually entered?
5. **Council member access in the single-building shell.** Full read of drafts, or only adopted bylaws? Councils leak.
