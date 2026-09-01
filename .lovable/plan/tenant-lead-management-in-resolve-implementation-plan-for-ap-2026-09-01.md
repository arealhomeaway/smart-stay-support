# Tenant Lead Management in Resolve — implementation plan (for approval)

Read-only pass. Nothing built, no schema applied, Notion untouched.

## 0. One blocker to clear first

The Notion connection can currently see 478 objects and 12 databases (PID, Onboarding
Information, Onboarding Project, the pilot databases, Micah Priority List). The
**Tenant Lead Management Database** and **Lead Management Guide V1 — Current** are
**not shared with the Resolve integration**, so a field-level audit of them is
impossible right now. A search for "Lead" returns nothing.

Two options, both fine:
- Share those two Notion items with the Resolve integration and I run the field audit
  (read-only) before or during Phase A; or
- Approve the pipeline/loss-reason model described in your brief as the source of truth,
  and I reconcile the exact field list later when access exists.

Everything below is designed so the second option does not block the build.

## 1. Current Resolve architecture relevant to Leads

- Work happens in `tickets` (95 columns) with `work_types` driving SLA minutes, closure
  evidence and playbook — 24 active types across 8 categories. One type,
  **"Tenant lead tracker"** (category `guest`, bucket `future_reservations`, P3, seat
  `ge_day`), is the current stand-in for lead work. It is a ticket, not an opportunity
  record, so it has no stage, follow-up clock, contact log, loss reason or conversion.
- Assignment/eligibility already exists: `functional_roles`, `coverage_shifts`,
  `coverage_overrides`, `oncall_roster`, `coverage_triage_windows`, `src/lib/coverage-model.ts`.
- Permissions: `src/lib/permissions.ts` capability model (`matters_all`, `matters_assigned`,
  `analytics`, `oversight`, `user_management`), `user_roles` + `has_role()` in the DB.
- Presentation kit to reuse verbatim: `src/components/ui/page.tsx` (`PageHeader`,
  `SectionCard`, `StatTile`, `Chip`, `StageRail`, `ProgressRing`, `SegmentedControl`,
  `EmptyState`), `src/lib/semantic.ts` ownership/state/module chips, the motion utilities
  (`resolve-rise`, `resolve-press`) added in the ticket pass.
- The closest architectural precedent is Onboarding: a **read-time derivation module**
  (`src/lib/onboarding-workflow.ts`) plus a table view and a task drawer. Leads copies
  that shape — derivation in code, not in extra database columns.
- Properties (157, OwnerRez-authoritative) and `property_owners` already exist; leads link
  to them, never duplicate them.

## 2. Notion lead logic being carried forward (from your brief)

Stages: Have Not Contacted Yet → Contacted (First Communication) → First Follow-Up →
Second/Final Follow-Up → Converted / Booking Confirmed → Lost, plus handoff/escalation
states. Loss reasons, lead source, market, bonus fields, notes, property relation and a
work-ticket relation exist in the current database.

## 3. Field classification (applies to whatever the Notion audit confirms)

- **Retain (operationally required):** contact name, company/organization, phone, email,
  preferred contact method, lead source, market, desired move-in, length of stay,
  bedrooms/size, budget, requirements/notes, assignee, stage, loss reason + note,
  converted date/by, linked property/properties, linked tickets.
- **Derive (never stored, computed read-time):** next follow-up due, overdue/due-today/
  upcoming bucket, follow-up number, days since last contact, lead age, stale flag,
  next action, attention/manager-review flags, time-to-first-contact, time-to-conversion.
- **Secondary (drawer only, not the row):** pets, date flexibility, quote details,
  candidate property notes, insurance/relocation sub-fields, internal notes.
- **Exclude:** Notion formulas/rollups/buttons, view-state and checkbox clutter,
  duplicated market/name strings, any credential-shaped value (permanent exclusion).
- **Needs your decision:** bonus/commission fields (kept out of v1 unless you want them),
  booking-probability scoring (excluded until ARHA has a methodology), estimated revenue
  (stored only where a real rate exists — no fabricated financials).

## 4. Stage mapping

| Notion concept | Resolve stage (stored) | UI label |
|---|---|---|
| Have Not Contacted Yet | `new` | New |
| Contacted — First Communication | `first_contact` | First contact sent |
| Contacted — First Follow-Up | `follow_up_1` | Follow-up 1 |
| Second / Final Follow-Up | `final_follow_up` | Final follow-up |
| (active conversation) | `engaged` | Active / engaged |
| (quote/booking in progress) | `booking_pending` | Booking pending |
| Converted / Booking Confirmed | `converted` | Converted |
| Lost | `lost` | Lost |

Handoff/escalation states in Notion become a **derived** `needs_attention` /
`manager_review` flag, not extra stages — escalation is a condition, not a place.

## 5. Follow-up automation rules (configurable, seeded)

Logging contact sets `last_contact_at` and proposes the next stage. Resolve then derives
`next_follow_up_at` from stage: first contact +2 days, follow-up 1 +4 days,
final follow-up +7 days, engaged/booking pending +3 days. Buckets: upcoming (future),
due today, overdue (past). After final follow-up lapses, the lead surfaces a prompt —
**close as lost, or keep open with a reason** — never an automatic close. Converted and
lost leads stop generating follow-ups. No cron, no duplicate task records: the queue is
computed from `last_contact_at` + stage on every read.

## 6. Leads Home (action first)

Compact strip: Needs attention · Follow-up due · New/uncontacted · Waiting on prospect ·
Booking pending · Converted this month. Then the queue in fixed order: **Overdue ·
Due today · New · Waiting on me · Upcoming**, with an "You're caught up" empty state.
A restrained momentum line ("6 of 8 lead actions completed today") and a small
✓ Booking converted microinteraction on convert. No giant dashboard, no confetti.

## 7. My Leads

Default filter = assigned to me. Row: contact/company · source · market · move-in ·
length · budget · stage · last contact · **next action** · next follow-up · assignee,
with compact indicators (insurance, relocation, urgent move-in, high value, needs
property match, waiting on client/internal). Below ~1024px the row collapses to contact,
stage, next action, follow-up, assignee; everything else lives in the drawer. No
horizontal scrolling for normal work.

## 8. Lead detail workspace

Right-side drawer (same pattern as the onboarding TaskDrawer), with sections: Header
(lead, company, stage, assignee, market, move-in, potential value, next action, next
follow-up) · Contact · Housing need · Opportunity (candidate properties, quote status,
rate, quote date) · Activity timeline · Next action block with the primary button.
Quick actions: Log call / email / text / other, Add note, Change stage, Link property,
Link ticket, Convert, Close as lost.

## 9. Lead creation

One short screen with progressive disclosure: contact name, phone/email, source, market,
move-in, length, bedrooms, budget, assignee, notes. Source-conditional fields only —
Insurance reveals insurer, adjuster/coordinator, claim reference, special requirements;
Relocation reveals relocation company, coordinator, employer. Direct shows neither.
On save, stage = New and next action = "Send first response".

## 10. Manager view

Capability-gated (`matters_all`). Summary: open, new today, overdue follow-ups, no recent
activity, booking pending, converted this month, lost this month. Table adds assignee,
age, attention reason, potential value, with visual treatment for overdue, stale,
unassigned, high-value, move-in approaching, no property match. Same drawer on click.
Reassignment is supervisor-only.

## 11. Conversion and loss

Convert records date, closer, linked property, optional reservation reference, stops
follow-ups, keeps the full activity history, feeds analytics. Loss requires a reason from
a fixed list (unresponsive, went with another option, budget too low, no properties
available, outside inventory coverage, requirements not met, expired, dates did not work,
other) and a mandatory note when Other. Nothing is deleted or archived out of reporting.

## 12. Analytics from real data only

Leads received, by source, by market, conversion rate, conversions, lost, loss reasons,
average time to first contact, follow-up compliance, average time to conversion.
Revenue metrics render only where a real quoted/converted rate exists — otherwise the
tile is omitted, not estimated. Filters: date range, source, market, assignee.

## 13. Backend changes genuinely required

New tables (with GRANTs, RLS, updated_at triggers), no changes to existing tables:
- `leads` — contact/company/phone/email/preferred channel, source, source detail JSONB
  (insurance/relocation fields), market, move-in, length, bedrooms, budget, requirements,
  stage, assigned_to, last_contact_at, quote fields, converted_at/by/property_id,
  reservation_ref, lost_reason, lost_note, created_by.
- `lead_activity` — timestamped channel/outcome/note/actor/stage-change rows (the timeline).
- `lead_properties` — candidate property links (references `properties`, no duplication).
- `lead_tickets` — optional link to existing `tickets`. Nothing in `tickets` changes.
- Enums for stage, source and loss reason.

RLS: staff read all leads; coordinators write their own assigned leads; supervisors/admin
write and reassign all; vendors and owners have no access.

## 14. Buildable without backend changes

Every derivation (next action, follow-up dates, buckets, attention flags, analytics
aggregation), the whole UI, navigation, drawer, creation flow and manager view.

## 15. Risks

Low. No changes to tickets, work_types, routing, Breezeway, OwnerRez, credentials,
coverage or onboarding. The one contact point is the optional lead↔ticket link table.
The "Tenant lead tracker" work type stays exactly as it is; I will not retire it in this
pass. Properties are read-only from Leads.

## 16. Transition from Notion

New leads start in Resolve on day one. Active Notion leads: staff re-key only those still
being worked (typically a small set) as they touch them — no bulk import tonight; closed
history stays in Notion. Notion goes read-only reference for 30 days, then the workflow
is retired once one full follow-up cycle, one conversion and one loss have been recorded
in Resolve. No Notion writes at any point.

## 17. Build sequence

A. (Optional) Notion field audit once shared → B. Schema migration for your approval →
C. Leads nav destination + Leads Home queue → D. My Leads table and drawer →
E. Creation flow → F. Contact logging + automatic follow-up transitions →
G. Convert / lost → H. Manager view → I. Analytics tiles → J. QA against your six
scenarios (insurance, organic, unresponsive, lost-for-inventory, converted, overdue),
full test suite and typecheck, then publish on your word.

Navigation: I will add a **Workflows** group containing **Leads** only. Claims, Cleaning
Reviews, Guest Reviews and Work Orders are not part of this pass and I will not add dead
links for them.
