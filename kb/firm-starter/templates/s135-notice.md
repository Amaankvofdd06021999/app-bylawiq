---
id: firm.template.s135-notice
layer: firm
type: template
title: "Notice of bylaw complaint (section 135)"
citation: null
jurisdiction: BC
source_url: null
in_force_from: null
in_force_to: null
retrieved_at: null
licence: bylawiq-original
topics: [bylaw-enforcement-s135, fines, hearings]
cites: [bc.spa.s129, bc.spa.s130, bc.spa.s133, bc.spa.s134, bc.spa.s135, bc.spa.s131, bc.spa.sched.bylaw20, bc.spr.s7.2, topic.bylaw-enforcement-s135]
supersedes: null
status: draft
reviewed_by: null
reviewed_at: null
notes: "needs counsel review. Drafted from the Strata Property Act, the Strata Property Regulation and the Schedule of Standard Bylaws read on 2026-09-30. Nothing here has been settled by a lawyer, and wording that goes to a resident carries legal consequences: counsel approves before this is used."
---

# Notice of bylaw complaint (section 135)

> **Not yet approved.** A BC-licensed lawyer has to review this before it is sent to anyone. The steps below cite the provision that requires them; the wording does not come from any approved precedent.

## When to use this

Send this before council decides anything. It is the letter that gives the owner or tenant the
particulars of a complaint and the chance to answer, which the strata corporation must do before it
imposes a fine, requires payment of the costs of remedying a contravention, or denies the use of a
recreational facility [bc.spa.s135]. Those are the three enforcement options the Act gives
[bc.spa.s129, bc.spa.s130, bc.spa.s133, bc.spa.s134].

## What the Act requires this letter to do

- Set out the **particulars of the complaint, in writing** [bc.spa.s135].
- Give a **reasonable opportunity to answer**, and say that a hearing may be requested
  [bc.spa.s135]. A hearing means being heard in person at a council meeting [bc.spr.s7.2].
- Where the person is a **tenant**, a notice of the complaint also goes to the landlord and to the
  owner [bc.spa.s135]. Use the tenant contravention template for those.

It does **not** decide anything. The decision comes later, in writing, and is council's alone: the
decisions whether a person contravened, whether to fine and how much, and whether to deny a
recreational facility cannot be delegated to a manager [bc.spa.sched.bylaw20].

## Before you send it

1. Confirm the bylaw or rule was **registered and in force** on the date of the incident, from the
   building's filed bylaws, not from the standard bylaws unless the building has filed nothing on
   the subject.
2. Confirm there **is a complaint**. The Act requires the corporation to have received one
   [bc.spa.s135].
3. Confirm the **recipient** is the owner or tenant responsible, and whether a landlord and owner
   must also be notified [bc.spa.s135].
4. Check the building's **maximum fine and frequency** before saying anything about consequences.
5. Record the complaint, this notice and the date sent, so the sequence can be shown later.

## Template

> {{strata_plan_number}} · {{building_name}}
> {{date_sent}}
>
> To: {{recipient_name}}, {{unit_or_strata_lot}}
> Delivered by: {{delivery_method}}
>
> **Re: Complaint about {{short_description}}**
>
> The strata corporation has received a complaint that on {{incident_dates}} at
> {{incident_location}} the following occurred: {{incident_particulars}}.
>
> The complaint is that this contravenes bylaw {{bylaw_number}} of the strata corporation's
> registered bylaws, which provides: {{bylaw_text}}.
>
> The evidence the council has is: {{evidence_summary}}.
>
> Council has made no decision about this complaint. Before it does, you may answer it. You may
> reply in writing by {{response_deadline}}, and you may also request a hearing before council,
> which is an opportunity to be heard in person at a council meeting. To request a hearing, write to
> {{contact_for_hearing_request}} stating that you want a hearing and the reason.
>
> If council decides that a contravention occurred, it may impose a fine of up to
> {{max_fine_for_this_bylaw}} for each contravention, require you to pay the reasonable costs of
> remedying the contravention, or deny the use of a recreational facility. You will be given written
> notice of any decision.
>
> {{sender_name}}, on behalf of the strata council of {{strata_plan_number}}

## Fields

| Placeholder | Where it comes from |
|---|---|
| `{{strata_plan_number}}`, `{{building_name}}` | Building profile |
| `{{recipient_name}}`, `{{unit_or_strata_lot}}` | The strata corporation's list of owners and tenants [bc.spa.s35] |
| `{{bylaw_number}}`, `{{bylaw_text}}` | The building's **registered** bylaws, as filed |
| `{{incident_dates}}`, `{{incident_particulars}}`, `{{evidence_summary}}` | The complaint record |
| `{{response_deadline}}` | Set by council. The Act requires a *reasonable* opportunity, not a fixed period [bc.spa.s135] |
| `{{max_fine_for_this_bylaw}}` | The building's own bylaws, which cannot exceed the regulated maximum |

## Related

`firm.template.tenant-contravention-notice`, `firm.template.hearing-response`,
`firm.template.hearing-decision`, `firm.template.fine-notice`,
`firm.guidance.s135-process`, [topic.bylaw-enforcement-s135].
