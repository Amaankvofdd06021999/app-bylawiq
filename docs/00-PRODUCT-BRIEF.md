# 00 — Product Brief

## 1. What BylawIQ is

An AI assistant that answers British Columbia strata property law questions **grounded in the specific building's own bylaws**, then turns those answers into the documents a strata manager actually has to send: enforcement notices, hearing letters, council reports, CRT evidence packs.

Generic legal chatbots answer "what does the Strata Property Act say about noise." BylawIQ answers "Unit 304 has been playing music past midnight for six weeks — what do I send, and does *this building's* bylaw 3.1 actually support a fine." The second question is the product.

## 2. What it is not

- Not legal advice. It produces legal *information* and draft documents that a licensed BC lawyer reviews before adoption.
- Not a general-purpose chatbot. Off-topic queries get redirected, not answered.
- Not a strata management platform. No accounting, no work orders, no owner billing. It integrates with those; it does not replace them.

## 3. Why grounding is the whole business

Every BC strata has different bylaws. The Standard Bylaws in the Schedule to the *Strata Property Act* are only the default — most stratas have amended them, filed Form I amendments at the Land Title Office, and accumulated years of amendments that contradict each other.

A manager asking "can I fine this owner $200" gets a different answer in each building. The Act caps fines (s.130), but the building's own bylaw sets the actual amount and the schedule. An AI that answers from the Act alone is confidently wrong most of the time.

The recurring failure mode at the Civil Resolution Tribunal is **procedural**, not substantive: fines get overturned because the strata skipped a step in the s.135 complaint → written notice → opportunity for a hearing → written decision sequence. So the product's real job is procedural compliance, and its real output is a correctly-sequenced paper trail.

## 4. The two personas

Everything in the app branches from one question: **are you responsible for one building, or many?**

|  | Council member / president | Strata manager |
|---|---|---|
| **Buildings** | One. They live in it. | Many. Typically 8–30. |
| **Employer** | Volunteer, unpaid | Management company (the tenant/org) |
| **Legal exposure** | Personal — s.31 fiduciary duty | Professional — BCFSA licensed |
| **Session shape** | Rare, deep. A problem arose. | Constant, shallow, interrupted. Twelve things at once. |
| **Biggest risk to them** | Not knowing the process exists | Applying Building A's rules to Building B |
| **Context switching** | None | Every few minutes |
| **What "fast" means** | Getting a complete, correct answer | Getting to the right building's context in one action |

### The design consequence

These are not two apps. They are **one app with a different shell**, chosen by a single value: how many active building memberships the user has.

```
memberships.length === 1  →  Focused shell.  No switcher. Building is ambient.
memberships.length  >  1  →  Portfolio shell. Switcher is the first control. Building is explicit.
```

Critically, this is driven by **membership count, not role**. A strata manager who happens to manage one building gets the focused shell — with an escape hatch to add buildings. A council president who sits on two strata councils gets the portfolio shell. Role determines *permissions*; membership count determines *shape*. Conflating them produces a manager with one building staring at an empty portfolio dashboard.

## 5. Jobs to be done

Ranked by frequency × pain, from the validation interviews.

| # | Job | Persona | Output |
|---|---|---|---|
| 1 | "A resident is doing X. What can we actually do about it?" | Both | Procedural plan + draft notice |
| 2 | "Does our bylaw cover this, or do we need to amend?" | Both | Grounded answer + gap analysis |
| 3 | "Draft the s.135 notice for me" | Manager | Letter, PDF, on letterhead |
| 4 | "Write the parking rules for this building" | Both | Multi-section document |
| 5 | "What changed in the law that affects my buildings?" | Manager | Digest, per-building impact |
| 6 | "Council is asking me — summarise the options" | Manager | Council report |
| 7 | "Prepare our evidence for the CRT" | Both | Chronology + document bundle |

Jobs 1–3 are the wedge. Ship them properly before touching 4–7.

## 6. The document vault

Each building has a vault. The vault is what makes answers building-specific. Document types, in priority order for ingestion:

| Type | Required? | Why the AI needs it |
|---|---|---|
| **Registered bylaws** (consolidated + Form I amendments) | Yes — onboarding blocker | The single source of truth for what this building's rules are |
| Rules (council-made, s.125) | Strongly recommended | Distinct from bylaws, different amendment process, often confused |
| Strata plan | Recommended | Defines lots vs common property vs limited common property — determines who maintains what |
| Council meeting minutes | Optional | Establishes what council decided and when — critical for CRT chronology |
| AGM/SGM minutes | Optional | Proves the 3/4 vote that adopted a bylaw. Without it, the bylaw's validity is arguable |
| Depreciation report | Optional | s.94 compliance, maintenance obligations |
| Insurance summary | Optional | Deductible allocation disputes |
| Dispute log | Generated in-app | Prior notices sent — required for escalation sequencing |

**The bylaw currency problem.** A vault holding last year's bylaws is a liability. Every bylaw document carries `effective_date`, `superseded_by`, and `lto_filing_reference`. The AI must cite the version in force on the date the conduct occurred, not the version in force today. See doc 04 §6.

## 7. Success metrics

| Metric | Target | Why this one |
|---|---|---|
| Grounded citation rate | > 95% of legal claims carry a resolvable citation | The product's core promise |
| Cross-building leak incidents | 0 | Existential |
| Time to first correct notice | < 10 min from "resident is doing X" | The wedge job |
| Building switch → scoped answer | < 3 s | Manager's whole day is context switches |
| Faithfulness (RAGAS) | > 0.90 | Hallucinated law is the product risk |
| Draft-to-send edit distance | Trending down | Measures whether drafts are actually usable |

## 8. Constraints

- **Jurisdiction:** BC only at launch. The schema is jurisdiction-aware from day one (doc 02) because Ontario's *Condominium Act* and CAT tribunal are Phase 4, but no Ontario logic ships in Phase 1.
- **Privacy:** Resident names, unit numbers, and dispute details are personal information under PIPA. Vault documents are never used to train models, never leave the building's scope, and are deletable on request (doc 11 §6).
- **Professional liability:** The product cannot practise law. Every output is a draft for human review. The verification gate (doc 11 §4) is a legal requirement, not a UX preference.
