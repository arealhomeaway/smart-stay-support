# Resolve — beta acceptance reconciliation

Resolve is **not beta-ready**. Individual workflows pass; the shared operating workspace (assignment, contact context, communication, vendor coordination, real files) is not complete. Vendor portal stays paused; no historical import, no live sends, no external writes, no automation activation.

**Ownership split:** automatic assignment (#1) and property/guest/owner contact population (#3) are Claude Code's on a separate branch — nothing here touches them. The handover spec for both is in Section E so no competing implementation is built.

## A. Requirements / status matrix

| # | Requirement | Status | Evidence / gap |
|---|---|---|---|
| 1 | Automatic assignment | **Missing — assigned to Claude** | Ownership fields and edit rules exist (`src/lib/matters.ts`, RLS `can_edit_ticket`). No router: assignment is manual in `MatterOwnershipPanel`. Only `quarterly.server.ts` auto-assigns (region inspector). No Pod/suggested-vs-actual distinction, no "nobody eligible" state. See Section E. |
| 2 | Vocabulary | **Decision pending — nothing renamed** | Recommendation in Section B. |
| 3 | Property & contact context | **Partial — assigned to Claude** | Guest context is real and read-only (`guest-context.functions.ts` → `ownerrez.server.currentGuestForListing`), matched by `ownerrez_property_id` only, demo excluded, gated to admin/manager/tech, hidden from vendor/owner. Missing: owner contacts on the matter, explicit vacant / upcoming / mid-stay date rule. See Section E. |
| 4 | Breezeway field work | **Implemented: read + receiver only** | Have: credential check, property list, task read (`getBreezewayTask`, `listBreezewayTasksForHome`), subscription create, verified receiver with retry/duplicate/stale handling. The receiver **writes only `breezeway_webhook_events`** — it does not update any Request or Work Order today. API supports what we need: `POST /public/inventory/v1/task` (create), update task (status/assignment fields), `add-task-photo` (completion evidence), People API for assignees. Not implemented: any write. |
| 5 | Quarterly reviews under Vendor management | **Missing (nav/ownership only)** | `/quarterly` sits in the Operations nav (`AppShell.tsx:87`). Records and paused scheduler fine. |
| 6 | Real files | **Missing** | `documents.storage_path` and `vendor_documents.storage_path` columns exist, but there is **no storage bucket and no upload/download code anywhere in `src/`** — every document row today is an `external_url` link. SharePoint sign-in is not file capability. |
| 7 | Asana replacement | **Partial** | Have: 150-task furnishing template, phases, assignment, due dates, evidence + approval gates, notes, handoff gate. Missing for daily use: subtasks, dependency enforcement, mention notifications, real attachments, plan variants beyond full furnishing. Asana still required today for attachments, subtasks and the expense-log tasks named in template text. |
| 8 | Active Owner guide alignment | **Partial — mapped in Section D** | Guide read. |
| 9 | Communication & notifications | **Partial** | Detailed in Section C. |
| 10 | Telegram | **Missing; bounded by platform limits** | No Telegram code. Template + field notes show it is the live channel for handyman, realtor, designer and per-property groups. |
| 11 | OwnerRez messaging | **Capability confirmed, not implemented** | Official v2 reference documents `GET /v2/messages?threadId=…` (thread fetch, `since_utc`, `include_attachments`) and `POST /v2/messages` (create message, with channel enum incl. Airbnb/Vrbo/Booking). Our code uses GET-only reservation/guest lookup (`ownerRezGet`). Capability ≠ access: our token's scope for messages is unverified and must be tested read-only first. |

## B. Terminology recommendation (one, for approval)

Adopt **Request** (Operations) with **Work Order** used *only* for a linked external field job (Breezeway), created one-per-dispatch and never automatically; **Project → Task → Subtask** for Onboarding; **Action, Approval, Participation Entry** for Active Owner.

Duplication risk to avoid: if Work Order becomes a full internal record, every staff-handled Request gains a shadow record with its own status and SLA, and Breezeway retries fan out. Keep Work Order as a child link record (external id + origin), not a second queue. Likewise the owner **Action** must be the owner-facing view of an existing onboarding **Task**, not a separate record.

## C. Communication and notifications — capability by channel

| Channel | How sent | How received | Linked to record | Delivery evidence |
|---|---|---|---|---|
| Internal comments / mentions | `ticket_activity` insert; `extractMentions` parses "@name" | Visible on the matter only | Yes (ticket_id) | None — **queue only, nobody is notified** |
| In-app notifications | Owner side only (`owner_notifications`, DB trigger) | Owner portal | Yes | Read/sent flags on owner rows; **no staff notification store at all** |
| Browser / mobile push | Not implemented | — | — | — |
| Email | Microsoft Graph, send path fixed to `/users/<info@arealhomeaway.com>/sendMail`; no `/me`, no dynamic mailbox (`mailbox-allowlist.server.ts`) | Inbox read restricted to the same mailbox's Inbox folder; intake creates matters | Yes, via intake linking | `email_log` rows record sends; bounces not tracked |
| External guest / owner / vendor messaging | Not implemented (owner alerts are in-app + email only) | — | — | — |

Mailbox restriction: **application behaviour is verified in code** (single allowlist entry, every Graph path built through it, throws + logs otherwise). **Microsoft-side restriction is unverified** — an ApplicationAccessPolicy or equivalent tenant scoping screenshot from your admin is the missing evidence. No permission change proposed.

Telegram limits, stated plainly: a bot can only see groups it has been added to, cannot read history from before it joined, cannot join as a person or DM users who have not started it first, and in privacy mode sees only messages addressed to it. So Resolve can host **new** vendor/team threads (per-property group with the bot added, replies from Resolve) but cannot absorb existing Telegram conversations or the two years of history. Minimum practical step: bot in one pilot property group, inbound stored and linked to the property, replies sent from the Request — nothing else. Recommend not connecting until you decide which conversations move.

## D. Active Owner guide alignment (map + gaps)

Aligned: Day 1 = day after confirmed closing (matches the program clock); manual actual-minutes logging with date/task/property/action/output; shared work counted once; the >100-hour goal treated as a goal; approvals tied to a specific request; reported vs ARHA-approved distinction.

Gaps to resolve (no policy invented):
1. **Action key** — the guide defines 8 action types (Approve only, Review and comment, Review and decide, Provide information, Action or payment required, Attend and respond, Information only, Research and recommend). The app models approval / evidence / time only.
2. **Meetings** — 6 named meetings plus day-30/60/90 reviews, each with a lead role, are not records; agenda-1-business-day-before and decisions-within-1-business-day are not tracked.
3. **Statuses** — guide uses Not released, Ready, In progress, Submitted, Team review, Complete, plus Awaiting owner approval / Approved / Changes requested / Declined, Blocked, Not applicable. The app has a shorter set.
4. **Versioning** — material revision must issue a new version and a new deadline; not implemented.
5. **Due dates** — business days Mon–Fri excluding US federal holidays, property-local time zone, 5 p.m. cutoff, counted from the next business day; not implemented.
6. **Roles** — guide names individuals; app should keep titles (Director of Onboarding, Project Manager, Operations Supervisor, Director of Operations).

## E. Handover for Claude (do not reimplement here)

**Assignment rules — sources that already exist** (no approved matrix table exists anywhere; do not invent one):
- Golden rule, recorded: *the property determines the Pod; priority and time determine who acts* (project memory `mem://features/arha-ticket-model.md`, restated in `src/lib/coach.server.ts`).
- Priorities are P1–P4, stored lowercase; SLA minutes and required closure evidence come from the `work_types` catalog, never hardcoded.
- Ownership fields and their meaning: `record_owner` (accountable end to end), `current_action_owner` (must act next), `assigned_to` (working assignee), `pending_handoff_to`; helpers in `src/lib/matters.ts`; server rule is RLS `private.can_edit_ticket`.
- Handoff rule: not complete until accepted; originator stays responsible (`handoffs`, `handoff_reviews`, `HandoffPanel.tsx`).
- Coverage data available: `departments`, `department_members`, `functional_roles`, `cleaning_regions`, `property_vendor_coverage`, `properties.region`.
- Audit sink: `ticket_activity` (+ `audit_log` trigger `audit_ticket_change`).
- **Missing decisions Claude cannot derive** — default responsible role per work-type category × pod/market; coverage hours per pod; the fallback ladder when nobody is eligible (Pod queue → Supervisor → Director of Ops?); whether a suggested assignee auto-commits after N minutes.

**Contact-source specification:**
- Guest: OwnerRez only, matched by `properties.ownerrez_property_id` — never by property name, never a demo row (`tickets.is_demo`/`properties.is_demo` short-circuit). Existing implementation: `src/lib/ownerrez.server.ts` (`currentGuestForListing`, `stayForListing`) behind `getGuestContext`.
- Owner contacts: Resolve database (`owner_programs`, `owner_program_properties`, `profiles`) — not OwnerRez, not typed in.
- Visibility: capability `guest_contact` (admin/manager/tech). Vendors and homeowners must never receive guest contact data in a payload, not just in the UI.
- Vacant / multiple / upcoming reservations need an explicit rule from Emily: show current stay only, or current + next arrival.

## F. Phased build plan (what enables a complete Operations workday)

- **Phase 0 — facts only:** confirm our OwnerRez token can read `/v2/messages` (read-only probe, approval requested first); confirm Breezeway task-create required fields against `developer.breezeway.io`; obtain Microsoft access-policy evidence.
- **Phase 1 — real files** (first bounded task, below). Unblocks evidence, Asana replacement, vendor docs.
- **Phase 2 — assignment** *(Claude)*, needs the missing decisions above.
- **Phase 3 — contact context** *(Claude)*.
- **Phase 4 — staff notifications**: notification store + in-app bell for assignment, mention, handoff, breach; delivered/failed surfaced from `email_log`. No push in beta.
- **Phase 5 — Breezeway linked Work Order** (needs Phase 0 + dispatch approval): `work_orders` link record with `request_id`, `external_system`, `external_id`, `origin`, idempotency key; the receiver updates that record instead of only logging events; retries update, never insert.
- **Phase 6 — quarterly reviews move under Vendor management** (nav + ownership only, records untouched, scheduler paused).
- **Phase 7 — Onboarding parity** (subtasks, dependencies, mentions, plan variants).
- **Phase 8 — Active Owner guide alignment** (action types, meetings, statuses, versioning, business-day due dates).
- **Phase 9 — messaging** (OwnerRez threads, then a single Telegram pilot group) only after Phase 0 and your channel decision.

## G. Blocking decisions / approvals

1. Assignment matrix decisions listed in Section E.
2. Terminology approval (Section B).
3. Vacant / multiple-reservation display rule.
4. Approval for a read-only OwnerRez `/v2/messages` probe.
5. Approval for a bounded Breezeway write test before any dispatch ships.
6. Microsoft-side mailbox restriction evidence, or acceptance of app-side enforcement for beta.
7. Which Telegram conversations must move into Resolve.

## H. Recommended first bounded task

**Real file attachments on an Operations Request.** One private storage bucket with staff-scoped policies, upload + list + signed download on the matter detail screen, persisting `documents.storage_path`; proven with a real photo, a video and a PDF on a demo matter, including that a vendor and a homeowner cannot read them. No SharePoint write, no external write, no live data touched. It does not overlap Claude's branch.
