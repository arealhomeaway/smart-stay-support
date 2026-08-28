# Resolve — Beta acceptance reconciliation and build plan

Resolve is **not beta-ready**. Individual workflows pass in isolation; the shared operating workspace (assignment, contact context, communication, vendor coordination, real files) is not complete. Vendor portal stays paused, no historical import, no live automation.

## A. Requirements / status matrix

| # | Requirement | Status | Evidence / gap |
|---|---|---|---|
| 1 | Automatic assignment | **Missing** (rules partly documented) | Ownership language and edit rules exist (`src/lib/matters.ts`, RLS `can_edit_ticket`); Golden Rule "property → Pod, priority + time → who acts" is recorded in project memory and in the Coach prompt. But no router: every matter is assigned by hand in `MatterOwnershipPanel`. Only `quarterly.server.ts` auto-assigns (cleaning region inspector). Vendor ranking exists (`dispatch.ts`) but is vendor-side, not staff-side. No "Pod / suggested vs actual assignee" distinction, no no-eligible-person state. |
| 2 | Vocabulary | **Decision pending** — nothing renamed | Current screens use Matter/Ticket (Operations), Onboarding Task, Owner approval / time entry. Recommendation below. |
| 3 | Property & contact context | **Partial / unverified** | Guest context is real and read-only: `guest-context.functions.ts` → `ownerrez.server.currentGuestForListing`, matched by `ownerrez_property_id` only, demo rows excluded, gated to admin/manager/tech and hidden from vendor/owner. Not covered: **owner contacts are not shown at all** on the matter, vacant / upcoming-reservation handling is a single "unavailable" state, no explicit multi-reservation date selection rule. |
| 4 | Breezeway field work | **Preview receiver only** | Implemented: credential check, property list, task read (`getBreezewayTask`, `listBreezewayTasksForHome`), subscription create, verified webhook receiver with retry/duplicate/stale handling. The receiver **only writes `breezeway_webhook_events`** — it does not touch any Request/Work Order. No task creation, no assignment, no completion-evidence pull. |
| 5 | Quarterly reviews under vendor management | **Missing (nav only)** | `/quarterly` sits in the Operations nav (`AppShell.tsx`). Records and paused scheduler are fine; only ownership/navigation is wrong. |
| 6 | Real files | **Missing** | `documents.storage_path` and `vendor_documents.storage_path` columns exist, but there is **no Supabase Storage bucket and no upload/download code anywhere in `src/`** — every current document row is an `external_url` link. SharePoint connector is read-scoped to the ARHA Resolve site; sign-in success is not file capability. |
| 7 | Asana replacement | **Partial** | Have: 150-task furnishing template, phases, assignment, due dates, evidence/approval gates, notes, handoff gate. Missing for daily use: subtasks, dependency enforcement, @mention notifications, real file attachments, plan variants beyond full-furnishing. Asana is still needed today for attachments, subtasks and expense-log tasks referenced in template text. |
| 8 | Active Owner guide alignment | **Partial — mapped below** | Guide read (branded AOP package). Gaps: action key has 8 action types, app has approval / evidence / time only; 6 named meetings and day-30/60/90 reviews are not modelled as records; task statuses (Not released, Blocked, Not applicable) and version-on-revision are not implemented; business-day + 5 p.m. property-local due-date maths is not implemented. Day 1 = day after closing matches the current start-date behaviour. |
| 9 | Communication & notifications | **Partial** | Internal: `ticket_activity` + mentions parsing (`extractMentions`) — in-app only. In-app notifications: owner side only (`owner_notifications`); no staff notification store. Push: none. Email: send/read through Graph restricted in app code to one mailbox (`mailbox-allowlist.server.ts`, `/users/<mailbox>` only, no `/me`), `email_log` records sends. Microsoft-side restriction (ApplicationAccessPolicy) is **not evidenced** — app-side only. External guest/owner/vendor messaging: not implemented. Today "appears in a queue" ≠ "someone was notified" everywhere except owner alerts. |
| 10 | Telegram | **Missing / blocked** | No Telegram code. Template + field notes show it is the live channel for handyman, realtor, designer, property groups. Bot API can only read groups it is a member of, cannot backfill history, and cannot act as a person. |
| 11 | OwnerRez messaging | **Blocked by external capability (to confirm in writing)** | Implemented is read-only reservation/guest lookup (`ownerRezGet`, v2 GET). No message read/reply is implemented and I have not yet cited the official v2 messaging docs — that citation is a task in Phase 0, not a claim. |

## B. Terminology recommendation (one, for approval)

Adopt **Request** (Operations) with **Work Order** used *only* for the linked external field job (Breezeway), one per dispatch, never auto-created; **Project → Task → Subtask** for Onboarding; **Action, Approval, Participation Entry** for Active Owner.

Duplication warning: if a Work Order becomes a separate Resolve record for internal work too, every staff-handled Request gets a shadow record with its own status and SLA, and Breezeway retries will fan out. Keep Work Order as a *child link record* (external id + origin), not a parallel queue. Owner **Action** and Onboarding **Task** must not both exist for the same obligation — the owner Action is the owner-facing view of one onboarding task.

## C. Blocking decisions / approvals needed (only these)

1. **Ownership matrix**: for each work-type category × market/pod, who is the default responsible role, and the fallback order when nobody is eligible (Pod queue → Supervisor → Director?). Coverage hours per pod. This is the one genuinely missing artefact — everything else is derivable.
2. Terminology approval (Section B).
3. Approval for a bounded Breezeway **write** test (one sandbox/pilot task) before any task creation ships.
4. Approval for a bounded external file test (Storage first; SharePoint write only if you want it).
5. Confirmation whether Microsoft-side mailbox restriction exists (ApplicationAccessPolicy screenshot from your admin) or whether app-side allowlist is accepted for beta.
6. Telegram: which conversations must move into Resolve vs stay in Telegram.

## D. Phased build plan (ordered by "complete Operations workday")

**Phase 0 — Facts, no code (1 pass)**
- Cite OwnerRez v2 docs for message read/reply; confirm account access separately.
- Confirm Breezeway task-create/assign/complete endpoints and required fields against their API docs.
- Request Microsoft access-policy evidence.
Dependency: none. Output feeds Phases 3 and 5.

**Phase 1 — Real files** *(recommended first bounded task, see below)*
Private Storage bucket + upload/view/download with RLS mirroring matter/onboarding access, writing `documents.storage_path`. Unblocks evidence, Asana replacement, vendor docs.

**Phase 2 — Automatic assignment** (needs Decision 1)
Routing table (work type × pod/market × coverage) → sets `assigned_to` as *actual* assignee, or leaves an explicit `unassigned` + `needs_routing` escalation state visible in the Oversight queue. Every change written to `ticket_activity`; handoff acceptance rule untouched.

**Phase 3 — Property & contact context** (independent)
Add authorized owner contacts to the property panel; explicit vacant / next-arrival / mid-stay states with the exact date rule; keep the existing vendor/owner redaction.

**Phase 4 — Communication baseline**
Staff notification store + in-app bell for assignment, mention, handoff, breach; delivered/failed shown from `email_log`. No push in beta.

**Phase 5 — Breezeway linked Work Order** (needs Phase 0 + Decision 3)
`work_orders` link record: `request_id`, `external_system`, `external_id`, `origin` (resolve|breezeway), idempotency key. Receiver updates the linked record instead of only logging events; retries update, never insert.

**Phase 6 — Quarterly reviews move under Vendor management**; records untouched, scheduler stays paused.

**Phase 7 — Onboarding parity** (subtasks, dependencies, mentions, plan variants) and **Phase 8 — Active Owner guide alignment** (action types, meetings, statuses, business-day due dates).

Telegram and OwnerRez messaging stay out of the beta path until Phase 0 says what is actually possible.

## Recommended first bounded task

**Real file attachments on an Operations Request.** Create one private Storage bucket with owner/staff-scoped RLS, add upload + list + signed-download to the matter detail screen, persist `documents.storage_path`, and prove it with one real photo, one video and one PDF on a demo matter — including that a vendor and an owner cannot read them. No external writes, no SharePoint write, no live data touched.
