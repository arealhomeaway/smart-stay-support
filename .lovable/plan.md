# Guest Recovery / Compensation — read-only audit and proposed design

Claims usability changes are done and published: "Assign to me" now appears on unassigned
claim rows (permission-gated, one click, writes the same assignment + audit entry the
workspace writes, list refreshes in place), and a compact "Originating ticket" link appears
on rows that came from a Ticket. 310 tests pass, typecheck clean. No Guest Recovery code
written.

## 1. What Resolve already has that this workflow needs

- **Tickets** already carry the whole guest context: property, `guest_name`,
  `guest_contact`, `guest_in_residence`, `guest_impact`, `guest_comm_status`,
  `reservation_channel`, `reservation_confirmation`, `reservation_arrival`,
  `reservation_departure`, `reservation_url`, `ownerrez_booking_id`, plus the frozen
  OwnerRez reservation snapshot and the escalation fields (`escalation_level`,
  `escalated_at`). Nothing about guest/stay context needs to be re-collected.
- **Escalation reasons** already name this work: "Guest compensation may be required",
  "Guest may need relocation or transfer", "A booking may need to be altered", "Beyond my
  authority to resolve", "An owner decision is required".
- **Evidence Quality Gate** (`evidence_requirements` / `evidence_items`) is reusable as-is;
  it was just extended for `subject_type='claim'`, so the same one-line change covers
  `guest_recovery`. It supports photos, kinds (`damage`, `before`, `after`, `general`),
  awaiting/checking/verified/rejected/**accepted_exception** — the "not available" exception
  behaviour Claims relies on.
- **Approvals** table already exists and is generic: `entity_type`, `entity_id`, `kind`,
  `amount`, `requested_by`, `approver_id`, `approver_role`, `status`, `decision_note`,
  `decided_at`. Today it is used for onboarding tasks and property estimates. It is the right
  home for recovery approvals — no new approval engine.
- **Playbooks**: "Guest compensation and claims decision" (8 steps) already encodes the house
  rule, plus "Arrival quality failure", "No heat / no cooling", "Appliance not working",
  "No hot water", "Alarm panel or access code failure", "Vendor dispatch and quote approval".
- **Claims** exists as a distinct recovery-from-a-third-party object with stages, derived Next
  Action, deadline math, duplicate warning and manager filters — the pattern to mirror, not
  the object to overload.

## 2. Legacy process and documented policy actually found

Documented precedent (playbook steps + field notes, both derived from two years of the Daily
Operations Telegram):

- Write down the impact: what the guest lost, how many days, the nightly rate.
- Gather photos and vendor findings **before any number is discussed**. Never promise a refund
  before inspection. Apologise by phone for arrival failures.
- Precedent: **~30% of the nightly rate per impacted day** for loss of use; **up to 50% of the
  first night** for a safety event on arrival; gift baskets for repeated inconvenience.
- **Anything larger than the precedent goes to leadership before it is offered.**
- Deliver significant decisions by phone, then confirm in writing. Never blame a vendor or
  cleaner to the guest.
- Record the final amount and reason for the owner statement.
- Guest-caused damage/extra cleaning: itemise and open the Claim the same day.

No dedicated legacy refund/compensation database exists — same finding as Claims. Nothing to
import; this is a clean cutover.

### Policy gaps — leadership decisions required (not invented here)

1. Dollar (or %) thresholds for supervisor vs director approval. Only "larger than precedent
   → leadership" is documented.
2. Whether "leadership" means supervisor, Director, or COO, and who holds each seat.
3. When owner approval is required — precedent says owner is *informed* of anything costing
   money, not that owners approve guest compensation.
4. Full refunds / cancellation-policy overrides: no documented authority at all.
5. Direct booking vs OTA: no documented difference (Airbnb/Vrbo often act unilaterally).
6. Relocation authority and spend cap: undocumented.
7. Whether compensation is charged to the owner statement or absorbed by ARHA, and who decides.

Resolve will show these as "Policy not defined — Director decision" rather than guessing.

## 3. Recommended architecture

**A distinct object, `guest_recovery`, always anchored to a Ticket** — one recovery case per
guest situation, not per ticket line. Reasons: it has its own lifecycle, its own approval
state, its own money fields and its own Next Action, and it must survive after the Ticket is
resolved (repair done, guest still owed a decision). It is *not* a Claim: Claim = recover money
from a responsible party; Recovery = what ARHA gives the guest. A single incident can have both,
linked by `claim_id`, each with its own state.

Context is **inherited by reference from the Ticket**, never re-typed: property, guest,
channel, stay dates, OwnerRez booking, reservation snapshot, existing evidence. Only a small
denormalised snapshot (nightly rate, impacted nights) is stored, because it is the basis of the
decision.

### Lifecycle

`reported → impact_confirmed → evidence → decision_drafted → awaiting_approval → approved →
guest_offered → guest_accepted → completed → closed`
plus `declined_no_compensation` and `guest_disputed` as outcomes, not dead ends.

### Recovery actions (smallest set reconciled with actual practice)

no compensation · apology / service recovery only · amenity replacement or temporary mitigation
(mini-fridge, portable AC, gift basket) · credit toward a future stay · partial refund ·
full refund · fee waiver · shorten stay / early departure · relocation.

### Derived Next Action (examples)

Confirm the impact · Request guest photos · Confirm maintenance findings · Obtain receipt ·
Offer temporary mitigation first · Draft the recovery decision · Request supervisor approval ·
Request Director approval — proposed amount exceeds your authority · Send the approved
compensation · Update the guest · Reassess after repair · Confirm the guest accepted ·
Close recovery. Derived from stage, evidence state, amount vs authority, approval state,
follow-up date and checkout date — never from a free-text status.

### Authority model

Rendered as one of: *Within your authority — proceed* · *Supervisor approval required* ·
*Director approval required* · *Owner approval required* · *Emergency — proceed and notify*,
each with the reason spelled out ("Director approval required because the proposed recovery
exceeds 30% of the nightly rate per impacted night"). Backed by a small editable
`recovery_authority` config so leadership sets the numbers, not the code. Until leadership
fills the gaps, anything above documented precedent routes to Director and says so.

### Financial fields (only these)

`proposed_amount`, `approved_amount`, `delivered_amount`, `currency`, `nightly_rate`,
`impacted_nights`, `approved_by`, `approved_at`, `delivered_on`, `delivery_method`
(OwnerRez refund / platform / credit / non-monetary), `claim_id`. QuickBooks stays accounting
truth; OwnerRez stays where the refund is actually performed — Resolve deep-links to the
reservation and records what was done.

### Manager oversight

One compact view, same shape as Claims manager filters: pending approvals · high-dollar
requests · no activity in N days · guest unhappy after remedy · unresolved before checkout ·
repeat issues on the same property · review-risk flag.

## 4. Backend vs no-schema work

Needs schema: `guest_recovery`, `guest_recovery_activity`, `recovery_authority` config, and
adding `guest_recovery` to the evidence `subject_type` check. Everything else — Next Action
logic, authority explanation, checklists, playbook links, manager filters, Ticket panel —
reuses existing systems with no schema change.

## 5. Risks

Low. No changes to Tickets, Claims, OwnerRez sync or finance data; recovery reads Ticket
context and writes only its own rows. The real risks are policy, not code: encoding thresholds
that leadership has not set, and staff treating a Resolve authority label as permission the
company has not actually granted.

## 6. Smallest safe build sequence

1. Schema: `guest_recovery` + activity + evidence subject, RLS mirroring Claims.
2. `src/lib/guest-recovery.ts` — vocabulary, lifecycle, authority evaluation, Next Action,
   duplicate warning (pure, fully unit-tested).
3. Recovery panel on the Ticket: start a recovery, inherit context, evidence checklist.
4. Recovery workspace + `/recovery` queue with derived Next Action.
5. Approval routing on the existing `approvals` table, with the reason shown.
6. Manager oversight view + contextual playbook links + Claim linkage.

**Recommended first build: steps 1–3** — the Ticket-anchored recovery panel with inherited
context, evidence and derived Next Action, before any approval routing. That alone removes the
Telegram dependency for "what do I do next", and it can ship before leadership resolves the
threshold questions.
