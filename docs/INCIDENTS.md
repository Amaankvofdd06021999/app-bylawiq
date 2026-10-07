# 🚨 Incident Response Procedures — BylawIQ

**Version:** 1.0  
**Last Updated:** 2026-10-07  
**Purpose:** Standardized response to production incidents to minimize impact and ensure compliance

---

## INCIDENT SEVERITY LEVELS

| Level | Name | Impact | Response Time | Escalation |
|-------|------|--------|---|---|
| **SEV 1** | Critical | Complete outage, data leak, wrong data shown | 15 minutes | Immediate (CTO + Legal) |
| **SEV 2** | High | Degraded service, slow responses, some users blocked | 1 hour | Eng Lead + Customer Success |
| **SEV 3** | Medium | Bug affecting features, workaround exists | Next business day | Eng team |
| **SEV 4** | Low | Cosmetic issue, minor UX bug | Normal sprint | Backlog |

---

## SEV 1: CRITICAL INCIDENTS

### Indicators
- ✅ Complete outage (API returns 500s for >5 minutes)
- ✅ Data leak (user from Building A sees Building B data)
- ✅ Wrong data shown (LLM cites bylaw from wrong building)
- ✅ Mass wallet deductions (all residents charged unexpectedly)
- ✅ Security breach (unauthorized access detected)

### Response Checklist

#### Minute 1: Alert & Activate

```
[ ] 1. On-call engineer receives alert (PagerDuty, Sentry)
[ ] 2. Acknowledge incident in Slack #incidents channel
[ ] 3. Create incident ticket in Linear
[ ] 4. @mention engineering lead, CTO, legal
[ ] 5. Set status page to "Investigating"
```

**Template Slack message:**
```
🚨 SEV 1 INCIDENT
Title: [brief description]
Affected: [# users, which roles]
Ticket: [Linear link]
On-call: @person
Status: Investigating
```

#### Minute 5: Triage & Diagnosis

```
[ ] 1. Check uptime dashboard (Vercel, Datadog)
[ ] 2. Check error logs (Sentry) — what's happening?
[ ] 3. Check database (Supabase) — is it responding?
[ ] 4. Check Stripe (payment processing) — any webhook failures?
[ ] 5. Narrow down: App issue? DB issue? External API issue?
```

**Diagnostic questions:**
- Is the entire service down, or specific features?
- How many users affected (1%, 10%, 100%)?
- When did it start?
- What was the last deployment?
- Any recent changes to RLS policies or migrations?

#### Minute 15: Decide (Fix or Rollback)

**Option A: Quick Fix**
- If: Bug in recent code that you can fix in <15 min
- Do: Fix, test, deploy
- Track: Git commit, PR #, time to fix

**Option B: Rollback**
- If: Major issue and fix will take >15 min
- Do: `vercel rollback --prod`
- Result: Reverts to previous deployment
- Time: ~30 seconds to deploy

**Option C: Database Rollback**
- If: Migration broke the schema
- Do: Contact Supabase support (they have point-in-time recovery)
- Time: 10-30 minutes
- Document: Why rollback was needed

```bash
# Execute rollback
vercel rollback --prod

# Verify previous version is live
curl https://bylawiq.app/api/health
# Should return 200

# Notify team in Slack
```

#### Minute 30: Mitigation & Communication

```
[ ] 1. Confirm issue is resolved (test in browser)
[ ] 2. Update incident ticket with root cause
[ ] 3. Update status page with resolution
[ ] 4. Notify customers (if affected by data)
[ ] 5. If data leak: notify legal + affected customers per PIPA
```

**Customer notification (if needed):**
```
Subject: Security Incident Notification - BylawIQ

We detected an incident on [date] at [time] UTC that may have exposed [brief description].

What happened: [non-technical summary]
Affected users: [names/emails if small, else 'X residents in Y buildings']
Duration: [minutes/hours]
Resolution: [what we did]
Next steps: [what we're doing to prevent this]

We apologize and are grateful for your patience.
```

#### 1 hour: Root Cause Analysis

```
[ ] 1. Review code changes since last good deployment
[ ] 2. Examine audit logs for unusual activity (RLS denials?)
[ ] 3. Check database query logs (slow queries? locks?)
[ ] 4. Review Stripe webhook logs (any failures?)
[ ] 5. Document findings in incident ticket
```

**Questions to answer:**
- How did this reach production?
- What was missed in testing?
- Could this have been caught earlier?
- Is this a known class of bugs?

#### 4 hours: Post-Incident Review

```
[ ] 1. Create incident summary in Linear
[ ] 2. Schedule post-mortem (within 24 hours)
[ ] 3. Identify action items (fix, monitoring, runbook)
[ ] 4. Assign owners for each action item
[ ] 5. Update docs/runbooks based on learnings
```

**Post-mortem attendees:**
- On-call engineer (who responded)
- Engineering lead
- Product lead
- Relevant subject matter experts

**Post-mortem template:**
```
Timeline:
- [time] Issue started
- [time] Detected by [monitoring/user report]
- [time] Diagnosis completed
- [time] Fix/rollback deployed
- [time] Verified resolved

Root cause:
[What actually happened]

Contributing factors:
- [monitoring blind spot]
- [test gap]
- [process issue]

Action items:
- [ ] Fix code: [PR]
- [ ] Add monitoring: [metric]
- [ ] Add test: [scenario]
- [ ] Update runbook: [doc]
```

---

## SEV 2: HIGH SEVERITY INCIDENTS

### Indicators
- ✅ Degraded service (chat slow, >5s, but not down)
- ✅ Some users blocked (e.g., new residents can't sign up)
- ✅ Partial feature failure (wallet deductions fail, but chat works)
- ✅ Performance regression (dashboard now takes 10s instead of 2s)

### Response Checklist

#### Immediate (0-15 min)

```
[ ] 1. Alert engineering lead + on-call
[ ] 2. Create incident ticket
[ ] 3. Diagnose: Is it app, DB, or external API?
[ ] 4. Determine: How many users affected?
[ ] 5. Post status update to status page ("Degraded Performance")
```

#### Investigation (15-45 min)

```
[ ] 1. Check Datadog dashboard (latency, error rate)
[ ] 2. Check database: SELECT * FROM pg_stat_activity; (connections?)
[ ] 3. If DB slow: Kill long-running queries? Scale up?
[ ] 4. If app slow: Check Anthropic API status (LLM slow?)
[ ] 5. If LLM slow: Implement timeout, shorter prompts?
[ ] 6. Profile: Which endpoint is slow? Which query?
```

#### Fix (within 1 hour)

```
[ ] 1. Scale database if needed: Supabase dashboard → Scale compute
[ ] 2. Deploy performance fix: Optimize query? Add cache?
[ ] 3. Monitor metrics: Has latency improved?
[ ] 4. Communicate: Update status page with ETA
```

#### Communication

```
Status page update:
"We're investigating high latency in chat responses.
Most users are unaffected; if you're experiencing slow requests,
we're working on a fix. ETA: [time]"
```

---

## SEV 3: MEDIUM SEVERITY INCIDENTS

### Indicators
- ✅ Bug affecting specific features (e.g., role switcher broken)
- ✅ Error affecting subset of users (e.g., some residents can't ask)
- ✅ Workaround exists (use different feature)

### Response Checklist

```
[ ] 1. Create ticket in Linear (tag: bug, sev3)
[ ] 2. Add to sprint backlog
[ ] 3. Assign to engineer
[ ] 4. Communicate to affected customers: "We're aware, fix planned"
[ ] 5. Fix in next sprint (within business days)
[ ] 6. Deploy with code review
[ ] 7. Notify customers: "Fixed in today's release"
```

---

## SEV 4: LOW SEVERITY INCIDENTS

### Indicators
- ✅ Cosmetic issue (button color, typo)
- ✅ Edge case (only certain role combinations affected)
- ✅ No user-facing impact

### Response

```
[ ] 1. Add to backlog
[ ] 2. Fix in normal sprint
[ ] 3. Include in release notes (if notable)
```

---

## SPECIFIC INCIDENT SCENARIOS

### Scenario 1: Data Leak (Building A sees Building B)

**Detection:**
- User reports: "Why do I see another building's documents?"
- Sentry shows: Rows returned from wrong building
- Audit log shows: RLS policy didn't deny access

**Immediate Actions:**
```bash
# STOP: Disable the feature causing the leak
FEATURE_CROSS_BUILDING_SEARCH=false

# Rollback to last known good
vercel rollback --prod

# Kill user sessions (force re-auth)
# UPDATE auth.sessions SET ended_at = NOW()

# Notify legal: Data leak incident
# Notify customer: Which buildings affected, which users saw what
```

**Diagnosis:**
```sql
-- Check RLS policies
SELECT * FROM pg_policies WHERE schemaname='public' ORDER BY tablename;

-- Run test query
-- As User A (Building 1), try to access Building 2:
SELECT * FROM documents WHERE building_id = 'BUILDING-2-ID';
-- Should return 0 rows (RLS blocks)

-- If it returns rows: RLS policy broken
-- If 0 rows: Maybe issue was already fixed
```

**Root Cause Possibilities:**
1. RLS policy removed or commented out
2. Query bypasses building_id check (e.g., SELECT * FROM buildings JOIN documents ON true)
3. Service-role key used in user-facing code (AGENTS.md violation)
4. Session claims not validated (wrong building in JWT)

**Fix:**
- Restore correct RLS policy
- Add test to prevent regression
- Code review for similar issues
- If leaked data: notify affected customers within 30 days

**Prevention:**
- Add monitoring: Alert if RLS policies change
- Add test: Every RLS test must run as non-org member
- Code review: Every change to RLS must be reviewed by 2 people

---

### Scenario 2: Stripe Webhook Failures

**Detection:**
- Sentry alert: "stripe-webhook" errors
- Wallet balances not updating
- Customers complain: "I paid but didn't get credits"

**Immediate Actions:**
```bash
# Check webhook log
# Datadog → Stripe Webhooks → Filter by status=failed

# Verify webhook secret is correct
echo $STRIPE_WEBHOOK_SECRET
# Compare with Stripe dashboard: Settings → Webhook Endpoints

# If mismatch: Update and redeploy
vercel env add STRIPE_WEBHOOK_SECRET sk_***
vercel deploy --prod

# Manually process pending payments
# SELECT * FROM wallet_transactions WHERE status='pending'
# For each: call add_wallet_credits() with same parameters
```

**Diagnosis:**
```sql
-- Check transactions table
SELECT COUNT(*) FROM wallet_transactions WHERE kind='purchase';
-- Should see recent entries (last 24h)

-- Check for errors
SELECT * FROM wallet_transactions WHERE status='failed' LIMIT 5;

-- Verify webhook secret matches Stripe
-- Supabase dashboard → Check webhook logs
```

**Root Cause Possibilities:**
1. Webhook secret mismatch (updated in Stripe but not Vercel)
2. Webhook endpoint URL wrong (check Stripe dashboard)
3. Function throwing error (check Sentry)
4. Database insert failing (RLS denying insert)

**Fix:**
- Verify secret matches
- Check endpoint URL: https://bylawiq.app/api/webhooks/stripe
- Review error logs in Sentry
- Manually retry failed webhooks
- Add test: Stripe webhook integration test in CI

---

### Scenario 3: LLM Prompt Injection Attack

**Detection:**
- User reports: "I asked [innocent question], got [bad answer]"
- Answer references wrong building
- Answer takes action (deletes, approves) it shouldn't

**Immediate Actions:**
```bash
# Disable feature if needed
FEATURE_CHAT=disabled

# Review the specific chat
SELECT * FROM chats WHERE id = '...' LIMIT 1;
SELECT * FROM messages WHERE chat_id = '...' ORDER BY created_at;

# Verify retrieval worked correctly
SELECT * FROM retrieval_traces WHERE chat_id = '...' LIMIT 1;
-- Check: Were the right documents retrieved?
```

**Diagnosis:**
```
Questions to answer:
1. Was retrieval corrupted? (wrong documents returned)
2. Was LLM prompt corrupted? (injection successful)
3. Did the answer actually take action? (deleting, approving)
```

**Possible Causes:**
1. Retrieval returned wrong documents (RLS issue)
2. LLM jailbroken (user had special token in input)
3. User has elevated permissions they shouldn't

**Fix:**
- If retrieval issue: Fix RLS policy
- If LLM issue: Add input sanitization, review prompt
- If permissions issue: Audit building_members for this user
- Add test: Prompt injection scenarios in eval suite
- Review: All chats from this user for patterns

**Prevention:**
- Regular eval testing for prompt injection
- Input sanitization on all user inputs
- Rate limiting on chat to catch automated attacks
- Monitoring for unusual patterns

---

### Scenario 4: RLS Test Failure (Isolation Broken)

**Detection:**
- CI/CD fails: `supabase/tests/rls_*.test.sql` fails
- pgTAP reports: Firm A can read Firm B data

**Immediate Actions:**
```bash
# Block deployment
git revert <commit that broke RLS>

# Diagnose locally
npx supabase test local

# Check which test failed
grep "^select is(" supabase/tests/rls_*.sql | head -20

# Find the policy that's broken
SELECT * FROM pg_policies 
WHERE tablename = 'documents' 
ORDER BY policy_name;
```

**Fix:**
```sql
-- Example: Fix overly permissive policy
-- BROKEN:
CREATE POLICY documents_read ON documents
  FOR SELECT TO authenticated
  USING (true); -- WRONG: allows all!

-- FIXED:
CREATE POLICY documents_read ON documents
  FOR SELECT TO authenticated
  USING (
    building_id = session_building_id AND
    auth.uid() IN (SELECT user_id FROM building_members WHERE building_id = session_building_id)
  );
```

**Prevention:**
- RLS tests must pass before merge
- Code review: All RLS policy changes
- Regular (monthly) RLS audit: Review all policies line-by-line

---

### Scenario 5: Database Connection Pool Exhausted

**Detection:**
- Latency spike to 30s+
- Sentry shows: FATAL: too many connections
- New requests queued, some timeout

**Immediate Actions:**
```bash
# Check connection pool
psql $PRODUCTION_DB_URL -c "SELECT count(*) FROM pg_stat_activity;"
# If >= max_connections (usually 100): problem found

# Kill idle connections
psql $PRODUCTION_DB_URL -c "
  SELECT pg_terminate_backend(pid) 
  FROM pg_stat_activity 
  WHERE state = 'idle' AND query_start < now() - interval '5 minutes';
"

# Increase max connections (Supabase)
# Dashboard → Database → Settings → max_connections = 200
```

**Root Cause Possibilities:**
1. Connection leak in application (not closing connections)
2. Slow query holding connection open
3. Spike in traffic without connection pooling

**Fix:**
- Review application code for connection management
- Identify slow queries (check pg_stat_statements)
- Add connection pooling (Supabase has PgBouncer built-in)
- Add monitoring: Alert if connections > 80% of max

---

## COMMUNICATION TEMPLATES

### Initial Notification (5 min)

```
🚨 We're investigating an issue affecting [affected_feature].
We'll keep you updated. Thank you for your patience.
```

### Progress Update (30 min)

```
We've identified the issue: [brief description].
Estimated time to fix: [time].
Current status: [investigating/fixing/testing].
```

### Resolution

```
✅ Resolved: [brief description].
Duration: [minutes] of downtime.
Cause: [root cause, non-technical].
Prevention: [what we're doing to prevent this].
```

### Apology

```
We sincerely apologize for the service disruption.
As a gesture of goodwill, we're crediting your account with [credit amount].
If you have any questions, please reply to this email.
```

---

## MONITORING & ALERTING

### Critical Alerts (notify on-call immediately)

```yaml
Alerts:
  - name: API 500 Error Rate > 1%
    condition: errors.count / requests.count > 0.01
    notify: PagerDuty (SEV 1)
    
  - name: Chat Latency P95 > 10s
    condition: chat.latency.p95 > 10000
    notify: PagerDuty (SEV 2)
    
  - name: Database Connection Pool > 90%
    condition: connections.used / connections.max > 0.9
    notify: PagerDuty (SEV 2)
    
  - name: Stripe Webhook Failure Rate > 1%
    condition: stripe_webhooks.failed / stripe_webhooks.total > 0.01
    notify: PagerDuty (SEV 1)
    
  - name: RLS Denial Rate Spike
    condition: audit_log.rls_denials > 100 in 5 min
    notify: PagerDuty (SEV 1) + Manual review
    
  - name: Wallet Deduction Failure
    condition: wallet.deduction_errors > 10 in 1 hour
    notify: PagerDuty (SEV 2)
```

### Non-Critical Alerts (slack only)

```yaml
  - name: Slow Query Detected
    condition: queries with duration > 5s
    notify: Slack #database-alerts
    
  - name: Error Rate Elevated (0.01-0.1%)
    condition: error_rate > 0.0001
    notify: Slack #incidents
```

---

## COMPLIANCE & LEGAL

### PIPA Data Breach Notification

If any personal information is exposed:

```
Timeline:
- Immediately (within 24 hours): Notify legal team
- Within 30 days: Notify affected individuals
- Within 60 days: Notify PIPA commissioner (if required)

Notification must include:
- What happened (non-technical)
- When it happened
- What data was exposed
- Who was affected
- Steps being taken to prevent it
- Contact info for questions
```

### Audit Trail

Every incident must be logged:

```sql
INSERT INTO audit_log (
  action,
  actor_id,
  org_id,
  metadata,
  details
) VALUES (
  'incident.sev1',
  NULL,
  NULL,
  jsonb_build_object(
    'incident_id', 'INC-2026-10-001',
    'title', 'Data leak in dashboard',
    'duration_minutes', 15,
    'users_affected', 5,
    'root_cause', 'RLS policy broken'
  ),
  'See Linear INC-2026-10-001 for details'
);
```

---

## MAINTENANCE

**Review this doc:**
- Monthly: After each major incident
- Quarterly: Full review with engineering lead
- Yearly: Add new scenarios based on what happened

**Last reviewed:** 2026-10-07  
**Next review:** 2026-11-07

---

**Questions?** Slack #incidents or ask your engineering lead.
