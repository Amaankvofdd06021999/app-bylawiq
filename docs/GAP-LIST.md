# Gap list by role

Derived from `docs/ROLE-FLOW-INVENTORY.md`. Every row is listed. **No flow has staging acceptance evidence yet**, so no row is
complete. "Local evidence" is what passes on the local stack only; it does not count toward completion.

Owners: **Eng** = engineering. **Op** = operator (staging and hosted). **Counsel** = counsel and product. **Sec** = security
reviewer. Tracker item numbers refer to the inventory's Tracker table.

Status key: Missing · Built (not tested) · Tested locally · Off (gated) · Blocked · Deferred (by PRD).

## Building manager

| Flow | Status | Owner | Depends on | Local evidence | Staging evidence |
|---|---|---|---|---|---|
| Sign in and workspace onboarding | Tested locally | Eng | Op (staging) | onboard helper, workspace E2E | None |
| Sign-in: bounded steps and recovery | Tested locally | Eng | Op | unit 7; E2E sign-in-recovery 2 | None |
| Building home | Tested locally | Eng | Op | building-manager-dashboard | None |
| Upload to vault: scan, limit, retry | Tested locally; scanner Blocked | Op, Eng | Op (scanner) | building-documents-ask | None |
| Confirm detected structure | Tested locally | Eng | Op | building-documents-ask | None |
| Parse bylaw to tree | Tested locally | Eng | Op | ingest to review | None; parser quality not verified on real bylaws |
| Create, edit a structured bylaw | Tested locally | Eng | Op | bylaw_versions pgTAP 10; bylaw-versions E2E | None (item 5) |
| Version history | Tested locally | Eng | Op | bylaw-history unit 3; E2E | None (item 5) |
| Word diff between versions | Tested locally | Eng | Op | bylaw-diff unit 8; E2E | None (item 5) |
| Compliance linter (advisory) | Built | Counsel, Eng | Counsel approval (item 6) | bylaw-linter unit 29; panel unit 3; E2E | None |
| Linter enforcement on proposal | Missing | Counsel, Eng | Counsel approval; migration approval | none | None (item 6) |
| LTO filing: validated reference, status, escalation on home and Updates | Tested locally (database and UI) | Eng | Op (apply to hosted, with approval) | lto_filing pgTAP 16; lto-filing E2E 4 (home and Updates); lto-filing unit 23; rollback run locally | None (item 6) |
| LTO escalation schedule (14 and 60 days) | Decided; product to confirm in writing | Product, Counsel | Written confirmation; counsel review | `docs/LTO-ESCALATION.md` | None |
| LTO scheduled refresh (stored severity) | Built (held); awaiting security review | Sec, Eng | `docs/SECURITY-REVIEW-LTO-REFRESH.md` signed; operator confirms keys and `pg_cron` | refresh unit (held, not in repo) | None |
| Adoption lifecycle | Tested locally | Eng | Op | building-notices-disputes | None |
| Notification feed (updates) | Tested locally | Eng | Op | building-notices-disputes | None |
| Notification matching engine | Missing | Eng | Item 9 spec (PRD §8.3) | none | None (item 9) |
| Digest delivery | Missing | Eng, Op | Email service (Op); item 9 | none | None (item 9) |
| Legal review trigger, review panel | Missing | Eng, Counsel | Item 7 spec | none | None (item 7) |
| Risk scoring, review packet | Missing | Eng, Counsel | Item 7 spec | none | None (item 7) |
| Notice templates from bylaw tree | Missing | Eng | Item 8 | none | None (item 8) |
| Fine validation before send | Missing | Eng, Counsel | Item 8; linter rules | none | None (item 8) |
| Notice draft, send to firm review, approve | Tested locally | Eng | Op | firm-review | None |
| Notice send to residents | Built (not tested) | Eng, Op | Email service (Op); item 8 | none | None (item 8) |
| Dispute log | Tested locally | Eng | Op | building-notices-disputes | None |
| Invite resident with unit | Tested locally | Eng | Op (email delivery) | resident-join | None |
| Invitation email delivery | Blocked | Op | Provider verified; staging | invitations unit (mocked) | None |
| Verify resident unit | Tested locally | Eng | Op | resident-join | None |
| Single-building binding | Tested locally | Eng | Op | account-type-retirement unit | None |
| Plus-addressing at signup | Missing | Eng | Item 11 | none | None (item 11) |
| Linked accounts and fast switch | Built (not tested) | Eng | Item 11 | none | None (item 11) |
| Convert single to multi-building | Missing | Eng, Sec | Item 11 (re-authentication design) | none | None (item 11) |
| Invitation-time conversion prompt | Missing | Eng | Item 11 | none | None (item 11) |
| Ask (building scope) | Off (gated) | Counsel, Op, Eng | Item 3, item 4 | ask-launch-denial, launch-scope unit | None; stays off |
| Building bulletin | Off (gated) | Eng | Product decision (not in PRD) | launch-off-surfaces, launch-off-actions | None; stays off |
| Document download from vault | Built (not tested) | Eng | Op | none | None |
| Municipal address resolution and coverage | Missing | Eng, Counsel | Item 3 (corpus); item 12 | none | None (item 12) |

## Portfolio manager

| Flow | Status | Owner | Depends on | Local evidence | Staging evidence |
|---|---|---|---|---|---|
| Portfolio view, switching, counts | Tested locally | Eng | Op | strata-portfolio | None |
| Outsider and other firm refused | Tested locally | Eng | Op | strata-portfolio | None |
| Assistant role: drafts only | Built (not tested) | Eng | Op | role matrix unit | None |
| Manage buildings across portfolio | Built (not tested) | Eng | Op | none | None |
| Portfolio analytics | Missing | Eng, Product | Item 13 (metric definitions) | none | None (item 13) |
| Portfolio Ask | Off (gated) | Counsel, Op | Item 4 | ask-launch-denial | None; stays off |

## Firm owner

| Flow | Status | Owner | Depends on | Local evidence | Staging evidence |
|---|---|---|---|---|---|
| Onboarding, link buildings by code, roster | Tested locally | Eng | Op | firm-owner-links | None |
| Team invitations and membership | Tested locally | Eng | Op | firm-team | None |
| Review inbox: request changes, approve | Tested locally | Eng | Op | firm-review | None |
| Firm knowledge library (text search) | Tested locally | Eng | Op | firm-knowledge | None |
| Org admin: buildings, team, settings | Built (not tested) | Eng | Op | none | None |
| Billing, plans, seats | Off (gated) | Eng, Op (provider) | Payments provider and pricing (product) | launch-off-surfaces, launch-off-actions | None; stays off |
| Org-wide audit log | Missing | Eng | Item 14 | none | None (item 14) |

## Resident

| Flow | Status | Owner | Depends on | Local evidence | Staging evidence |
|---|---|---|---|---|---|
| Join with invitation (wrong email, reuse, expiry, revocation, other building) | Tested locally | Eng | Op (email for delivery) | resident-join (5) | None |
| Home: in-force bylaws as alerts, unit status | Tested locally | Eng | Op | resident-join | None |
| Explainers | Built (not tested) | Eng | Item 15 | none | None (item 15) |
| Ask (AI answers) | Off (gated) | Counsel, Op | Item 4 | ask-launch-denial | None; stays off |
| Credits, paywall, purchases | Off (gated) | Eng, Op (provider) | Payments provider and pricing | launch-off-actions | None; stays off |
| Drafting | Off (gated) | Counsel | Counsel approval (decision D5) | launch-off-actions | None; stays off |
| Resident verification gate for AI | Off (gated) | Counsel, Eng | Item 4 | none | None; stays off |
| Owner and resident read-only portal | Deferred (by PRD) | Product | Phase 4 | none | None |

## Platform admin

| Flow | Status | Owner | Depends on | Local evidence | Staging evidence |
|---|---|---|---|---|---|
| MFA enrolment, wrong code, valid code | Tested locally | Eng | Op | platform-mfa (5 per project) | None |
| MFA step-up, lease, expired-lease recovery | Tested locally | Eng | Op | platform-mfa-lease; platform-mfa-load 5 of 5 repeat runs green | None |
| Non-admin denied the console | Tested locally | Eng | Op | platform-mfa | None |
| Signing key probe | Tested locally (database) | Eng, Op | Op (production key match) | signing_key_probe | None |
| Platform admin reconciliation | Tested locally (database) | Eng | Op | platform_admin_reconciliation | None |
| Grant platform admin | Missing (migration uncommitted) | Eng, Sec | Item 14; two-operator approval | none | None (item 14) |
| Revoke platform admin | Missing (migration uncommitted) | Eng, Sec | Item 14 | none | None (item 14) |
| Feature flags | Built (not tested) | Eng | Item 14 | none | None (item 14) |
| Audit log viewer | Built (not tested) | Eng | Item 14 | none | None (item 14) |
| AI analytics | Off (gated) | Counsel | Item 4 | launch-off-surfaces | None; stays off |
| Billing | Off (gated) | Eng, Op | Payments provider | launch-off-surfaces | None; stays off |

## Council (PRD §3.4; decided in scope)

| Flow | Status | Owner | Depends on | Local evidence | Staging evidence |
|---|---|---|---|---|---|
| Council member invitation (reduced role) | Built (not tested) | Eng | Item 10 | matrix unit only | None (item 10) |

## External counsel (PRD §7.4; decided in scope, with legal review)

| Flow | Status | Owner | Depends on | Local evidence | Staging evidence |
|---|---|---|---|---|---|
| Time-limited counsel access (grant, read, expiry, revoke) | Tested locally (database only; no UI, no E2E) | Eng | Migration 20261047000063 apply (Op approval); counsel review of who may be granted | `counsel_access` pgTAP 19 (success, denial, expiry, revoke, cross-building, period limits, unique active grant) | None (item 7) |
| Counsel review packet and comment thread | Missing | Eng, Counsel | Item 7 | none | None (item 7) |
| CBA-BC referral, counsel invitation UI | Missing | Eng, Counsel | Item 7; referral rules (counsel) | none | None (item 7) |

## Cross-cutting and operations

| Capability | Status | Owner | Depends on | Local evidence | Staging evidence |
|---|---|---|---|---|---|
| Invitation email: creation | Tested locally | Eng | None | invitations unit | None |
| Invitation email: delivery | Blocked | Op | Provider, sender domain, staging allowlist | none | None |
| Malware scanner | Blocked | Op | Real endpoint (FILE_SCAN_URL) | local stub | None |
| Document ingestion (background jobs) | Tested locally | Eng, Op | Inngest keys on staging | ingest path | None |
| Legal corpus ingestion | Blocked | Counsel | Written approval; LEGAL_CORPUS_INGEST_ENABLED | none | None |
| Eval gate for answer model | Missing | Counsel, Eng | kb/dist/evals.jsonl | none | None |
| Operational monitoring and alerts | Missing | Op | Monitoring service choice (product) | /api/health only | None |
| Upload size limit | Tested locally; deployed Blocked | Op | Deployed limit check | 4 MB E2E | None |
| Staging environment | Blocked | Op | Staging project refs and operator access | none | None |
| Production environment | Blocked | Op | Staging acceptance; migration approval | none | None |
| Sign-in on CI | Green at 8f9dce7 (CI, not staging) | Eng | None | CI run 39136095531 | None |

## Summary

- Flows with staging evidence: **0 of 76**.
- Open items needing a person outside engineering: staging (Op), counsel approval (linter, corpus, fine rules, legal review
  packet), product decisions (payments, monitoring, Ask timing, escalation confirmation), security exception (scheduled refresh,
  two-operator grants).
- Gated and must stay off until approved: Ask (all roles), billing and credits, drafting, AI analytics, bulletin.
