# Migration reconciliation (HEAD vs working tree)

Generated from `git show HEAD:` and the working tree. Changed lines ignore CR line endings. Hosted status: **unknown and blocked** until an authorized operator provides the read-only hosted migration version and name list (versions, names and, if available, statement hashes).

## Reproduction (local only)

- Committed chain (HEAD, 38 files) on a fresh local reset: fails at `20261007_phase5_infrastructure.sql` with `column "deleted_at" does not exist` after 23 files apply.
- A prototype forward migration adding `deleted_at` to `building_members` and `org_members` moved the failure to `public.building_links`, which HEAD never creates (it was later replaced by `firm_building_links`). Repairing the committed chain would need edits to committed files, so forward-only repair is not viable for a fresh replay.
- Working-tree chain (61 files): fresh local reset succeeds.

## File-by-file

| HEAD file | status | working-tree file | changed lines |
|---|---|---|---|
| `20260914092313_identity.sql` | unchanged-name | `20260914092313_identity.sql` | 0 |
| `20260914092340_workspace.sql` | unchanged-name | `20260914092340_workspace.sql` | 0 |
| `20260914092416_governance.sql` | unchanged-name | `20260914092416_governance.sql` | 0 |
| `20260914092517_members_and_retrieval.sql` | unchanged-name | `20260914092517_members_and_retrieval.sql` | 0 |
| `20260914092559_trusted_writes.sql` | unchanged-name | `20260914092559_trusted_writes.sql` | 0 |
| `20260914092645_linked_accounts.sql` | unchanged-name | `20260914092645_linked_accounts.sql` | 0 |
| `20260914092723_workspace_finalize.sql` | unchanged-name | `20260914092723_workspace_finalize.sql` | 0 |
| `20260914141623_security_review.sql` | unchanged-name | `20260914141623_security_review.sql` | 0 |
| `20260915090000_invitation_member_guard.sql` | unchanged-name | `20260915090000_invitation_member_guard.sql` | 0 |
| `20260915091000_scan_gate.sql` | unchanged-name | `20260915091000_scan_gate.sql` | 0 |
| `20260915092000_as_of_superseded_documents.sql` | unchanged-name | `20260915092000_as_of_superseded_documents.sql` | 0 |
| `20260915093000_notification_permissions.sql` | unchanged-name | `20260915093000_notification_permissions.sql` | 0 |
| `20260915094000_review_gate_whole_words.sql` | unchanged-name | `20260915094000_review_gate_whole_words.sql` | 0 |
| `20260915095000_invitation_conflict_same_org.sql` | unchanged-name | `20260915095000_invitation_conflict_same_org.sql` | 0 |
| `20260915096000_registered_bylaw_import.sql` | unchanged-name | `20260915096000_registered_bylaw_import.sql` | 0 |
| `20260915097000_account_link_oversight.sql` | unchanged-name | `20260915097000_account_link_oversight.sql` | 0 |
| `20260927090000_firm_links_schema.sql` | unchanged-name | `20260927090000_firm_links_schema.sql` | 0 |
| `20260927091000_building_orgs.sql` | unchanged-name | `20260927091000_building_orgs.sql` | 0 |
| `20260927092000_firm_link_codes.sql` | unchanged-name | `20260927092000_firm_link_codes.sql` | 0 |
| `20260927093000_firm_review.sql` | unchanged-name | `20260927093000_firm_review.sql` | 0 |
| `20261001090000_legal_corpus_sync.sql` | unchanged-name | `20261001090000_legal_corpus_sync.sql` | 0 |
| `20261007_onboarding_tables.sql` | renamed+rewritten | `20261007000015_onboarding_tables.sql` | 4 |
| `20261007_phase5_infrastructure.sql` | renamed+rewritten | `20261007000016_phase5_infrastructure.sql` | 14 |
| `20261007_phase6_ai_completion.sql` | renamed+rewritten | `20261007000017_phase6_ai_completion.sql` | 14 |
| `20261008_access_token_hook.sql` | renamed+rewritten | `20261008000018_access_token_hook.sql` | 24 |
| `20261008_session_role_enforcement.sql` | renamed+rewritten | `20261008000019_session_role_enforcement.sql` | 27 |
| `20261009_resident_wallets.sql` | renamed+rewritten | `20261009000020_resident_wallets.sql` | 2 |
| `20261010_firm_knowledge.sql` | renamed+rewritten | `20261010000021_firm_knowledge.sql` | 12 |
| `20261011_cost_controls.sql` | renamed | `20261011000022_cost_controls.sql` | 0 |
| `20261012_staff_documents.sql` | renamed+rewritten | `20261012000023_staff_documents.sql` | 89 |
| `20261012_staff_retrieval.sql` | renamed | `20261012000024_staff_retrieval.sql` | 0 |
| `20261013_financial_analytics.sql` | renamed | `20261013000025_financial_analytics.sql` | 0 |
| `20261014_onboarding_system.sql` | renamed | `20261014000026_onboarding_system.sql` | 0 |
| `20261014_platform_admin_core.sql` | renamed | `20261014000027_platform_admin_core.sql` | 0 |
| `20261014_platform_audit_system.sql` | renamed+rewritten | `20261014000028_platform_audit_system.sql` | 2 |
| `20261014_regional_knowledge_bases.sql` | renamed+rewritten | `20261014000029_regional_knowledge_bases.sql` | 12 |
| `20261015_bulletin_posts.sql` | renamed+rewritten | `20261015000030_bulletin_posts.sql` | 10 |
| `20261015_resident_audit_log.sql` | renamed | `20261006000014_resident_audit_log.sql` | 0 |
| — | ADDED (no HEAD file) | see below | — |

## Added in working tree (no HEAD counterpart)

- `20261016000031_rls_gap_tables.sql`
- `20261017000032_wallet_hardening.sql`
- `20261018000033_resident_drafts.sql`
- `20261019000034_directory_emails.sql`
- `20261020000035_profile_fks.sql`
- `20261021000036_single_flag_table.sql`
- `20261022000037_creator_membership.sql`
- `20261023000038_bylaw_not_yet_effective.sql`
- `20261024000039_firm_reviewer_read_only.sql`
- `20261025000040_guard_unscoped_functions.sql`
- `20261026000041_fix_search_and_month_functions.sql`
- `20261027000042_fix_search_score_type.sql`
- `20261028000043_fix_compare_ranking_type.sql`
- `20261029000044_resident_audit_writer.sql`
- `20261030000045_rotate_invitation.sql`
- `20261031000046_firm_review_and_building_roles.sql`
- `20261032000047_retire_account_type_authorization.sql`
- `20261033000048_resident_assignment_by_managers.sql`
- `20261034000049_linked_members_cannot_change_link.sql`
- `20261035000050_platform_admin_mfa_and_grant_log.sql`
- `20261036000051_invitation_email_status.sql`
- `20261037000052_platform_admin_reconciliation.sql`
- `20261038000053_platform_admin_status.sql`

## Notes

- `renamed+rewritten` rows change SQL, not only the file name. Examples: `staff_documents` adds `vendor_contracts`; `phase5` changes RLS predicates and `vector(1536)` to `vector(1024)`, which matches `lib/ai/embeddings.ts` (1024).
- `20261015_resident_audit_log` is renamed to `20261006000014`, which sorts before its neighbours. Replays in the working-tree order, but this is a risk for any environment that recorded the old version string.
- Deleted and restored-from-HEAD files are listed in docs/DELETED-FILES.md.
