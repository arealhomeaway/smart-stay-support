# Situation-first ticket creation + a less flat Resolve

Read-only audit first, then the proposed change. Nothing has been coded.

## 1. How ticket creation works today

`/tickets/new` has three modes (Ticket, One-touch, Coach). In Ticket mode the form loads every active work type and shows a single required select: "Work type — pick the closest match", labelled with its default priority. That select is the only thing the user has to get right, and it is the thing they are least equipped to get right.

Everything else the system needs is derived from it:

| From work type | Used for |
| --- | --- |
| category, bucket | reporting, queues |
| default_priority | the rubric's starting point |
| functional_role_code | owning seat (drives the `tickets_auto_assign` trigger) |
| response_minutes, action_start_minutes | `slaDueDates()` → response/action clocks |
| completion_target, operating_standard, backup_coverage | the standard shown on the ticket |
| required_closure_evidence | the closure gate |
| playbook_id | steps attached at open |

Priority is then computed by `mechanicalPriority(work type default, guest impact, occupancy)` — guest impact floors at P1, occupancy floors at P2, occupancy alone never reaches P1. A manual change away from that value requires `priority_override_reason`.

## 2. What the catalog actually contains

24 active work types across 8 categories (access, admin, claims, cleaning, guest, maintenance, owner, quality). Several are internal-process records that a person reporting an issue would never pick correctly: "Breezeway task-reporting issue", "Maintenance and landscaping work-order review", "Tenant lead tracker", "Tone-check call", "Cleaning Review Log", "Adding homes to portals". Mixing those into one flat list next to "Immediate maintenance" is the root of the clunkiness.

## 3. Other creation paths (must stay consistent, not rebuilt)

- Coach (`/coach`) — AI already picks the work type by name and writes the same fields.
- Mailbox intake (`src/lib/intake.server.ts`) — keyword guesses category/priority, no work type.
- Breezeway-origin tickets — routed by the Team B weighted queue.

Only the manual form changes.

## 4. Proposed flow — "choose the situation, Resolve chooses the work type"

Step 1 — **What's happening?** A card grid of ~12 plain-language situations, grouped as *Guest*, *Home*, *Owner*, *Internal*:

- Guest needs something right now
- Guest is arriving and needs info
- New booking / inquiry
- Guest review or survey to log
- Something is broken
- Something is unsafe (smoke, gas, water, security)
- Home isn't clean / cleaning needed now
- Ongoing cleaning need
- Can't get in — lock, code or access
- Owner question or complaint
- Property or owner info needs updating
- Internal / admin (opens the full catalog)

Step 2 — **Two contextual questions only**: "Is a guest affected?" (guest impact) and "Is anyone in the home?" (occupancy) — occupancy pre-filled from the OwnerRez stay we already fetch, editable.

Step 3 — **Resolve's decision, shown plainly**: resolved work type, owning seat, priority with the reason ("P1 because a guest is affected"), acknowledge/start clocks, closure evidence. A quiet "Not right? Change classification" link reveals the full work type select — same field as today, just no longer the front door. Internal/admin situations open that select directly.

Then title, description, property, source, attachments as today.

**Backend: no changes.** Situation → candidate work types is a presentation map in `src/lib/situations.ts`, resolved against the live `work_types` rows by name. Every column written is exactly what is written today, from the same helpers. Manual reclassification keeps writing `priority_override_reason` when priority moves off the mechanical value.

## 5. Visual energy — restrained, not gamified

- Motion tokens in `src/styles.css`: one ease, two durations; a `resolve-rise` entrance for cards and a `resolve-pulse` used only by live SLA clocks.
- Step transitions in the new form; the classification result animates in rather than appearing.
- Priority/state chips get a subtle tinted glow at P1 only.
- Button/row press feedback (scale 0.98, 120ms) and hover elevation on lists and property cards.
- Success moments: a brief check-and-slide on ticket created, save and evidence upload — no confetti, no sound, no scores.
- All of it respects `prefers-reduced-motion`.

## 6. Risks

- Wrong situation → wrong work type. Mitigated by always showing the resolved work type with a one-click change, and by keeping every internal type reachable.
- Situation labels drift from the catalog if work types are renamed. Mitigated by resolving by name with a safe fallback to the full select, plus a test that every mapped name exists.
- Motion on long lists. Mitigated by entrance animation on first paint only.

## 7. Sequence

1. `src/lib/situations.ts` + tests (map integrity, priority derivation unchanged).
2. Rebuild Ticket mode of `tickets.new.tsx` as the three steps; One-touch and Coach untouched.
3. Motion tokens and feedback pass across shared primitives.
4. Full test suite, typecheck, browser QA of ticket creation end to end.
