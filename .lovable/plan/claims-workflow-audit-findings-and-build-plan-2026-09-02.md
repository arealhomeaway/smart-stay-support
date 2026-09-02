# Claims Workflow — Audit Findings and Build Plan

## 1. What exists in Resolve today

There is no Claim object. Claims exist only as a Ticket flavour:

- Situation `damage_claim` in `src/lib/situations.ts` maps to work type **Claims** (category `claims`, P3 default, 120-minute response target, completion target "Per platform deadline", required closure evidence "Evidence pack, claim reference and submission date"). Zero tickets currently use that category, though 93 tickets mention damage/claim/deposit language — recovery work is happening inside ordinary tickets and is invisible as a pipeline.
- Playbook "Guest compensation and claims decision" (8 steps) covers guest-facing goodwill: document impact, gather photos/vendor findings before discussing money, ~30% nightly-rate loss-of-use precedent, up to 50% of first night for arrival safety events, leadership escalation for larger offers, open a same-day damage/extra-cleaning claim, communicate the decision, record final amount and reason on the Ticket. It is a compensation guideline, not a recovery workflow.
- Reusable infrastructure already present: Evidence Quality Gate (`src/lib/evidence.ts`, subjects include tickets and work orders, `damage` kind, required flag, awaiting/checking/verified/rejected statuses), private signed-URL attachments (`src/lib/attachments.server.ts`), Breezeway work orders (1,152) with photos and comments, frozen OwnerRez reservation snapshots on tickets, and `approvals` (11 rows) which is the only table in the schema carrying money — `amount` + `currency` + `due_on` + `external_reference`.
- No cost, invoice, estimate, or recovery amount exists anywhere else in the schema. Vendor invoice totals are not currently captured in Resolve.

## 2. Legacy source material

The connected Notion workspace contains **no Claims database**. Searches for claim, damage, incident, AirCover and reimbursement return only the "Claims" work-type standard page in the Operating Standards database. Conclusion: there is no legacy Claims database to migrate — the historical process lives in email, platform portals and Telegram precedent. This is a clean-cutover build, and the answer to item 17 is: zero active legacy claims in Notion, nothing to import, nothing to archive.

Field-note precedent that must be respected: photos and vendor findings before any money conversation; leadership approval above routine amounts; every incident needs a ticket.

Because there is no legacy field list, the "retain / derive / exclude" classification applies to the Claims work-type standard and the compensation playbook: retain evidence pack, claim reference, submission date, amounts and platform deadline; derive stage, next action, days remaining, unrecovered amount; exclude nothing (there is nothing to exclude).

## 3. Claim object and types

New table `claims`, distinct from tickets. Links: property, ticket (origin), reservation snapshot (channel, confirmation, guest, arrival/departure copied at creation), work order, guest name, assignee.

Smallest useful type set, reconciled with actual ARHA channels:

- `channel_aircover` — Airbnb AirCover
- `channel_vrbo` — Vrbo / other channel damage
- `guest_damage` — direct pursuit of the guest
- `deposit_recovery` — direct-booking security deposit
- `insurance` — property insurance
- `owner_recovery` — owner-paid expense to be recovered or charged

## 4. Stage model and Next Action

Backend stages (display labels simplified in UI):

`potential → gathering → costing → ready_to_submit → submitted → waiting_external → info_requested → decided → recovered → closed`

`decided` carries a disposition: approved / partial / denied. Denied and partial keep reason plus full amount history.

Next Action is **derived**, never hand-maintained: missing required evidence → "Upload <missing item>"; no cost → "Get vendor estimate"; complete but unsubmitted → "Submit <type> claim"; submitted and quiet past follow-up date → "Follow up with platform"; info_requested → "Respond to platform request"; approved but not received → "Confirm reimbursement received"; recovered → "Close claim".

## 5. Evidence

Reuse the existing Evidence Quality Gate and attachments — no new file storage. Add `claim` as an evidence subject and a per-type required-evidence checklist (photos, vendor estimate, invoice, guest communication, platform correspondence, cleaning/inspection report, receipt). The workspace shows Required / Received / Missing explicitly, and Missing rows are what drives Next Action.

## 6. Financials and deadlines

Stored amounts only, no fabricated metrics: `estimated_amount`, `actual_cost`, `submitted_amount`, `approved_amount`, `recovered_amount`; unrecovered is derived (`submitted − recovered`). Repair cost is referenced from the linked work order where available and snapshotted at submission time so a later vendor edit cannot silently change a submitted figure.

Deadlines: no reliable per-platform policy dates exist in Resolve today, so we will **not** invent them. `deadline_on` is entered by whoever knows it (with a per-type default hint the team can confirm), and Resolve then owns days-remaining, approaching-deadline and overdue states plus a follow-up date for external waits. Source of truth for platform deadlines stays the platform notice, recorded on the claim.

## 7. Ticket → Claim

"Create Claim" action on eligible tickets (damage/claims situations, or any ticket via supervisor). Carries property, reservation snapshot, guest, ticket link, description, and existing evidence references. Ticket stays the operational record; the claim is the recovery workflow. Duplicate guard: warn (not block) when an open claim already exists for the same ticket, or same property + reservation + type — allow "create anyway" for genuinely separate recovery paths.

## 8. Claims Home and workspace

Home is action-first, grouped: Needs Attention, Evidence Missing, Ready to Submit, Waiting on External Party, Deadline Approaching, Recently Recovered. Row shows property, guest/reservation, type, amount at risk, stage, next action, deadline, assignee.

Workspace sections: Header (type, stage, assignee, deadline, amount at risk) · Incident · Evidence (required/received/missing) · Costs · Activity timeline · Next Action (prominent) · Related Work (ticket, work order, cleaning review, approval).

Manager view is a filter set on the same page, not a separate analytics suite: unsubmitted, approaching/overdue deadline, high value, missing evidence, long external waits, denied/partial.

## 9. Permissions

Coordinator: create from eligible ticket, gather evidence, add activity, advance up to `submitted`. Supervisor: view all, reassign, override stage, record decisions. Director/Admin: close, write off, configure type/evidence rules. RLS mirrors existing ticket policies; only internal staff see claims.

## 10. Finance boundary

QuickBooks stays accounting truth. Resolve records the workflow and exposes a per-claim financial summary (recovery source, amounts, disposition) for manual handoff to accounting. No QuickBooks integration in this pass.

## 11. Schema changes required

- `claims` (with the fields above, RLS + GRANTs, updated_at trigger)
- `claim_activity` (timeline)
- `claim_evidence_requirements` — or an extension of `evidence_requirements` to accept a claim subject, preferred
- No changes to tickets, work orders, OwnerRez or Breezeway tables; the ticket link lives on the claim side. Risk to existing workflows is therefore additive only.

Buildable without schema change: nothing meaningful — the object does not exist.

## 12. Build sequence for QA

1. Schema + types + `src/lib/claims.ts` (stages, types, derived next action, deadline math)
2. Ticket → Claim creation with duplicate warning
3. Claim workspace
4. Claims Home with action-first groups
5. Evidence checklist wiring into the existing gate
6. Manager filters, then demo-data QA against the seven scenarios and publish

Scenarios 1–7 (guest damage, cleaning restoration, missing evidence, info requested, partial recovery, denial, deadline risk) all resolve inside this model without extra states.
