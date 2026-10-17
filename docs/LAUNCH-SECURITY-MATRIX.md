# Launch security matrix

Each launch-scope data path or role permission, with the test that proves it. "pgTAP" is `supabase/tests/*.sql`, run
against the local database. "E2E" is `tests/e2e/*.spec.ts`, run against the real app on the local stack. A path with no
row is not launch scope. Excluded tests are listed in `docs/TEST-EXCLUSIONS.md`.

| Role | Data path / permission | Proof (allow, deny, cross-building, failure) |
|---|---|---|
| Building manager | Building home, documents (building.read, vault.read) | E2E `building-manager-dashboard` (home from database; other manager refused by direct id); pgTAP `isolation`, `personas_authorization` |
| Building manager | Upload and confirm documents; Ask scoped to building | E2E `building-documents-ask` (retry refused to other building); pgTAP `building_documents_slice` |
| Building manager | Notifications / updates (chat.use read; bylaw.adopt change) | pgTAP `notices_disputes_authorization` (read, dismiss, reason required, resident and other building refused); E2E `building-notices-disputes` |
| Building manager | Bylaws: draft, review, vote, adopt (bylaw.adopt) | pgTAP `notices_disputes_authorization` (resident and other building refused; move allowed); E2E `building-notices-disputes` (adoption creates the update; no-majority refusal shows reason) |
| Building manager | Disputes: open and log events (dispute.create, dispute.update) | pgTAP `notices_disputes_authorization` (resident and other building refused; unknown stage refused); E2E `building-notices-disputes` (short summary refused; resolution leaves home) |
| Building manager | Notices sent to firm for review | E2E `firm-review` (send, request changes, approve); pgTAP `firm_review` (assistant, other firm, unlinked refused; comment required; approval records approver) |
| Building manager | Invite and verify residents (member.invite) | E2E `resident-join` (invite with unit, verify, denials); pgTAP `resident_join` (18) |
| Portfolio manager | Portfolio of linked buildings (counts from database; outsider sees none) | E2E `strata-portfolio` (switching; other firm's building refused by direct id; outsider sees none) |
| Firm owner | Onboarding, linking buildings by code, roster | E2E `firm-owner-links` (other firm sees neither roster nor buildings; direct id refused) |
| Firm owner | Team invitations, membership | E2E `firm-team`; pgTAP `firm_team` (13) |
| Firm owner | Review inbox and decisions | E2E `firm-review`; pgTAP `firm_review` (17) |
| Firm owner | Firm knowledge library (text search, not semantic) | E2E `firm-knowledge` (publish, duplicate refused, other firm sees none); pgTAP `firm_knowledge` (13) |
| Resident | Join with invitation: wrong email, reuse, expiry, revocation, other building | E2E `resident-join` (5 tests); pgTAP `resident_join` |
| Resident | Home: in-force bylaws as alerts; unit status | pgTAP `resident_join` (residents read in-force only, not drafts; other building reads none); E2E `resident-join` |
| Resident | AI, explainers, drafting, credits, payments | Disabled for launch. Not claimed. Tests in `chat-rag` and `demo` are excluded (see TEST-EXCLUSIONS) |
| Platform admin | MFA enrolment, wrong-code refusal, valid code, lease, expired-lease recovery | E2E `platform-mfa`, `platform-mfa-lease`, `platform-mfa-load`; pgTAP `mfa_verification_lease` (8) |
| Platform admin | Non-admin denial of the admin console | E2E `platform-mfa` (ordinary user sent away) |
| Platform admin | Signing key probe, platform admin reconciliation | pgTAP `signing_key_probe`, `platform_admin_reconciliation` |
| Platform admin | Grant and revoke of admin access | **Unavailable for launch.** No UI. Database functions and tests are uncommitted (see backlog). Not claimed |
| Platform admin | Feature flags, audit log viewer | **Deferred.** Functions exist (`set_flag`, `get_audit_logs`) but have no end-to-end test. Not claimed |
| Everyone | Bulletin (posts, pinning, length limits, RLS) | **Unavailable for launch.** The old E2E spec is `test.fixme` and the pgTAP RLS test was deleted. Not claimed |
| Everyone | Health and readiness | E2E `health` |
| Everyone | Sign-in, onboarding, workspace layout | E2E `workspace`, `responsive` (desktop and mobile layouts) |
| Everyone | Legal corpus sync | pgTAP `legal_corpus` (modified; re-run before claiming) |

## Gaps closed in this review

- Notifications, dispute events, and bylaw moves had no database-level denial tests. Added `supabase/tests/notices_disputes_authorization.test.sql` (15 checks).
- The RLS tests deleted from HEAD (`rls_dashboards`, `rls_firm_knowledge`, `rls_session_role`) are covered by the current `isolation`, `personas_authorization`, and `firm_knowledge` tests. `bulletin_rls` has no replacement, so bulletin is out of launch.

## Still open before launch

- Re-run `legal_corpus.test.sql` from a clean checkout; it is modified in the working tree.
- Feature flags and the audit viewer need an end-to-end test or must be marked unavailable in the console.
