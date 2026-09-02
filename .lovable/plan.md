# Frontline Ticket Experience Simplification — Audit & Design

Read-only audit. No code changed. Backend objects (Tickets, Work Orders, Claims, Guest Recovery, routing, SLA, approvals, evidence, handoff acceptance, Playbooks, Property Hub, Breezeway) stay intact.

## 1. Ticket creation fields today (`/tickets/new`)

| Field | Today | Verdict |
|---|---|---|
| Summary (title) | required text | REMOVE as separate field — derive from "What happened?" first line |
| What happened? (details) | optional textarea, last | KEEP — becomes the first and primary field |
| Property | select | KEEP (search-first) |
| Intake source | select, default "Guest message" | INFER (Outlook/integration/lead set it; manual = "Staff") |
| Situation catalog | 14 cards in 4 groups | REPLACE — plain-language first, one "Looks like…" chip with Change |
| Work type | select shown when no situation match | INFER, HIDE (supervisor can change after) |
| Guest impact | select | INFER from stay + classifier; ask one question only when ambiguous |
| Occupancy | select, already auto-filled from OwnerRez | INFER (remove control) |
| Priority | select, pre-filled from rubric | DEFAULT + override with reason after creation |
| Playbook | select, default "auto" | REMOVE from intake (deterministic matcher already exists) |
| Owning functional role | select, auto-seeded | REMOVE from intake; supervisor reassign only |
| Guest name | text, auto-filled from OwnerRez | INFER (hide) |
| Guest contact | text, never auto-filled | HIDE UNTIL RELEVANT (Property/OwnerRez contact panel already shows it) |
| Guest in home | switch, auto-forced | INFER (hide) |
| Cross-team | switch | REMOVE from intake — derived as work develops |
| Priority override reason | conditional | KEEP, but only in the post-creation override path |

Result: 15 controls → **2 inputs + 1 confirm**.

## 2. Data Resolve already knows and still asks for

Occupancy, guest name, guest-in-home, stay dates, channel and booking id all arrive from the live OwnerRez lookup during intake and are auto-applied — then re-presented as editable fields. Guest impact is implied by "active stay + issue class" in most cases. Intake source is known for every Outlook/lead/integration ticket. All of it should be shown as read-only context, not asked.

## 3. Priority classifier defect (confirmed)

`mechanicalPriority()` applies a **P1 floor** to guest impact `active_guest_affected`, and the situation "Something is broken and can't wait" seeds exactly that value. The tested refrigerator ticket therefore stored `priority = p1`, `suggested_priority = p1`.

Correction to approved intent:
- P1 floor: safety, security, habitability, active water/fire/sewage, no secure access, dangerous electrical.
- P2 floor: active-stay service failure — HVAC, critical appliance, major plumbing without damage, readiness failure.
- P3: standard requests. "A guest asked for something" alone is P3–P2, never P1.
- Occupancy alone already never forces P1 (existing guard is correct and stays).

## 4. Routing finding (item 25) — no defect

Ticket created 2026-09-02 04:14 UTC = 23:14 Central Sep 1, inside the configured 22:00–08:00 window. `auto_assign_ticket` maps post-midnight times back to the previous local date, then reads `oncall_roster`: Micah Sinor is rostered 2026-09-01, James Almario 2026-09-02. **Micah was the correct on-call holder**, and the note correctly states after-hours does not change priority. The `ge_day` value on the ticket is the work type's owning seat, not the assignee — it reads as a contradiction in the UI and should be hidden from frontline.

## 5. Open-ticket page today (25 sections) — classification

ALWAYS VISIBLE: header/status, Next Action hero (new), Guest & stay (one merged compact block), compact response timing, compact ownership line, Activity (condensed), closure when ready.

SHOW WHEN RELEVANT: Guidance (compact line unless a Playbook matched), playbook steps, waiting banner, escalation banner, vendor/visit log, evidence prompt tied to Next Action, related repair/guest resolution/cost recovery once they exist, reopen.

SUPERVISOR ONLY: assign/reassign panel, supervisor exception, archive, authority detail, routing diagnostics.

MOVE TO MORE/OVERFLOW: full response-standard prose (behind "Why?"), reservation snapshot (behind "View original reservation snapshot"), attachments browser, Outlook source card, property history, advanced Breezeway options, Details field dump.

REMOVE FROM FRONTLINE: duplicate guest fields in Details, standalone "Send to Breezeway" form, permanently mounted empty Work Order / Guest Recovery / Claim cards, cross-team flag display.

## 6. Redundant guest/reservation data

Four representations render or fork on one page: live OwnerRez read, frozen ticket snapshot fields, ticket `guest_name`/`guest_contact`, and copies baked into Claim/Recovery rows. Frontline sees **one** "Guest & stay" block sourced live, labelled live, with the frozen snapshot behind a link and labelled "as captured when the ticket opened".

## 7. Refrigerator benchmark

| | Today | Proposed |
|---|---|---|
| Taps to create | ~16 | ~5 |
| Manual decisions | 9 (summary, source, situation, impact, occupancy, priority, playbook, role, cross-team) | 2 (describe, property) + 1 confirm |
| Screens before "Open" | 3 mobile screens | ~1 |
| Model concepts required | work type, playbook, seat, cross-team, impact rubric | none |

## 8. Proposed mobile intake

```text
What happened?
[ Fridge is not cooling, guest reported it ]

Property
[ Winsome Wildwood            ▾ ]

Active stay found
Marcus A. · Airbnb · Sep 1–Sep 5

Looks like
Appliance failure · P2 · Not right? Change

           [ Open issue ]
```

## 9. Proposed open-ticket hierarchy

```text
Refrigerator not cooling
Winsome Wildwood · Marcus A. · Airbnb
P2 · You own this · Transfer

NEXT
Update the guest
Due in 42 min          [ Record update ]

Then: get the refrigerator inspected   [ Send for repair ]

Guest & stay ▾   Guidance: none   Activity ▾   More ▾
```

## 10. Vocabulary

Guest recovery → **Guest resolution**; Claim → **Recover this cost**; Work Order + Breezeway → one **Send for repair**; functional role → hidden; "closure blockers" → "What's still missing".

## 11. One repair path

"Send for repair" creates the Resolve Work Order and, where the property is Breezeway-enabled and allowlisted, the Breezeway execution task — prefilled from the ticket (property, title, description, department from work type, priority, date, evidence reference). Advanced Breezeway fields stay behind "More options". Nothing about the integration model reaches the coordinator.

## 12. Coordinator vs supervisor

Coordinator: issue, guest & stay, Next Action, due time, evidence needed now, owner, linked work, transfer, close when ready.
Supervisor adds: reassign, priority override, supervisor exception, archive, authority/routing detail, audit view.

## 13. Backend work actually required

- Priority floors in `src/lib/tickets.ts` (guest-impact rubric) + situation seeds.
- A text→classification helper (deterministic keyword map over existing work types) for "Looks like".
- Intake source inference default.
- Server-side derivation of role/playbook/impact/occupancy at creation so the client can stop sending them.
- Frontline label mapping only for vocabulary.

Untouched: schema, RLS, routing trigger, SLA engine, approvals, evidence, handoff acceptance, Playbook matcher, Property Hub, Breezeway outbound rules and allowlist, Claims/Recovery/Work Order logic.

## 14. Risks

Misclassification from free text (mitigated by always-visible Change), priority floor change altering historical comparisons (new tickets only), hidden fields still required by downstream logic (server derives them), Breezeway one-button path firing on non-allowlisted properties (guard stays server-side), supervisors losing controls they use (kept, moved).

## 15. Smallest safe sequence

1. Fix the priority rubric and situation seeds (+ tests).
2. Server-side derivation of role, playbook, impact, occupancy, source.
3. New two-field mobile intake with "Looks like … Change".
4. Next Action hero + compact ownership/response/guidance on the ticket page.
5. Merge guest/reservation into one block; snapshot behind a link.
6. Progressive disclosure for handoff, blocked, vendor, exception, archive, files.
7. One "Send for repair" path; Breezeway advanced behind More options.
8. Vocabulary pass; guided closure checklist.
9. Frontline vs supervisor QA on iPhone viewport, then publish.
