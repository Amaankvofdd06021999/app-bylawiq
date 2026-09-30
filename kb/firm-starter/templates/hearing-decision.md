---
id: firm.template.hearing-decision
layer: firm
type: template
title: "Decision letter after a council hearing"
citation: null
jurisdiction: BC
source_url: null
in_force_from: null
in_force_to: null
retrieved_at: null
licence: bylawiq-original
topics: [hearings, bylaw-enforcement-s135, fines]
cites: [bc.spa.s34.1, bc.spa.s135, bc.spa.sched.bylaw18, bc.spa.sched.bylaw20, topic.hearings]
supersedes: null
status: draft
reviewed_by: null
reviewed_at: null
notes: "needs counsel review. Drafted from the Strata Property Act, the Strata Property Regulation and the Schedule of Standard Bylaws read on 2026-09-30. Nothing here has been settled by a lawyer, and wording that goes to a resident carries legal consequences: counsel approves before this is used."
---

# Decision letter after a council hearing

> **Not yet approved.** A BC-licensed lawyer has to review this before it is sent to anyone. The steps below cite the provision that requires them; the wording does not come from any approved precedent.

## When to use this

After a hearing, to give council's decision. Two different duties can apply, and the deadline
differs:

- Hearing requested under [bc.spa.s34.1] **to seek a decision of council**: written decision within
  **one week** after the hearing.
- Hearing as part of answering a bylaw complaint: written notice of the decision **as soon as
  feasible** [bc.spa.s135].

Where the hearing was both, the shorter period governs in practice.

## What the letter has to do

- State the **decision**, in writing [bc.spa.s34.1, bc.spa.s135].
- Where a penalty is imposed, say **what it is**. Where none is, say so plainly.
- Where the person fined is a tenant, the decision also goes to the landlord and the owner
  [bc.spa.s135].

The decision is council's. Whether a person contravened, whether to fine and how much, and whether
to deny a recreational facility cannot be delegated [bc.spa.sched.bylaw20], and the result of the
vote belongs in the council minutes [bc.spa.sched.bylaw18].

## Before you send it

1. Check the **minutes record council's decision** and the vote [bc.spa.sched.bylaw18].
2. Check that the decision is on the complaint that was actually put to the person.
3. Check that any fine is within the **building's own maximum**.
4. Diary the deadline from the hearing date, not from the council meeting that follows it
   [bc.spa.s34.1].

## Template

> {{strata_plan_number}} · {{building_name}}
> {{date_sent}}
>
> To: {{recipient_name}}, {{unit_or_strata_lot}}
> Copy to: {{landlord_and_owner_if_tenant}}
>
> **Re: Council's decision following the hearing on {{hearing_date}}**
>
> Thank you for attending the hearing on {{hearing_date}} about {{hearing_subject}}.
>
> Council considered what you said, together with {{materials_considered}}.
>
> Council's decision is: {{decision}}
>
> The reasons for the decision are: {{reasons}}
>
> {{penalty_paragraph}}
>
> {{payment_or_compliance_details}}
>
> If you have questions about this decision, contact {{contact}}.
>
> {{sender_name}}, on behalf of the strata council of {{strata_plan_number}}

## Fields

| Placeholder | Where it comes from |
|---|---|
| `{{decision}}`, `{{reasons}}` | The council minutes [bc.spa.sched.bylaw18] |
| `{{penalty_paragraph}}` | Where a fine or other penalty is imposed: what it is, for which contravention, and the amount. Where none is, say council has decided to take no further action |
| `{{landlord_and_owner_if_tenant}}` | Required where the person is a tenant [bc.spa.s135] |

## Related

`firm.template.s135-notice`, `firm.template.hearing-response`, `firm.template.fine-notice`,
`firm.guidance.s135-process`, [topic.hearings].
