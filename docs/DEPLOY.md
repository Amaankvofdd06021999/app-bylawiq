# 🚀 Deployment Runbook — BylawIQ Phase 0-5

**Status:** Production Ready  
**Last Updated:** 2026-10-07  
**Author:** Claude Haiku (AI Code Agent)

---

## DEPLOYMENT CHECKLIST

### Pre-Deployment (48 hours before)

- [ ] **Security audit passed** (see docs/SECURITY-AUDIT.md)
  - [ ] RLS isolation tests all pass
  - [ ] No cross-building data leakage
  - [ ] Secrets not in source code
  - [ ] Rate limiting configured

- [ ] **Load tests completed** (see scripts/load-test.ts)
  - [ ] P95 dashboard load < 2s
  - [ ] P95 chat completion < 10s
  - [ ] P95 wallet deduction < 500ms
  - [ ] No errors over 4-hour test window

- [ ] **Accessibility audit passed** (see scripts/a11y-test.ts)
  - [ ] Zero critical/serious axe violations
  - [ ] Keyboard navigation works on all pages
  - [ ] Focus indicators visible
  - [ ] Screen reader compatible (manual test)

- [ ] **Legal sign-offs collected**
  - [ ] Data privacy (PIPA procedures)
  - [ ] Resident AI terms & disclaimers
  - [ ] Wallet deduction consent flow
  - [ ] Billing/payment terms

- [ ] **Customer communication ready**
  - [ ] Beta announcement drafted
  - [ ] Feature overview documented
  - [ ] Support docs written
  - [ ] FAQ created

- [ ] **Monitoring configured**
  - [ ] Sentry/error tracking enabled
  - [ ] Datadog/observability dashboard created
  - [ ] Alerts configured (error spike, latency spike, RLS failures)
  - [ ] PagerDuty escalation policy set

- [ ] **Incident response plan reviewed**
  - [ ] On-call rotation established
  - [ ] Runbooks for common issues (see docs/INCIDENTS.md)
  - [ ] Customer communication template ready
  - [ ] Legal contact list current

### Staging Deployment (24 hours before production)

#### 1. Database Setup

```bash
# Deploy all migrations to staging
npx supabase db push

# Verify migrations applied
npx supabase db status

# Expected output:
# Pending migrations: 0
# Remote schema is up-to-date
```

**Migrations to apply (in order):**
- `20261008_access_token_hook.sql` — Session claims
- `20261008_session_role_enforcement.sql` — RLS updates
- `20261009_resident_wallets.sql` — Resident wallet schema
- `20261010_firm_knowledge.sql` — Firm knowledge base
- `20261011_cost_controls.sql` — Cost monitoring

#### 2. Environment Variables Setup

```bash
# Create .env.staging with production-like values
cp .env.example .env.staging

# Edit .env.staging with staging values:
NEXT_PUBLIC_SUPABASE_URL=https://staging-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=staging-key-***
STRIPE_SECRET_KEY=sk_test_*** (use test keys)
STRIPE_WEBHOOK_SECRET=whsec_test_***
ANTHROPIC_API_KEY=sk-...

# Verify no secrets in git
git diff --name-only | xargs git show HEAD:{} | grep -E "SECRET|PRIVATE|API_KEY"
# Expected: no output (no secrets exposed)
```

#### 3. Run Tests

```bash
# TypeScript compilation
npm run typecheck
# Expected: No errors

# Unit & integration tests
npm test
# Expected: All tests pass (5+ Vitest + 12+ pgTAP)

# Accessibility tests
npx playwright test scripts/a11y-test.ts
# Expected: All tests pass, zero critical violations

# Load test (light version)
k6 run scripts/load-test.ts \
  --vus 5 \
  --duration 30s \
  --ramp-up 10
# Expected: P95 latencies within thresholds
```

#### 4. Deploy to Staging

```bash
# Deploy to Vercel staging environment
vercel deploy --prod --env staging

# Expected output:
# ✓ Deployment complete
# Preview URL: https://bylawiq-staging.vercel.app
```

#### 5. Smoke Tests on Staging

```bash
# Login as test user
curl -X POST https://bylawiq-staging.vercel.app/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"***"}'

# Verify JWT has session claims
# Expected: token contains session_role, session_building_id

# Test multi-role switch
curl -X POST https://bylawiq-staging.vercel.app/api/auth/switch-role \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"buildingId":"***","role":"owner_resident"}'

# Expected: New token returned with updated session_role

# Test dashboard load
curl https://bylawiq-staging.vercel.app/api/dashboards/firm-owner \
  -H "Authorization: Bearer $TOKEN"

# Expected: 200 response, full dashboard data (<2s)

# Test chat
curl -X POST https://bylawiq-staging.vercel.app/api/chat \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"id":"***","message":{"id":"***","role":"user","parts":[{"type":"text","text":"Tell me about AGM requirements"}]}}'

# Expected: 200 response, streaming message (event stream)

# Test wallet
curl -X POST https://bylawiq-staging.vercel.app/api/wallet/deduct \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"userId":"***","buildingId":"***","amount":10,"reason":"ask_question"}'

# Expected: 200, new_balance returned

# Test Stripe webhook
curl -X POST https://bylawiq-staging.vercel.app/api/webhooks/stripe \
  -H "stripe-signature: $SIGNATURE" \
  -d '{...stripe-event-payload...}'

# Expected: 200, webhook processed
```

#### 6. Cross-Building Isolation Test

```bash
# Create two test users (different buildings/orgs)
# User A: Firm A, Building 1
# User B: Firm B, Building 2

# As User A, attempt to access Building 2
curl "https://bylawiq-staging.vercel.app/api/documents?buildingId=BUILDING-2-ID" \
  -H "Authorization: Bearer $USER_A_TOKEN"

# Expected: 200 but 0 rows returned (RLS blocks it)
# OR: 403 Forbidden (if query explicitly rejected)

# As User B, attempt to read Firm A's staff
curl "https://bylawiq-staging.vercel.app/api/org/FIRM-A-ID/staff" \
  -H "Authorization: Bearer $USER_B_TOKEN"

# Expected: 403 Forbidden (not a member of Firm A)
```

#### 7. Enable Staging Monitoring

```bash
# Connect staging to Sentry
export SENTRY_AUTH_TOKEN=***
vercel env add SENTRY_DSN
# Choose: staging environment

# Verify error tracking
# Navigate to production-like scenario
# Trigger an error
# Confirm it appears in Sentry within 30s
```

#### 8. Staged Rollout Plan

For production, use gradual rollout:

```
Phase 1: Internal (2 hours)
  - 1 internal test user from each role
  - Verify all flows work
  - Check error logs

Phase 2: Beta (8 hours)
  - 5% of production traffic
  - Monitor error rate, latency
  - Check wallet deductions working

Phase 3: Broad (Full deployment)
  - 100% traffic
  - Monitor dashboard metrics
  - Watch for RLS audit log anomalies
```

---

## PRODUCTION DEPLOYMENT

### Step 1: Pre-Flight Checks (1 hour before)

```bash
# Verify all environment variables set in production
vercel env list --prod

# Required variables:
# ✓ NEXT_PUBLIC_SUPABASE_URL
# ✓ SUPABASE_SERVICE_ROLE_KEY
# ✓ STRIPE_SECRET_KEY
# ✓ STRIPE_WEBHOOK_SECRET
# ✓ ANTHROPIC_API_KEY

# Run final typecheck
npm run typecheck
# Expected: No errors

# Verify no uncommitted changes
git status
# Expected: clean working directory

# Check git log (last 3 commits should include security reviews)
git log --oneline -3
```

### Step 2: Database Migration (Production)

```bash
# IMPORTANT: Backup database before migrations
# (Supabase does this automatically, but verify)

# Connect to production Supabase
export SUPABASE_DB_PASSWORD=*** # from Supabase dashboard

# Apply migrations
npx supabase db push --db-url $PRODUCTION_DB_URL

# Verify migrations applied
npx supabase db status --db-url $PRODUCTION_DB_URL
# Expected: Pending migrations: 0

# Quick sanity check: tables exist
psql $PRODUCTION_DB_URL -c "SELECT COUNT(*) FROM resident_wallets;"
# Expected: 0 rows (new table)
```

### Step 3: Deploy Application (Vercel)

```bash
# Create production deployment
vercel deploy --prod

# Expected output:
# ✓ Production deployment complete
# Production URL: https://bylawiq.app

# Verify deployment successful
curl https://bylawiq.app/api/health
# Expected: 200 {"status":"ok"}
```

### Step 4: Enable Features (Gradual Rollout)

#### Phase 1: Internal (1-2 hours)

```bash
# Feature flag: Enable for internal team only
# Set environment variable:
FEATURE_MULTI_ROLE=internal_only
FEATURE_RESIDENT_WALLET=internal_only

# Test as internal user
# Expected: All features work
# Expected in Sentry: 0 errors
```

#### Phase 2: Beta (8-12 hours)

```bash
# Expand to 5-10 beta customers
FEATURE_MULTI_ROLE=beta
FEATURE_RESIDENT_WALLET=beta

# Monitor metrics:
vercel analytics --prod
# Look for: latency increase, error spikes

# Monitor logs:
# Check Sentry for: new errors, RLS violations
# Check Datadog for: database load, API latency

# Expected: Stable metrics, no errors
```

#### Phase 3: Full Launch (Broad availability)

```bash
# Enable for all users
FEATURE_MULTI_ROLE=enabled
FEATURE_RESIDENT_WALLET=enabled

# Increase monitoring frequency
# Check dashboards every 15 minutes for first hour
# Then every hour for first day

# Watch for:
# - Error rate spike (> 0.1%)
# - Latency increase (P95 > 2x baseline)
# - RLS audit log anomalies
# - Stripe webhook failures

if any_metrics_abnormal:
  # Rollback
  vercel rollback
  # Investigate
  # Fix
  # Redeploy
```

---

## POST-DEPLOYMENT (First 24 hours)

### Monitoring Dashboard

**Create Datadog/Sentry dashboard showing:**

```
Real-Time Metrics (Every 5 minutes):
- Error rate (should be <0.1%)
- API latency P50, P95, P99
- Database connection pool usage
- Stripe webhook delivery rate (should be >99.9%)
- Chat completion time (should be <10s P95)
- Dashboard load time (should be <2s P95)

Hourly Checks (8 times):
- Unique active users by role
- Questions asked (count)
- Wallet deductions (count)
- RLS audit log entries (any denials?)
- Staging vs Production latency diff

Daily Checks:
- Total revenue (credits purchased)
- Resident retention (repeat askers)
- Cost per question
- Firm knowledge usage
```

### Common Issues & Fixes

#### Error: "Row Level Security denies access"

```
Cause: RLS policy too restrictive
Fix:
1. Check audit_log for which table/policy
2. Review policy in pgAdmin: SELECT * FROM pg_policies WHERE schemaname='public'
3. Verify user has actual membership in building_members
4. Check JWT claims: session_role, session_building_id
5. If user membership changed recently, might be cache delay
```

#### Error: "Stripe webhook signature invalid"

```
Cause: Webhook secret mismatch
Fix:
1. Verify STRIPE_WEBHOOK_SECRET in production env matches Stripe dashboard
2. In Stripe dashboard: Settings → Webhook endpoints
3. Copy secret from "Signing secret" (not the API key)
4. Update in Vercel: vercel env add STRIPE_WEBHOOK_SECRET
5. Redeploy: vercel deploy --prod
```

#### Latency Spike (Chat >10s)

```
Cause: LLM slow, retrieval slow, or database slow
Fix:
1. Check Anthropic status page (api.anthropic.com)
2. Check database connection pool: SELECT count(*) FROM pg_stat_activity;
3. If connections maxed: increase max_connections in Supabase
4. If retrieval slow: check hybrid_search_building timing
5. If LLM slow: check context window size, try shorter prompts
```

#### Wallet Deduction Fails

```
Cause: RPC function error, insufficient balance, wallet not found
Fix:
1. Check logs: logger.error('wallet_deduction_failed', {...})
2. Verify resident has active wallet: SELECT * FROM resident_wallets WHERE user_id='...'
3. If missing: wallet auto-creation trigger didn't fire
   - Fix: Run: UPDATE building_members SET status='active' WHERE id='...'
4. If balance negative: deduction succeeded, display as-is
5. If RPC error: Check function: SELECT public.deduct_wallet_credits(...)
```

#### Role Switch Fails

```
Cause: User not member of target building, or membership revoked
Fix:
1. Check building_members: SELECT * FROM building_members WHERE user_id='...' AND status='active'
2. If missing: User needs to accept invite again
3. If role wrong: Switch role to correct one
4. Clear token cache (browser): Delete cookies/localStorage
```

---

## ROLLBACK PROCEDURE

If production is broken:

```bash
# Option 1: Revert to previous deployment (Vercel auto-rollback)
vercel rollback --prod
# Expected: Within 30 seconds, previous version deployed

# Option 2: Manual rollback (if needed)
git log --oneline origin/main | head -3
# Find commit before this deployment
git checkout $PREVIOUS_COMMIT
vercel deploy --prod

# Option 3: Database rollback (if migration broke data)
# Contact Supabase support; they have automated backups
# Or restore from manual backup: pg_restore -d postgres < backup.sql
```

---

## PRODUCTION OPERATIONS

### Daily Tasks

```bash
# Every morning (after deployment):
1. Check Sentry error count (should be <10)
2. Check Datadog dashboard (should be green)
3. Review Stripe webhook delivery rate (should be 99.9%+)
4. Sample 3-5 chats in production (ask questions, verify answers make sense)
5. Spot-check 2-3 wallet transactions
```

### Weekly Tasks

```bash
# Every Monday:
1. Review week's error patterns (common issues?)
2. Check cost trends (spending within budget?)
3. Review resident feedback (any complaints?)
4. Run load test against production snapshot
5. Rotate on-call schedule
```

### Monthly Tasks

```bash
# Start of month:
1. Billing reconciliation (Stripe vs recorded transactions)
2. Security audit review (any anomalies in audit_log?)
3. Performance analysis (trends, capacity planning)
4. Customer communication (feature releases, incidents summary)
5. Update runbooks based on incidents
```

---

## INCIDENT RESPONSE

See `docs/INCIDENTS.md` for full procedures. Quick reference:

```
SEV 1 (Critical): Data leak, down, wrong data shown
  - Immediate: Notify CTO, legal, customer
  - Within 15 min: Root cause analysis start
  - Within 1 hour: Fix + test
  - Within 2 hours: Deploy
  - Post-incident: 24-hour review

SEV 2 (High): Degraded, slow, some users affected
  - Immediate: Investigate
  - Within 1 hour: Fix or workaround
  - Update status page

SEV 3 (Medium): Bug, non-customer-facing issue
  - Next business day: Fix
  - Document in runbook

SEV 4 (Low): Minor UX issue, cosmetic
  - Normal sprint scheduling
```

---

## METRICS TO TRACK

### Technical Metrics

- **Uptime:** Target 99.9% (43 minutes downtime/month)
- **Latency:** P95 chat <10s, P95 dashboard <2s
- **Error Rate:** <0.1% (1 error per 1000 requests)
- **RLS Denials:** Should be 0 (no accidents)

### Business Metrics

- **Active Residents:** Weekly active users buying credits
- **Avg Revenue per Resident:** Total revenue / active residents
- **Churn:** % of residents who stop asking questions
- **Conversion:** % of trial residents who purchase credits

### Compliance Metrics

- **Audit Log Completeness:** 100% of actions logged
- **Backup Success Rate:** 100% (verified restores weekly)
- **PIPA Data Requests:** Response time <30 days
- **Security Incidents:** 0 data leaks, 0 unauthorized access

---

## CONTACT LIST

```
On-Call Engineer: [name] [phone]
Engineering Lead: [name] [phone]
Customer Success: [name] [phone]
Legal: [name] [phone]
Finance: [name] [phone]

Escalation Path:
  Issue detected → On-Call → Eng Lead → CTO
  Legal question → Legal team
  Data breach → CTO + Legal + Customers
```

---

## SIGN-OFF

- [ ] **DevOps/Deploy Owner:** _________________ Date: _______
- [ ] **Engineering Lead:** _________________ Date: _______
- [ ] **Product Lead:** _________________ Date: _______
- [ ] **Legal:** _________________ Date: _______

---

## DEPLOYMENT HISTORY

| Date | Version | Status | Notes |
|------|---------|--------|-------|
| 2026-10-07 | 1.0.0 | Staged | Phases 0-4 ready, Phase 5 in progress |
| | | | |

---

**Maintenance:** Update this runbook after every production deployment or incident.
