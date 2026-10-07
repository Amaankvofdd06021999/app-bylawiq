# Phase 1 Quick Start: Multi-Role Session Implementation

**TL;DR:** All architecture built. 4 steps to production.

---

## The 4 Steps

### Step 1: Local Testing (2 hours)

```bash
# Apply latest migrations (including 20261008_*.sql)
supabase migration reset

# Run RLS tests (12 pgTAP tests)
supabase test db

# Run TypeScript tests (5 Vitest tests)
npm test features/auth/actions-role-switch.test.ts

# Verify guards work
npm test lib/auth/guards.test.ts  # Update: create this file if missing
```

**Expected Result:** All tests pass ✅

**Troubleshoot:**
- `RLS policy not found` → Migrations didn't apply; check `supabase status`
- `JWT claims missing` → Token hook not deployed yet (expected in Step 2)

---

### Step 2: Deploy Access Token Hook (4 hours)

**Option A: Postgres (Recommended)**

Migrations already include SQL implementation. It auto-deploys when you run migrations.

**Option B: Edge Function** (if you prefer TypeScript)

```bash
# Deploy TypeScript hook as Supabase Edge Function
supabase functions deploy custom-access-token-hook \
  --name custom_access_token_hook
```

**Either way:**
1. Go to Supabase Dashboard → Auth → Providers → Supabase
2. Scroll to "Custom Access Token Hook"
3. Select function: `public.custom_access_token_hook`
4. Click "Save"

**Test It:**
```bash
# Log in with test user
# Open DevTools → Application → auth-token
# Copy token → paste at jwt.io
# Verify payload contains:
#   "session_role": "building_manager"
#   "session_building_id": "uuid-here"
#   "accessible_building_ids": ["uuid1", "uuid2"]
```

**Expected Result:** JWT claims injected ✅

**Troubleshoot:**
- `Custom Access Token Hook not in Supabase menu` → Upgrade Supabase CLI
- `Claims are null` → Check if user has building_members rows

---

### Step 3: Integrate UI (6 hours)

#### 3a. Wire Role Switcher into Shell

**File:** `components/shell.tsx`

```typescript
import { RoleSwitcher } from './role-switcher';
import { getAvailableRoles, switchRoleAction } from '@/features/auth/actions-role-switch';
import { getSession } from '@/lib/auth/guards';

export async function Shell({ profile, buildings, ...props }) {
  const session = await getSession();  // NEW
  const { roles } = await getAvailableRoles();  // NEW

  return (
    <header>
      {/* existing nav */}
      
      {/* NEW: Add role switcher */}
      {roles.length > 1 && (
        <RoleSwitcher
          currentBuilding={buildings.find(b => b.id === session.buildingId) || buildings[0]}
          currentRole={session.role}
          allBuildings={buildings}
          onSwitch={switchRoleAction}
        />
      )}
    </header>
  );
}
```

#### 3b. Update Building Redirect Logic

**File:** `features/auth/actions-role-switch.ts` already has redirect; wire it up

When role switch happens, it redirects to `/b/<new-building-id>/ask`

Make sure this route exists and loads correctly.

#### 3c. Test End-to-End

```bash
# 1. Create test user with 2 building memberships
# 2. Log in
# 3. See role switcher dropdown
# 4. Click dropdown → switch role
# 5. Should redirect to new building
# 6. Verify RLS: try to access old building's docs → should fail
```

**Expected Result:** Role switcher works, switching rebuilds JWT, RLS enforces scope ✅

**Troubleshoot:**
- `Role switcher not showing` → Check if user has 2+ memberships
- `Redirect infinite loops` → Check redirect URL + route handler
- `RLS blocks access after switch` → This is expected! Session claims changed, old building not in scope

---

### Step 4: Staging Testing (8 hours)

#### 4a. Deploy to Staging Supabase

```bash
supabase link --project-ref <staging-project-id>
supabase db push  # Pushes 20261008_*.sql to staging
```

#### 4b. Run Full Test Suite

```bash
# Create test users in staging database
# Multi-role: strata manager + resident on 2 buildings
# Single-role: building manager on 1 building

# Test flows:
# 1. Login as multi-role user
# 2. See role switcher
# 3. Switch roles (building manager → resident)
# 4. Verify access changes (resident can see owner docs, building manager sees all)
# 5. Switch back
# 6. Verify metrics match (50 role switches)

# Load test
ab -n 100 -c 50 https://staging.bylawiq.test/api/auth/switch-role
```

#### 4c. Security Review

```bash
# Checklist:
# ✅ Can't escalate role (try to claim portfolio_manager when not)
# ✅ Can't access other org's buildings
# ✅ Old JWT with null session_role still works (grace period)
# ✅ Revoked membership blocks access
# ✅ Expired membership blocks access
# ✅ Audit log captures all role switches
```

**Expected Result:** All tests pass, no security gaps ✅

---

## Files to Know

### Architecture (Read to Understand)

- `lib/auth/session.ts` — What is a session?
- `docs/MULTI-ROLE-GUIDE.md` — How does it work?
- `supabase/migrations/20261008_session_role_enforcement.sql` — RLS logic

### Deployment (Follow to Deploy)

- `supabase/migrations/20261008_access_token_hook.sql` — Token hook (runs automatically)
- Supabase Dashboard → Auth → Custom Access Token Hook (manual config)
- `components/shell.tsx` (TODO: integrate role switcher)

### Testing (Run to Validate)

- `supabase/tests/rls_session_role.test.sql` — RLS tests (run `supabase test db`)
- `features/auth/actions-role-switch.test.ts` — Integration tests (run `npm test`)

### Monitoring (Watch in Production)

- Audit log: `SELECT * FROM audit_log WHERE action = 'auth.switch_role'`
- RLS denials: `SELECT * FROM audit_log WHERE action LIKE 'authorize%'`
- Token hook latency: Monitor Supabase metrics dashboard

---

## Common Issues & Fixes

| Issue | Fix |
|-------|-----|
| `RLS policy: session_role is null` | Old token without claims. Wait 1-2 weeks or force re-login |
| `authorize_session always returns false` | User doesn't have the expected role on that building. Check building_members |
| `Role switcher not visible` | User only has 1 role. Add another membership to test |
| `After role switch, still seeing old building data` | Redirect didn't work. Check `switchRoleAction` redirect URL |
| `JWT missing session claims` | Token hook not deployed. Go to Supabase dashboard → Auth → Custom Access Token Hook |
| `Switching roles is slow (>500ms)` | Token hook query slow. Add index: `CREATE INDEX membership_user_idx ON building_members(user_id, status)` |

---

## Rollback Plan

If issues found in production:

```sql
-- Disable session role enforcement (revert to old behavior)
-- Keep the migration in place (it's reversible)

-- Option 1: Disable policies temporarily
ALTER POLICY documents_read_session ON documents RENAME TO documents_read_session_disabled;
CREATE POLICY documents_read ON documents
  FOR SELECT TO authenticated
  USING(authorize('vault.read', building_id));

-- Option 2: Full rollback to migration 20261001
supabase db push --version 20261001

-- Option 3: Just allow null session_role indefinitely
-- (Don't remove grace period; already built in)
```

**Recommended:** Keep session role in place; it's backward compatible. Just disable any new code that requires it.

---

## Success Criteria (Checklist)

**Local Testing**
- [ ] `supabase test db` passes (12 tests)
- [ ] `npm test` passes (5 tests)
- [ ] Manual: JWT has session_role claim

**Staging Testing**
- [ ] Role switcher appears for multi-role users
- [ ] Switching role redirects to new building
- [ ] RLS blocks access to old building
- [ ] Audit log captures switch
- [ ] 50 concurrent switches < 1s latency (P95)

**Production**
- [ ] All staging tests still pass
- [ ] Monitoring alerts configured
- [ ] Runbook written (incident: stuck role)
- [ ] Customer comms sent (feature transparent)
- [ ] 0 RLS denials in first 24h (indicates no issues)

---

## Time Budget

| Step | Time | People |
|------|------|--------|
| 1. Local testing | 2h | 1 dev |
| 2. Deploy token hook | 4h | 1 dev + Supabase admin |
| 3. Integrate UI | 6h | 1 frontend dev |
| 4. Staging testing | 8h | 1-2 devs |
| **Total** | **20h** | **1-2 devs** |

**Timeline:** 1 week (part-time) to 3 days (full-time)

---

## Who Should Do What

**Architect/Lead:**
- Review architecture (session types, RLS logic)
- Approve token hook approach (Postgres vs. Edge Function)
- Sign off on security review

**Backend Dev:**
- Run migrations locally (`supabase migration reset`)
- Deploy token hook (steps 2a/2b)
- Verify RLS tests pass (`supabase test db`)

**Frontend Dev:**
- Integrate role switcher into Shell (step 3a)
- Test UI end-to-end (step 3c)
- Update onboarding copy (if needed)

**DevOps/Infra:**
- Deploy to staging Supabase (step 4a)
- Configure monitoring/alerts
- Deploy to production (when ready)

**QA/Test:**
- Run full test suite (step 4b)
- Security review (step 4c)
- Load testing

---

## Next Phase

Once all 4 steps are complete and stable in production:

→ **Phase 2: Dashboard Backend** (2-3 weeks)
- Firm owner dashboard
- Strata manager dashboard
- Building manager dashboard

See `COMPREHENSIVE IMPLEMENTATION PLAN` for Phase 2 details.

---

## Reference

- Full implementation details: `IMPLEMENTATION-SUMMARY.md`
- Deployment readiness: `PHASE-1-IMPLEMENTATION-STATUS.md`
- Developer guide: `docs/MULTI-ROLE-GUIDE.md`
- Architecture docs: `docs/03-RBAC-SECURITY.md` (will be updated)

---

## TL;DR (For Impatient Readers)

1. **Migrations:** Automatic when deployed
2. **Token hook:** 5-min config in Supabase dashboard
3. **UI:** Copy `<RoleSwitcher />` into Shell (1h)
4. **Test:** Run migrations locally, switch roles, verify RLS works (2h)
5. **Done:** Ship it! 🚀

Total: ~1 week from now.
