# 10 — AI UX Patterns

Pattern vocabulary from **The Shape of AI** (shapeof.ai, Emily Campbell, CC BY-NC-SA), mapped to BylawIQ. The site organises AI UX into six families: Wayfinders, Inputs, Tuners, Governors, Trust builders, and Identifiers.

For a consumer AI product, Governors and Trust builders are polish. For a product whose output becomes a legal notice, **they are the product**. Prioritise accordingly.

---

## 1. Wayfinders — getting past the blank input

| Pattern | Implementation | Priority |
|---|---|---|
| **Suggestions** | Starter prompts on an empty thread, **generated from what is actually in this building's vault** — not a static list | P0 |
| **Templates** | Bylaw builder and parking rules run as structured templates the model fills section by section | P0 |
| **Follow-up** | When a question is under-specified, ask one clarifying question, not four | P0 |
| **Nudges** | "Maple Ridge has no bylaws uploaded — answers here rely on the Standard Bylaws" | P1 |
| **Initial CTA** | Composer is focused on load with building-specific placeholder | P0 |
| Example gallery | Deferred — this audience wants their building, not a showcase | P3 |

**Suggestions must be derived, not canned.** The v1 prototype had hardcoded starters like "Draft a noise bylaw for a 150-unit high-rise". Generic suggestions teach the user that the product is generic. After ingestion, generate three from the actual document structure: if the bylaws contain a pet clause, offer "What does our pet bylaw actually allow?" The first answer quoting their own document is the whole pitch.

**Follow-up, restrained.** One question, then answer with a stated assumption. "Unit 304 is making noise" needs to know how many prior complaints there have been — that determines the s.135 step. Ask that one thing. Do not ask about building type, unit count, and enforcement history in a wall of questions; the manager will abandon.

---

## 2. Inputs — what the user can direct

| Pattern | Implementation |
|---|---|
| **Open input** | The composer |
| **Inline action** | Select any text in an answer → "Explain this" / "Draft a notice from this" |
| **Expand** | "Expand this section" on a drafted bylaw |
| **Summary** | Summarise a 90-page depreciation report or a CRT decision |
| **Restructure** | Turn a chat thread into a council report |
| **Transform** | Answer → notice → PDF; dispute timeline → CRT evidence chronology |
| **Chained action** | Draft notice → log dispute event → schedule hearing deadline, as one approved sequence |

`Transform` is where the product's value concentrates. The manager does not want a chat log; they want the letter. Every substantive answer offers the transform explicitly as a button in NEXT STEPS (doc 05 §6).

---

## 3. Tuners — refining without re-prompting

| Pattern | Implementation |
|---|---|
| **Attachments** | Vault documents or uploads pinned to a turn (doc 05 §5) |
| **Filters** | Corpus chips: bylaws / rules / minutes / case law |
| **Modes** | Ask · Bylaw builder · Parking rules · Dispute · Digest — sets prompt and tool set |
| **Parameters** | `As of` date; internal-strategy vs to-the-resident tone |
| **Voice and tone** | Per-org letterhead, signature block, formality — set once in settings |
| **Connectors** | Phase 3: property management systems, Outlook/Gmail for sending |
| Model management | Never exposed. Model choice is ours. |

**Every tuner is a visible chip in the composer.** The rule: if it changes what gets retrieved or how the answer is written, the user can see it and change it without retyping. Hidden state in an AI product produces answers users cannot explain, and an answer a manager cannot explain is an answer they cannot rely on.

**Voice and tone earns its place here.** A s.135 notice on the management company's letterhead with the right signature block is the difference between a draft and a deliverable. Configure once, apply to every generated document.

---

## 4. Governors — human oversight

The family that matters most. Every one of these is P0.

| Pattern | Implementation |
|---|---|
| **Citations** | Inline `[n]` chips → source drawer. Doc 05 §6 |
| **References** | Source panel listing everything retrieved, including what was found and *not* used |
| **Verification** | Approval gate before any tool writes to the legal record or any document is sent |
| **Action plan** | For multi-step work ("prepare our CRT package"), show the plan before executing |
| **Controls** | Stop mid-stream; edit and resend any user message |
| **Branches** | Editing a message forks the thread; both branches remain reachable |
| **Stream of thought** | Tool calls visible as they run: "Searching Oakridge Towers' bylaws…" |
| **Footprints** | "How did you get this?" opens the full retrieval trace |
| **Memory** | Building context is explicit and inspectable, never silently accumulated |
| **Draft mode** | Everything the model produces is a draft until a human approves it |

### Verification — the approval card

AI SDK 6 gives tool parts an `approval-requested` state. Use it for anything that writes to the legal record.

```
┌─ Confirm before this is recorded ─────────────────────┐
│                                                        │
│  Log to dispute D-2026-014 · Oakridge Towers           │
│                                                        │
│  Stage        Notice sent                              │
│  Occurred     14 Mar 2026, 4:20 PM                     │
│  Summary      Written notice under s.135 delivered to  │
│               Unit 304 re: bylaw 3.1                   │
│                                                        │
│  This becomes part of the permanent dispute record     │
│  and cannot be edited afterwards.                      │
│                                                        │
│                    [ Edit ]  [ Cancel ]  [ Confirm ]   │
└────────────────────────────────────────────────────────┘
```

Handled client-side via `addToolOutput` on the approval part; the tool does not execute until the user confirms. Never auto-approve, never remember the choice, never batch. Each write to the legal record is confirmed individually — that is what makes the audit trail meaningful.

### Footprints — the retrieval trace

```
┌─ How this answer was built ───────────────────────────┐
│ Scope     Oakridge Towers · as of today               │
│ Searched  Building documents (4 docs, 312 chunks)     │
│           BC legislation · CRT decisions              │
│ Retrieved 34 passages → reranked → 8 used             │
│                                                        │
│ Used                                                   │
│   Bylaw 3.1 — Quiet Hours              0.94  [1]      │
│   SPA s.135 — Complaint procedure      0.91  [2]      │
│   Bylaw 5.2 — Fines                    0.88  [3]      │
│ Found but not used                                     │
│   Bylaw 3.4 — Common property          0.41           │
│                                                        │
│ [ This answer is wrong ]                               │
└────────────────────────────────────────────────────────┘
```

Showing what was found and *not* used is more valuable than showing what was. It tells a manager whether the model missed something they know exists — and "Bylaw 3.4 was retrieved and scored 0.41" is a debuggable statement in a way that a wrong answer is not. The feedback button writes the trace to `retrieval_traces` for the eval set.

### Memory, explicitly

No implicit personalisation. What the AI "knows" is exactly: the active building's vault, the linked dispute, the current thread, and org tone settings. All four are visible in the composer chips or the building header. Nothing accumulates silently across sessions.

This is a deliberate rejection of the ambient-memory pattern common in consumer AI. In a product where the same question must yield the same answer for compliance reasons, personalised drift is a defect.

---

## 5. Trust builders

| Pattern | Implementation |
|---|---|
| **Caveat** | Persistent, non-dismissible disclaimer. Doc 11 §2 |
| **Disclosure** | AI-generated content visually marked; the serif/sans split marks quoted law vs generated prose (doc 06 §3) |
| **Data ownership** | Settings state plainly: documents are not used for training, are building-scoped, and are exportable and deletable |
| **Consent** | Uploading documents containing resident personal information requires an acknowledgement of PIPA obligations |
| **Watermark** | Exported PDFs carry a footer: "Drafted with BylawIQ · [date] · Review by legal counsel recommended" |
| Incognito mode | Not offered. Every query in a building is auditable, by design. |

The footer watermark on exports is a real control, not decoration. When a notice surfaces at the CRT, everyone should be able to see it was AI-drafted and human-approved. Hiding that would be worse for the strata than disclosing it.

---

## 6. Identifiers

| Pattern | Implementation |
|---|---|
| **Name** | "BylawIQ" for the product; the assistant is not separately personified |
| **Avatar** | `◈` mark in `--color-ai`. Geometric, not a face |
| **Color** | `--color-ai` (`#4A3A78`) appears **only** on AI-generated surfaces |
| **Iconography** | The `◈` mark on every AI-generated element |
| **Personality** | Precise, plain, and never chatty |

**Personality specification.** BylawIQ writes like a competent articling student briefing a manager: direct, sourced, and willing to say "your bylaws do not address this." No enthusiasm, no apologising, no hedging into uselessness. It does not have opinions about whether a resident is being unreasonable; it has citations about what the process requires.

Specifically: no "Great question!", no "I'd be happy to help", no emoji, no exclamation marks. A manager forwarding an answer to their council should not have to strip out chatbot voice first.

---

## 7. Anti-patterns

Things that look like good AI UX and are wrong here.

**Confidence percentages.** "87% confident" is not calibrated and implies a precision the system does not have. Use citations, or say the documents do not address it. The prototype's CONFIDENCE section should not be ported.

**Autonomous action.** No tool sends an email, files a document, or notifies a resident without an explicit human confirmation, per action. Not per session, not per thread.

**Silently widened scope.** If retrieval finds nothing in the building's documents, it does not quietly fall back to general BC law and present the result as if it were building-specific. It says what it searched and what it found.

**Ambient memory.** Covered above.

**Streaming as theatre.** Do not stream a pre-computed answer token by token to look like thinking. Stream because generation is genuinely incremental.

**Suggestion overload.** Three starters, not eight. Hick's Law applies hardest at the moment of highest uncertainty.

**Dismissible disclaimers.** The one thing a professional-liability product cannot do is let the warning be turned off.
