---
id: firm.template.fine-notice
layer: firm
type: template
title: "Notice of decision imposing a fine"
citation: null
jurisdiction: BC
source_url: null
in_force_from: null
in_force_to: null
retrieved_at: null
licence: bylawiq-original
topics: [fines, bylaw-enforcement-s135]
cites: [bc.spa.s130, bc.spa.s131, bc.spa.s132, bc.spa.s135, bc.spa.sched.bylaw20, bc.spa.sched.bylaw23, bc.spa.sched.bylaw24, bc.spr.s7.1, topic.fines]
supersedes: null
status: draft
reviewed_by: null
reviewed_at: null
notes: "needs counsel review. Drafted from the Strata Property Act, the Strata Property Regulation and the Schedule of Standard Bylaws read on 2026-09-30. Nothing here has been settled by a lawyer, and wording that goes to a resident carries legal consequences: counsel approves before this is used."
---

# Notice of decision imposing a fine

> **Not yet approved.** A BC-licensed lawyer has to review this before it is sent to anyone. The steps below cite the provision that requires them; the wording does not come from any approved precedent.

## When to use this

Only after the complaint process is complete: a complaint received, written particulars given, a
reasonable opportunity to answer including a hearing if one was requested, and, for a tenant, notice
to the landlord and owner [bc.spa.s135]. This letter is the written notice of the decision, which
must be given as soon as feasible [bc.spa.s135].

## What the Act requires

- The fine cannot exceed the **maximum set out in the building's own bylaws**, and those bylaws
  cannot exceed the regulated maximum [bc.spa.s132]. The regulated maximums are $200 for each
  contravention of a bylaw, $50 for a rule, and $1,000 for a bylaw prohibiting or limiting use of a
  residential strata lot for remuneration as vacation, travel or temporary accommodation
  [bc.spr.s7.1]. Under the unamended standard bylaws the maximum is $50 and $10
  [bc.spa.sched.bylaw23].
- A fine for a **continuing** contravention may be imposed no more often than the bylaws allow,
  within the regulated frequency of every 7 days, or daily for that short-term accommodation bylaw
  [bc.spr.s7.1, bc.spa.sched.bylaw24].
- Where the person fined is a **tenant**, the corporation may collect from the tenant, the landlord
  and the owner, but not more than the total once over [bc.spa.s131].
- The decision is council's and cannot be delegated [bc.spa.sched.bylaw20].

## Before you send it

1. Check the process was completed **for this contravention** [bc.spa.s135].
2. Check the amount against the **building's own bylaw**, not the Regulation
   [bc.spa.s132].
3. For a continuing contravention, check the **date of the last fine** against the frequency the
   bylaws allow [bc.spa.sched.bylaw24].
4. Check the **minutes show council deciding** [bc.spa.sched.bylaw20].
5. For a tenant, address the copies to the landlord and the owner [bc.spa.s135].

## Template

> {{strata_plan_number}} · {{building_name}}
> {{date_sent}}
>
> To: {{recipient_name}}, {{unit_or_strata_lot}}
> Copy to: {{landlord_and_owner_if_tenant}}
>
> **Re: Council's decision on the complaint of {{complaint_date}}**
>
> On {{notice_date}} you were given the particulars of a complaint that
> {{short_description}}, said to contravene bylaw {{bylaw_number}}. You were given an
> opportunity to answer the complaint. {{what_the_person_said}}
>
> At its meeting on {{council_meeting_date}}, council decided that the contravention
> {{occurred_or_not}} and has imposed a fine of {{fine_amount}} for
> {{number_of_contraventions}}.
>
> The maximum fine for a contravention of this bylaw under the strata corporation's bylaws is
> {{max_fine_for_this_bylaw}}.
>
> {{continuing_contravention_paragraph}}
>
> The fine has been added to your strata lot account and is payable by {{due_date}}. Payment
> details: {{payment_details}}.
>
> If the contravention continues, council may impose a further fine {{fine_frequency}} without
> repeating the complaint process, as the Strata Property Act allows for a continuing contravention
> of the same bylaw.
>
> {{sender_name}}, on behalf of the strata council of {{strata_plan_number}}

## Fields

| Placeholder | Where it comes from |
|---|---|
| `{{fine_amount}}`, `{{max_fine_for_this_bylaw}}` | The building's registered bylaws, capped by [bc.spr.s7.1] |
| `{{fine_frequency}}` | The building's continuing contravention bylaw, capped by [bc.spr.s7.1] |
| `{{notice_date}}` | The date the section 135 particulars were sent; without it the sequence cannot be shown |
| `{{continuing_contravention_paragraph}}` | Include only where the process has already been completed once for this bylaw [bc.spa.s135] |

## Related

`firm.template.s135-notice`, `firm.template.hearing-decision`,
`firm.template.tenant-contravention-notice`, `firm.guidance.s135-process`, [topic.fines].
