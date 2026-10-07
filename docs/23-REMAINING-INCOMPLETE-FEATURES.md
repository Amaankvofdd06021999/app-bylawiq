# ❌ REMAINING INCOMPLETE FEATURES (After Phase 1 Fixes)

**Status:** ❌ **NOT IMPLEMENTED**  
**Date:** 2026-10-07  
**Severity:** 🔴 CRITICAL & 🟡 MEDIUM

---

## 🔴 CRITICAL INCOMPLETE FEATURES

### 1. **Resident Chat (Gated Version)** 🔴 CRITICAL
**File:** `features/residents/resident-chat-gated-actions.ts` (lines 80-89)
- **Issue:** Returns PLACEHOLDER response instead of calling actual chat API
- **Current Code:**
  ```ts
  // TODO: Call actual chat API with retrieval
  // For now return placeholder that would trigger verification
  const placeholderResponse = {
    content: 'This is a placeholder response grounded in your building bylaws...',
    sources: [{ documentId: 'doc-1', relevance: 0.8 }, ...],
  };
  ```
- **What's Missing:** Actual call to `/api/chat` endpoint with retrieval
- **Impact:** 🔴 HIGH — Residents get fake responses, not real AI answers
- **Status:** MOCK/DEMO ONLY

### 2. **Resident Chat UI** 🔴 CRITICAL
**File:** `features/residents/components/resident-chat-ui.tsx` (lines 76-80)
- **Issue:** Shows PLACEHOLDER response, doesn't call real chat API
- **Current Code:**
  ```ts
  // TODO: Call actual chat API
  // For now, show placeholder response
  setTimeout(() => {
    const assistantMessage: ChatMessage = {
      id: 'assistant-' + Date.now(),
      role: 'assistant',
      text: 'This is a placeholder response...',
    };
  ```
- **What's Missing:** Actual API call to send message
- **Impact:** 🔴 HIGH — Chat UI is just demo/UI shell
- **Status:** MOCK/DEMO ONLY

---

## 🟡 MEDIUM PRIORITY INCOMPLETE FEATURES

### 3. **Resident Email Confirmation** 🟡 MEDIUM
**File:** `features/residents/resident-management-actions.ts` (line 203)
- **Issue:** Comment says "TODO: Send email to resident with confirmation"
- **Status:** Email NOT being sent when resident is added
- **Impact:** 🟡 MEDIUM — Residents won't know they were added
- **Type:** UNIMPLEMENTED (no code at all)

### 4. **Resident Invitation Creation** 🟡 MEDIUM
**File:** `features/residents/resident-management-actions.ts` (lines 181-184)
- **Issue:** Comment says "Create invitation record instead of user"
  - Currently creates user directly
  - Should create invitation instead
  - Just returns error: "Please ask the resident to sign up first via bylawiq.com/join"
- **Status:** Partially working but not per spec
- **Impact:** 🟡 MEDIUM — Can't invite residents properly

### 5. **Firm Onboarding - Send Invite Email** 🟡 MEDIUM
**File:** `features/admin/firm-onboarding-actions.ts` (line 217)
- **Issue:** Comment says "TODO: Send invite email with inviteCode"
- **Status:** Email NOT being sent
- **Impact:** 🟡 MEDIUM — Firm contacts won't get onboarding invitation
- **Type:** UNIMPLEMENTED (no code at all)

### 6. **Onboarding Wizard - Settings Form** 🟡 MEDIUM
**File:** `features/platform-admin/components/onboarding-wizard.tsx` (line 194)
- **Issue:** Comment says "TODO: Add settings form"
- **Step 4 (Settings):** Just shows placeholder "Configure billing, team access levels, and feature flags..."
- **Status:** UI not implemented
- **Impact:** 🟡 MEDIUM — Platform admins can't configure firm settings during onboarding
- **Type:** JUST UI (no implementation)

### 7. **Resident Credit Purchase** 🟡 MEDIUM
**File:** `features/admin/billing-actions.ts` (line 139)
- **Issue:** Comment says "TODO: Implement resident credit purchase"
- **Current Code:**
  ```ts
  case 'credit_pack': {
    // Add credits to resident wallet
    // TODO: Implement resident credit purchase
    return { ok: true, message: `Credits added (resident feature)` };
  }
  ```
- **Status:** Returns success but doesn't actually add credits
- **Impact:** 🟡 MEDIUM — Residents can't buy credit packs
- **Type:** MOCK (returns success but no-op)

---

## 🟢 MINOR INCOMPLETE FEATURES

### 8. **Toast System Integration** 🟢 MINOR
**File:** `features/admin/components/team-members-table.tsx` (line 57)
- **Issue:** Comment says "Show success toast (TODO: integrate toast system)"
- **Status:** Success state has no visual feedback
- **Impact:** 🟢 LOW — UX issue, not functional break
- **Type:** MISSING INTEGRATION

---

## 📊 SUMMARY TABLE

| Feature | Type | Severity | File | Status |
|---------|------|----------|------|--------|
| Resident Chat (Gated) | Core | 🔴 CRITICAL | resident-chat-gated-actions.ts | PLACEHOLDER |
| Resident Chat UI | Core | 🔴 CRITICAL | resident-chat-ui.tsx | PLACEHOLDER |
| Resident Email | Integration | 🟡 MEDIUM | resident-management-actions.ts | NOT IMPLEMENTED |
| Resident Invitations | Feature | 🟡 MEDIUM | resident-management-actions.ts | PARTIAL |
| Firm Onboarding Email | Integration | 🟡 MEDIUM | firm-onboarding-actions.ts | NOT IMPLEMENTED |
| Settings Form | UI | 🟡 MEDIUM | onboarding-wizard.tsx | NOT IMPLEMENTED |
| Credit Purchase | Feature | 🟡 MEDIUM | billing-actions.ts | MOCK |
| Toast Integration | UX | 🟢 MINOR | team-members-table.tsx | MISSING |

---

## ⚠️ CRITICAL ISSUES REQUIRING IMMEDIATE FIX

### Issue #1: Resident Chat is Completely Non-Functional
**Files Affected:**
- `features/residents/resident-chat-gated-actions.ts` (placeholder)
- `features/residents/components/resident-chat-ui.tsx` (placeholder)

**Current Flow:**
```
Resident asks question
    ↓
Shows placeholder response
    ↓
Verification passes (because it's hardcoded)
    ↓
Resident sees fake answer ❌
```

**What Should Happen:**
```
Resident asks question
    ↓
Call actual /api/chat endpoint
    ↓
Real Claude response with retrieval
    ↓
Verification gate validation
    ↓
Resident sees real answer ✅
```

**Time to Fix:** ~1-2 hours (wire actual chat API)

---

## 🔍 FILES WITH INCOMPLETE CODE

```
CRITICAL:
❌ features/residents/resident-chat-gated-actions.ts (placeholder response)
❌ features/residents/components/resident-chat-ui.tsx (no API call)

MEDIUM:
⚠️ features/residents/resident-management-actions.ts (2 TODOs)
⚠️ features/admin/firm-onboarding-actions.ts (email not sent)
⚠️ features/admin/billing-actions.ts (credit pack no-op)
⚠️ features/platform-admin/components/onboarding-wizard.tsx (settings form)

MINOR:
ℹ️ features/admin/components/team-members-table.tsx (no toast)
```

---

## 🚨 WHAT THIS MEANS

### For Residents:
- ❌ **Resident chat does NOT work** — Gets fake responses
- ❌ **Cannot be properly invited** — Broken invitation flow
- ❌ **Won't receive confirmation emails** — Silent feature

### For Firm Onboarding:
- ❌ **Firms won't get onboarding invites** — Silent feature
- ❌ **Can't configure settings during onboarding** — Incomplete wizard
- ❌ **Can't purchase credits** — Fake success, no actual purchase

### For Platform Admins:
- ⚠️ **Missing toast feedback** — UX friction but works

---

## ✅ THESE WERE FIXED (Phase 1)

From earlier completion:
- ✅ Pending invitations display
- ✅ Next billing date

But these NEW ones discovered are NOT in scope of Phase 1.

---

## 🎯 NEXT STEPS

### Option 1: Fix All Critical Issues
**Time:** ~4-5 hours
- Wire resident chat to real API
- Implement resident emails
- Implement firm onboarding emails
- Implement settings form
- Implement credit purchase

### Option 2: Fix Only Critical (Resident Chat)
**Time:** ~1-2 hours
- Make resident chat functional
- Defer email and forms to Phase 3

### Option 3: Deploy with Known Limitations
- Document that resident chat is demo-only
- Disable in production
- Fix in next release

---

## ❌ PRODUCTION READINESS

Current status: **NOT READY FOR PRODUCTION**

Reason: Resident chat (core feature) returns fake responses. Would mislead users.

Recommendation: **Fix resident chat before production deployment**, or disable resident-facing features until implemented.

---

## 📋 IMPLEMENTATION PRIORITY

1. 🔴 **CRITICAL** — Resident chat wiring (1-2 hours)
2. 🟡 **MEDIUM** — Email sending (1 hour)
3. 🟡 **MEDIUM** — Settings form (1 hour)
4. 🟡 **MEDIUM** — Credit purchase (1 hour)
5. 🟢 **LOW** — Toast integration (30 min)

**Total time to complete all:** ~5-6 hours

---

## ✅ SIGN-OFF

These are the ACTUAL remaining incomplete features that are:
- Completely or partially mock/demo/UI only
- Supposed to be fully functional
- Still not working as intended

**Critical blocker:** Resident chat returns fake responses - cannot ship to production with this active.
