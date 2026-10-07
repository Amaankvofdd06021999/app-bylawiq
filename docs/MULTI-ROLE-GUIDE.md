# Multi-Role Session Guide

**Date:** 2026-10-08  
**Status:** Phase 1 (Session Model) — Foundation implemented

---

## Overview

BylawIQ supports users who hold multiple roles across different buildings and organizations. This guide explains how multi-role support works, how to implement features that respect it, and how to test it.

### Quick Example

**Alice's Roles:**
- **Portfolio Manager** at Firm A (manages 5 linked buildings)
- **Building Manager** at Coastal Heights Strata (personal building she manages)
- **Council Member** at Harbor View Strata (small building she sits on council for)

**Today, Alice can:**
1. Log in → session defaults to her highest-permission role (portfolio manager on building 1)
2. Click role dropdown → switch to "Council Member (Harbor View)"
3. Session now has `session_role='council_member'`, `session_building_id=harbor-view-id`
4. RLS policies enforce this: she can only see council-visible data at Harbor View
5. She's also her council role — can't access firm knowledge, can't see portfolio metrics
6. Click role dropdown again → switch back to portfolio manager

---

## Architecture

### Three Orthogonal Concepts

1. **Account Type** (`profiles.account_type`)
   - What does this account do primarily?
   - Values: `admin` (firm owner), `multi_building` (portfolio), `single_building` (focused)
   - Set once at signup; rarely changes
   - Describes the account style, not the current role

2. **Membership** (`building_members` + `org_members` rows)
   - What roles does this user hold?
   - Example: Alice has 3 `building_members` rows (portfolio_manager, building_manager, council_member)
   - One row per role per building/org
   - Persistent, managed via invitations

3. **Session Role** (JWT claim: `session_role` + `session_building_id`)
   - What role is the user acting as RIGHT NOW?
   - Set when user logs in or switches roles
   - Validated by RLS policies on every query
   - Stateless (stored in JWT, not a database table)

### Data Flow

```
┌─────────────────────────────────────────────────────┐
│ User logs in                                        │
│ (alice@company.com, password)                       │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────┐
│ Supabase Auth validates credentials                │
│ Creates auth session                                │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────┐
│ Custom Access Token Hook (lib/auth/access-token-hook.ts) │
│ 1. Queries building_members for this user          │
│ 2. Picks preferred building (first/highest perm)   │
│ 3. Returns JWT claims:                             │
│    - session_role: 'portfolio_manager'             │
│    - session_building_id: 'building-1-uuid'        │
│    - accessible_building_ids: ['uuid-1', 'uuid-2'] │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────┐
│ JWT issued with session claims in access token    │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────┐
│ App loads, Shell component renders                 │
│ Shows role switcher (if 2+ roles)                  │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────┐
│ User clicks role dropdown, selects "Council..."   │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────┐
│ switchRoleAction() called (features/auth/...)     │
│ 1. Verifies membership exists                      │
│ 2. Calls auth.refreshSession()                     │
│ 3. Triggers token hook again (new preferred role) │
│ 4. JWT regenerated with new session claims        │
└────────────────────┬────────────────────────────────┘
                     │
                     ↓
┌─────────────────────────────────────────────────────┐
│ Redirect to new building (/b/<new-id>/ask)        │
│ RLS policies now use new session_role             │
│ User sees only council-visible data               │
└─────────────────────────────────────────────────────┘
```

---

## For Developers

### Checking User's Roles

```typescript
// In a server action or route handler

import { requireUser } from '@/lib/auth/guards';

export async function myAction() {
  const user = await requireUser();
  
  // Get current session
  const session = parseSessionClaims(user.claims);
  console.log(session.role);           // 'building_manager'
  console.log(session.buildingId);     // 'uuid...'
  console.log(session.accessibleBuildingIds); // ['uuid1', 'uuid2', ...]
  
  // Verify permission on current building
  await requirePermissionAsRole(user, 'vault.read', session.buildingId, session.role);
  // Throws if session role doesn't match membership or permission denied
}
```

### Enforcing Role on Actions

```typescript
// ✅ New pattern: Use requirePermissionAsRole
// Checks permission + validates session role matches membership

export async function uploadDocumentAction(raw: unknown) {
  const user = await requireUser();
  const input = InputSchema.parse(raw);
  
  // Ensures user is actually a building_manager (not impersonating)
  await requirePermissionAsRole(user, 'vault.upload', input.buildingId, 'building_manager');
  
  // Safe: user is definitely a building_manager on this building
  // RLS will also enforce it
}
```

### RLS Policies: Validate Session

The migration `20261008_session_role_enforcement.sql` updates RLS policies to validate `session_role`:

```sql
-- Example updated policy
CREATE POLICY documents_read_session ON public.documents
  FOR SELECT TO authenticated
  USING(
    authorize('vault.read', building_id)
    AND session_role() = (SELECT role FROM my_building_role(building_id))
  );
```

**What this does:**
- Allows read only if user has `vault.read` permission
- AND the session_role claim matches their actual membership role
- Prevents accidental multi-role queries

### Testing Multi-Role Behavior

```sql
-- In pgTAP tests (supabase/tests/rls_session_role.test.sql)

-- Set JWT claims for Alice as building_manager on building-1
select set_config('request.jwt.claims', json_build_object(
  'sub', 'alice-uuid'::text,
  'session_role', 'building_manager',
  'session_building_id', 'building-1-uuid'::text,
  'accessible_building_ids', '["building-1-uuid", "building-2-uuid"]'::jsonb
)::text, true);

-- Now run queries as if Alice is acting as building_manager
select count(*) from documents where building_id = 'building-1-uuid'::uuid;
-- Returns count (Alice is building_manager here, has vault.read)

-- Switch Alice to council_member on building-2
select set_config('request.jwt.claims', json_build_object(
  'sub', 'alice-uuid'::text,
  'session_role', 'council_member',
  'session_building_id', 'building-2-uuid'::text,
  'accessible_building_ids', '["building-1-uuid", "building-2-uuid"]'::jsonb
)::text, true);

-- Now she only sees council-visible data
select count(*) from documents where building_id = 'building-2-uuid'::uuid and owner_visible = true;
```

---

## For Product Managers / Users

### What's New

1. **Role Switcher:** Users with 2+ roles see a dropdown in the header
2. **No Account Switching:** No need to log out and log back in as a different person
3. **Session Safety:** Each role session is isolated — can't accidentally send resident data to firm staff

### User Experience

**Scenario: Alice is portfolio manager + resident**

```
Logged in as Portfolio Manager (Coastal Heights Firm)
  - See all 5 firm buildings
  - Can approve drafts
  - Can access firm knowledge

Click role dropdown → "Resident (Harbor View Strata)"

Now logged in as Resident (Harbor View Strata)
  - See only Harbor View
  - Can ask about bylaws (with credits)
  - Cannot approve anything or see firm data
  - No access to firm knowledge base

Click role dropdown → back to Portfolio Manager
```

---

## Deployment Checklist

### Phase 0: Architecture (Done)
- ✅ Session types defined (`lib/auth/session.ts`)
- ✅ Access token hook designed (`lib/auth/access-token-hook.ts`)
- ✅ RLS migration written (`20261008_session_role_enforcement.sql`)
- ✅ pgTAP tests written (`rls_session_role.test.sql`)
- ✅ Guards updated (`lib/auth/guards.ts`)

### Phase 1: Implementation (In Progress)
- ⏳ Supabase custom access token hook deployed
- ⏳ Role switcher UI integrated into Shell
- ⏳ Switch role action wired up
- ⏳ Multi-role onboarding flow updated
- ⏳ Tests run and passing

### Pre-Production
- ⏳ Load test: 50 concurrent role switches
- ⏳ Security review: Session validation
- ⏳ Pen test: Prompt injection + role escalation

---

## Edge Cases & Known Limitations

### Grace Period: Old Sessions

For the first few days after deployment, some users may have old tokens without session_role claims. RLS policies have a fallback:

```sql
public.session_role() is null  -- Grace period
or public.session_role() = (select role from my_building_role(building_id))
```

This means old tokens are allowed through, but new tokens (after refresh) must have valid session claims.

**When to remove grace period:** After all users have refreshed their tokens (usually 1-2 weeks).

### Concurrent Sessions

**Does NOT support:** Multiple sessions at once (e.g., one tab as manager, one as resident)

Each time you switch roles, the old JWT is invalidated. This is intentional for security.

**Why:** Multi-tab sessions could leak data if one tab is compromised.

**Workaround:** Users can open the app in an incognito window with a different account if they need true concurrent sessions.

### Session Switching Redirect

When switching roles, the user is redirected to `/b/<new-building-id>/ask`. If you want to preserve the current page state, you'll need to enhance the redirect logic (store state in localStorage, pass as URL param, etc.).

---

## FAQ

### Q: Can a user change their account_type?

**A:** Not yet. account_type is set at signup and describes the account style. It's not used for authorization (session_role is), so it's safe to keep static. If needed, we can add an admin-only flow to change it later.

### Q: What if a user's role is revoked mid-session?

**A:** Their JWT remains valid until expiry (typically 1 hour). But RLS will deny access because the membership is gone. The next page load will try to refresh the token, fail, and redirect to login.

**Better flow (future):** Revocation API that invalidates all tokens for a user immediately.

### Q: Can I use session_role in a Server Action?

**A:** Yes! Use `getSession()` or parse from user.claims:

```typescript
const session = parseSessionClaims(user.claims);
const role = session.role;
```

### Q: How do I prevent a user from accessing a role they don't have?

**A:** Always use `requirePermissionAsRole()` (not `requirePermission()`):

```typescript
// ✅ Good: Checks session_role matches membership
await requirePermissionAsRole(user, permission, buildingId, expectedRole);

// ❌ Bad: Only checks permission, not role
await requirePermission(user, permission, buildingId);
```

### Q: What happens to multi-role users who upgrade plans?

**A:** Account_type can stay the same; billing is per-org. If Alice is portfolio manager at Firm A and resident at building in Firm B, she has two separate billing relationships.

---

## Next: Phase 2 - Dashboards

Once multi-role sessions are validated in production, we move to Phase 2:
- Firm Owner Dashboard (aggregated staff + buildings + metrics)
- Strata Manager Dashboard (portfolio home)
- Building Manager Dashboard (single-building home)

These dashboards will respect multi-role scope (a firm owner sees only their firm, not other orgs).

---

## References

- `lib/auth/session.ts` — Type definitions
- `lib/auth/access-token-hook.ts` — JWT token generation logic
- `lib/auth/guards.ts` — Server-side permission guards
- `supabase/migrations/20261008_session_role_enforcement.sql` — RLS policy updates
- `supabase/tests/rls_session_role.test.sql` — Isolation tests
- `components/role-switcher.tsx` — UI component
- `features/auth/actions-role-switch.ts` — Server actions for switching roles
- `docs/03-RBAC-SECURITY.md` — Master auth documentation (update needed)
