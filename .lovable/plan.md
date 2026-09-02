# Work Orders, Maintenance Authority & Warranty — audit and smallest safe plan

## Part 1 — What exists today (read-only findings)

### Work Order architecture
There is no ARHA-owned Work Order record with money on it. "Work Order" today means three different things:

- **Breezeway work orders** (`breezeway_work_orders`, 1,152 rows) — a read-mostly mirror: name, department, priority, status, stage, scheduled date/time, assignees, photo/comment counts, `linked_ticket_id`. No quote, no cost, no approval, no warranty.
- **Outbound Breezeway tasks** (`breezeway_outbound_tasks`) — what Resolve pushes out, behind the property allowlist.
- **Vendor execution on the Ticket itself** — `tickets` carries `vendor_name`, `vendor_user_id`, `vendor_status`, `vendor_brief`, `vendor_dispatched_at`, `vendor_accepted_at`, `vendor_completed_at`. Arrival is evidenced by `ticket_visits` (geo check-in/out, minutes on site).
- `work_projects` is an onboarding-style grouping table (name, status, owner, dates). It is not a maintenance execution object and should not be repurposed.

**Consequence:** the maintenance money decision — quote, authority, owner approval, final cost — currently has nowhere to live.

### Maintenance approval logic
None exists. `approvals` is a generic table (`entity_type`, `entity_id`, `kind`, `amount`, `requested_by`, `approver_id/role`, `status`, `decision_note`, `decided_at`, `due_on`, `evidence_url`) already used by onboarding, with two `estimate` and one `scope` row ever created. It is a good fit and needs no redesign. `property_vendor_coverage.approval_limit` exists per property/vendor and is unused by any rule.

Authority evaluation itself only exists in Guest Recovery (`recovery-policy.ts`, v1: $50 / $500 / documentation over $300). Maintenance thresholds ($350 owner line) are nowhere in code.

### Owner approval behaviour
Owner-facing tables exist (`owner_notifications`, `owner_contact_alerts`, `owner_alert_log`, `notify_owner_of_ticket` trigger) but they are **notification only**. Nothing records a decision, so today "owner notified" is indeed indistinguishable from "owner approved".

### Warranty data
`properties.warranty` (jsonb) is populated on 150 of 157 live properties, with keys: `builder_present`, `builder_expires_on`, `furniture_expires_on`, `claim_process + external_links` (free-text provider contact). Coverage: 28 builder-present, 26 builder expiry dates, 113 furniture expiry dates, 20 usable provider contacts. `properties.hvac` (151 rows) holds only filter sizes/notes — **no HVAC or appliance warranty exists as data.** Surfaced today only as a searchable Property Hub card (`property-details.ts` → "warranty"); nothing reads it during a Ticket.

**Conclusion:** Resolve can reliably say "builder warranty may apply, expiry X, contact Y" for the builder/furniture cases and must stay silent (not guess) on HVAC/appliance.

### Closure and ownership
`work_types.required_closure_evidence` + the Evidence Quality Gate already drive closure; `guest_communication_required` already exists. Handoff acceptance (`handoffs`, `handoff_reviews`) and accountable-owner fields already enforce "not complete until accepted". All of this is reused, unchanged.

## Part 2 — Proposed model

### Emergency mitigation vs permanent repair — one Work Order, two phases
Do **not** create a second Work Order. Each Work Order carries a `phase`: `mitigation` → `permanent`. Mitigation may proceed with no owner approval when a recorded emergency reason applies (active damage, safety, security, utilities, water intrusion, sewage, fire/smoke, dangerous HVAC, cannot secure). Closing the mitigation phase does **not** close the Work Order while a permanent repair remains outstanding — the queue shows "Mitigated — permanent repair still pending".

### Authority evaluation (policy v2, added to the existing versioned policy file)
- ≤ $350 permanent repair → **within ARHA authority, James may approve**. Micah is not involved at $251–$350.
- > $350 permanent repair → **owner approval required**, unless a recorded contractual exception applies.
- Emergency mitigation → **proceed**, with the permanent repair evaluated separately on its own amount.
- PC may always request quotes and dispatch approved vendors.
Every verdict returns a plain-English reason ("Owner approval required because the permanent repair exceeds $350").

### Derived state, not manual statuses
`needs_diagnosis → quote_requested → quote_received → awaiting_approval → approved → scheduled → in_progress → evidence → closed`, derived from timestamps and amounts already recorded. Waiting states (vendor / quote / owner / warranty) are derived, never typed.

### Owner approval
Reuse `approvals` with `entity_type='work_order'`, `kind='owner_repair'`, `approver_role='owner'`: amount presented, scope in `detail`, vendor/quote reference, requested by/at, `approved | declined | info_requested`, decision date, note/evidence. The Work Order stays actionable while waiting.

### Warranty branch (inside the Work Order, no portal)
When the property has builder/furniture warranty data that is unexpired and the category plausibly matches, show **"Warranty may apply"** with expiry and contact — never an assumption of coverage. Branch records: provider contacted, ETA, guest/stay impact, then wait or go alternate. An override requires a reason (guest affected, next reservation affected, ETA too slow, mitigation inadequate, damage risk) and records who decided. Never auto-bypass on elapsed time.

### Second quote — advice only
Recommend "Consider a second quote" on soft signals (estimate far above the property's history for that category, estimate approaching replacement, quotes differing materially, uncertain diagnosis, owner asked). Never blocks. No new financial thresholds are invented.

### Vendor commitments and checkpoints
Track P1: contact within 10 min, acknowledgment within 10 min, else backup vendor. P2: contact 30 min, acknowledgment 30 min, plan within 2 hours. Misses are counted: 1st → PC follows up, 2nd → James notified + backup recommended, 3rd/pattern → vendor performance review with Micah. Checkpoints derive the next action: scheduled arrival → ETA → missed ETA → arrived (from `ticket_visits`) → completed → evidence received → guest updated.

### Stay impact, mitigation, and relationships
Reservation context already snapshotted on the Ticket drives "occupied now / arrival / checkout" visibility only — it never changes priority outside policy. Temporary mitigation (mini fridge, portable AC, lock) is recorded and cannot close the Work Order alone. Guest Recovery and Claims stay separate and linkable: the Work Order's quote, invoice, photos, vendor report and final cost are readable by a linked Claim; neither a Recovery nor a Claim is ever auto-created.

### Closure gates
Vendor completion confirmation, required photo evidence (existing gate), final cost, guest notified when occupied, approval documented where required, permanent repair resolved or an explicit follow-up created. "Vendor said done" alone never closes. James can reopen.

## Part 3 — Build sequence

**Schema genuinely required** (one migration): `work_orders` (ticket_id, property_id, phase, category, emergency_reason, quote/approval/cost fields, vendor, warranty branch fields, scheduling/ETA, closure fields, claim_id, recovery_id) + `work_order_events` for commitments, misses, checkpoints and decisions. `approvals` and evidence need only a new subject value, no restructuring.

**Possible without schema change:** the whole authority/warranty/second-quote/checkpoint rule engine, all policy explanations, queue derivation, and warranty reads from `properties.warranty`.

**Sequence**
1. Policy + rules module and tests (authority, emergency, warranty eligibility, second quote, commitments, closure gates) — pure logic, no UI.
2. Migration for `work_orders` / `work_order_events`.
3. Work Order panel on the Ticket: phase, quote, authority verdict, warranty banner, vendor commitments.
4. Owner approval step through `approvals`, with waiting visible and no silent approval.
5. Work Order queue view (needs action / waiting vendor / waiting quote / waiting owner / warranty pending / missed ETA / evidence missing / permanent repair pending) — a queue, not an Operations redesign.
6. Claim and Guest Recovery linking, then QA against scenarios A–L.

**Recommended first implementation:** steps 1–3.

**Risks:** none to Breezeway (mirror stays read-only, no outbound change), none to Tickets (additive), none to Claims/Guest Recovery (link fields only). The main risk is duplicating the Ticket — avoided by keeping the Work Order strictly the execution/money record hanging off the Ticket.
