# Testing Plan & Strategy

> Comprehensive testing strategy for BylawIQ covering unit tests, integration tests, E2E tests, RLS verification, and load testing.

## Overview

Testing is organized into 5 tiers, each with specific tools and coverage requirements. The security boundary (Row-Level Security) is verified at every tier.

| Tier | Tool | Coverage | Critical? |
|------|------|----------|-----------|
| Unit | Vitest | Individual functions, components | Yes |
| Integration | Vitest + Fixtures | Module workflows, API contracts | Yes |
| E2E | Playwright | User journeys, UI flows | Yes |
| RLS | pgTAP | Cross-building isolation, security | **BLOCKING** |
| Load | k6 | Performance under scale | Recommended |

---

## Tier 1: Unit Tests (Vitest)

### Coverage Target
- ✅ 80%+ coverage for all production code paths
- ✅ All error cases (validation, auth, DB errors)
- ✅ All edge cases (empty inputs, boundary conditions)

### Files & Patterns

#### Queries (read operations)
**File:** `features/bulletin/bulletin-queries.test.ts`

Tests verify:
- Correct SQL is generated
- Filters applied (building scope, deleted_at)
- Pagination works (offset, limit)
- Sorting order (pinned DESC, created_at DESC)
- Null handling (missing data, author lookup)

**Run:**
```bash
npm test -- bulletin-queries.test.ts
```

#### Actions (write operations)
**File:** `features/bulletin/bulletin-actions.test.ts`

Tests verify:
- ✅ Zod schema validation rejects invalid input
- ✅ Auth check (requireUser) enforces 401
- ✅ Permission check (staff vs resident) enforces 403
- ✅ Building membership verified before insert
- ✅ Soft delete sets deleted_at (not DROP)
- ✅ Author-or-manager authorization logic
- ✅ Error messages don't leak building names, SQL
- ✅ All 3 checks present in order: user → input → permission

**Run:**
```bash
npm test -- bulletin-actions.test.ts
```

#### Components (UI)
**Files:**
- `features/bulletin/components/bulletin-feed.test.tsx`
- `features/bulletin/components/create-post-form.test.tsx`

Tests verify:
- ✅ Posts render with title, body, author, date
- ✅ Pinned badge shown only for pinned posts
- ✅ Staff controls (pin/edit/delete) only shown to staff
- ✅ Residents see read-only feed
- ✅ Form validation (empty, too long)
- ✅ Character counters update correctly
- ✅ Submit button disabled until valid
- ✅ Error state persists form content
- ✅ Success clears form
- ✅ Accessibility: labels, ARIA, keyboard nav

**Run:**
```bash
npm test -- bulletin-feed.test.tsx create-post-form.test.tsx
```

---

## Tier 2: Integration Tests

### Coverage Target
- ✅ Full request lifecycle (input → DB → response)
- ✅ Multi-step workflows (create → pin → delete)
- ✅ Error propagation and recovery

### Bulletin Workflow Tests

**Scenario 1: Staff Creates & Manages Post**
1. Staff member logs in
2. Navigates to bulletin
3. Fills title + body in form
4. Clicks "Post to Bulletin"
5. ✅ Verify: Post appears in feed with author name
6. ✅ Verify: Pinned badge appears
7. ✅ Verify: Staff sees action buttons
8. Click pin button
9. ✅ Verify: Post moves to top, badge appears
10. Click delete button
11. ✅ Verify: Post removed from view
12. ✅ Verify: deleted_at set (not purged)

**Scenario 2: Resident Views Only**
1. Resident logs in
2. Navigates to bulletin
3. ✅ Verify: Can see all posts (current + archived reading)
4. ✅ Verify: Create form not visible
5. ✅ Verify: No action buttons
6. ✅ Verify: All posts from own building only

**Scenario 3: Cross-Building Isolation**
1. User A from Building A logs in
2. Navigates to Building A bulletin
3. ✅ Verify: Only Building A posts shown
4. Attempts to access Building B bulletin via URL
5. ✅ Verify: Redirected or access denied (403)
6. Switches to Building B account
7. ✅ Verify: Only Building B posts visible
8. ✅ Verify: Building A posts inaccessible

---

## Tier 3: E2E Tests (Playwright)

### Coverage Target
- ✅ Real browser automation
- ✅ Real Supabase calls (dev environment)
- ✅ Full UI interactivity

### Test File
**File:** `e2e/bulletin.spec.ts`

### Test Suites

#### 1. Resident Access
```
✓ Display bulletin feed for residents
✓ Display legal disclaimer (non-dismissible)
✓ Show empty state when no posts
✓ Show read-only view (no action buttons)
```

#### 2. Staff Operations
```
✓ Display create form for staff
✓ Create a new post
✓ Enforce title length limit (120)
✓ Enforce body length limit (5000)
✓ Show error on submission failure
✓ Pin a post
✓ Unpin a post
✓ Edit a post
✓ Delete a post
✓ Prevent residents from posting
✓ Allow manager to manage any post
```

#### 3. Cross-Building Isolation
```
✓ Not show posts from other buildings
✓ Not allow cross-building access via URL
✓ Enforce RLS on all queries
```

#### 4. Mobile Responsiveness
```
✓ Display feed on mobile (375x667)
✓ Display create form on mobile
✓ Stack action buttons vertically
✓ Ensure text is readable at mobile scale
```

#### 5. Accessibility
```
✓ Have accessible form labels
✓ Have visible focus indicators
✓ Respect prefers-reduced-motion
✓ Support keyboard navigation (Tab, Enter, Escape)
```

#### 6. Performance
```
✓ Load feed within 2 seconds
✓ Paginate large feeds (100+ posts)
✓ Not re-render unchanged posts
```

**Run:**
```bash
npx playwright test e2e/bulletin.spec.ts
```

---

## Tier 4: RLS Tests (pgTAP) — CRITICAL

### Why This Is Blocking

The single rule that overrides everything (AGENTS.md §0):
> **A user must never see legal information derived from a building that is not the building they are currently scoped to.**

RLS tests verify this at the database layer. A failed RLS test means the security model is broken.

### Test File
**File:** `supabase/tests/bulletin_rls.test.sql`

### Test Matrix

| User | Building | Query | Expected | Status |
|------|----------|-------|----------|--------|
| Manager A | Building A | SELECT all posts | 2 posts (A only) | ✅ |
| Manager A | Building A | SELECT Building B posts | 0 posts | ✅ |
| Resident A | Building A | SELECT all posts | 2 posts (A only) | ✅ |
| Resident B | Building B | SELECT Building A posts | 0 posts | ✅ |
| Manager A | Building A | INSERT in Building A | 1 row inserted | ✅ |
| Manager A | Building A | INSERT in Building B | 0 rows (denied) | ✅ |
| Resident A | Building A | INSERT in Building A | 0 rows (denied) | ✅ |
| Manager A | Building A | UPDATE own Building A post | Success | ✅ |
| Manager A | Building A | UPDATE Building B post | 0 rows (denied) | ✅ |
| Manager A | Building A | DELETE Building A post | deleted_at set | ✅ |
| Manager A | Building A | DELETE Building B post | 0 rows (denied) | ✅ |
| Unauthenticated | N/A | SELECT any post | 0 posts (RLS blocks) | ✅ |
| Non-member | Any | SELECT any post | 0 posts (RLS blocks) | ✅ |

### RLS Policies Tested

1. **READ** — Only members of building can see posts
2. **CREATE** — Only staff (non-resident) can create
3. **UPDATE** — Only author or manager can modify
4. **DELETE** — Only author or manager can soft-delete
5. **SOFT DELETE** — Excluded posts have deleted_at set

**Run:**
```bash
supabase test db supabase/tests/bulletin_rls.test.sql
```

**Failure = Database access bypassed = Security breach = NO SHIP**

---

## Tier 5: Load Testing

### Coverage Target
- ✅ Handles expected concurrent users (50-200)
- ✅ Handles large buildings (1000+ posts)
- ✅ Handles peak load (multiple operations/sec)

### Metrics to Track
- Response time (p50, p95, p99)
- Error rate (should be < 0.1%)
- Database connection pool usage
- Rate limit behavior

### Scenarios

**Scenario 1: Read Heavy (Feed Display)**
```
50 concurrent residents viewing bulletin feeds
Duration: 5 minutes
Expected: < 500ms p95 response time
```

**Scenario 2: Write Heavy (Staff Posting)**
```
10 concurrent staff creating posts
Duration: 5 minutes
Expected: < 1s p95 response time
```

**Scenario 3: Mixed (Real-world usage)**
```
40 residents reading
5 staff creating/managing
Duration: 10 minutes
Expected: < 800ms p95, < 0.1% errors
```

**Run:**
```bash
k6 run scripts/load-test-bulletin.js
```

---

## Test Execution Checklist

### Before Commit
```bash
npm test                              # Unit tests
npm run format:check                  # Formatting
npm run typecheck                     # Type safety
npm run lint                          # Linting
```

### Before PR
```bash
npm test -- --coverage               # Full coverage report
npx playwright test e2e/bulletin.spec.ts  # E2E tests
supabase test db supabase/tests/bulletin_rls.test.sql  # RLS tests
```

### Before Deploy
```bash
npm run typecheck
npm run lint
npm test -- --coverage
npx playwright test
supabase test db supabase/tests/bulletin_rls.test.sql
npm run build
```

### Production Monitoring
- [ ] Error rate tracking (errors.ts logs)
- [ ] Response time dashboards (Grafana)
- [ ] RLS audit logging (resident_audit_log)
- [ ] Rate limiting tracking (10 q/hour per resident)

---

## Known Gaps & TODOs

| Category | Issue | Priority | Status |
|----------|-------|----------|--------|
| Unit | Supabase mocks need full type safety | Medium | Pending |
| E2E | Form submission error handling needs test | High | Pending |
| E2E | Concurrent edits (race conditions) not tested | Medium | Pending |
| Load | Needs k6 script setup | Medium | Pending |
| Monitoring | Audit log retention policy not defined | Low | Pending |
| Security | Rate limiting tests incomplete | High | TODO |

---

## Success Criteria

### Tier 1: Unit
- ✅ All files have test coverage
- ✅ All edge cases covered
- ✅ 80%+ coverage reported

### Tier 2: Integration
- ✅ All user workflows pass
- ✅ Error handling verified
- ✅ Cross-building isolation confirmed

### Tier 3: E2E
- ✅ Mobile rendering correct
- ✅ Keyboard navigation works
- ✅ Accessibility checks pass
- ✅ Performance targets met

### Tier 4: RLS ✅ REQUIRED
- ✅ **ALL 18 RLS tests pass**
- ✅ No cross-building data leakage
- ✅ Soft delete enforced

### Tier 5: Load
- ✅ Response times within SLA
- ✅ Error rate < 0.1%
- ✅ No connection pool exhaustion

---

## Running All Tests

```bash
# Quick check (unit only, ~30s)
npm test

# Full suite (unit + E2E + RLS, ~5-10m)
npm test && \
  npx playwright test && \
  supabase test db supabase/tests/bulletin_rls.test.sql

# With coverage report
npm test -- --coverage
```

---

## Test Maintenance

- **Weekly:** Review failed tests, update mocks as needed
- **Per Release:** Run full suite, document any gaps
- **Annually:** Audit test coverage, remove obsolete tests, add new edge cases
