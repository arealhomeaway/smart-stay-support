# Contextual Playbooks — Implementation Plan v2

Two audit additions change the shape of this build: the permission gaps become Phase One blockers, and the Coach's existing guidance shape becomes the authored Playbook model instead of a new invention. Both simplify the architecture.

## 1. Playbook permissions — exact problem and fix

Current live state is better than the first audit implied, but still wrong. A later hardening migration (`20260821032206`) already replaced the fully-open policies with staff-level ones. What exists today:

- `playbooks_select` / `playbook_steps_select` — any authenticated user, including vendor and owner accounts.
- `playbooks_insert`, `playbooks_update`, `playbook_steps_write` (FOR ALL) — `is_staff()`, i.e. **every internal staff member can create and edit Playbooks**, not just holders of `playbooks_edit`.
- `playbooks_delete_admin` — admin only. Correct already.
- `/playbooks` route has **no capability check at all** — the new-playbook and add-step forms render for every internal user, and the writes succeed because RLS allows staff.

Proposed change: authoring gates on supervisor level (which is exactly who holds `playbooks_edit`: admin and manager), reading gates on internal staff.

```sql
-- Read: internal staff only. Vendors read steps through the ticket they are
-- dispatched on, not the Playbook library.
DROP POLICY IF EXISTS playbooks_select ON public.playbooks;
CREATE POLICY playbooks_select ON public.playbooks FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS playbook_steps_select ON public.playbook_steps;
CREATE POLICY playbook_steps_select ON public.playbook_steps FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

-- Author / publish / retire / version: supervisors only.
DROP POLICY IF EXISTS playbooks_insert ON public.playbooks;
CREATE POLICY playbooks_insert ON public.playbooks FOR INSERT TO authenticated
  WITH CHECK (public.is_supervisor(auth.uid()));
DROP POLICY IF EXISTS playbooks_update ON public.playbooks;
CREATE POLICY playbooks_update ON public.playbooks FOR UPDATE TO authenticated
  USING (public.is_supervisor(auth.uid())) WITH CHECK (public.is_supervisor(auth.uid()));
DROP POLICY IF EXISTS playbook_steps_write ON public.playbook_steps;
CREATE POLICY playbook_steps_write ON public.playbook_steps FOR ALL TO authenticated
  USING (public.is_supervisor(auth.uid())) WITH CHECK (public.is_supervisor(auth.uid()));
```

`playbooks_delete_admin` stays as is. Three enforcement layers, not one: RLS above, a `can(roles, "playbooks_edit")` guard around every edit control in `src/routes/_authenticated/playbooks.tsx`, and a capability check in the route's own loader/beforeLoad so a direct URL cannot reach the editor.

## 2. coach_sessions — exact problem and fix

Intended use: a staff member asks the Coach a question, gets guidance, optionally links the session to a ticket they create. Nothing in that flow requires one person to rewrite another person's session.

Current: SELECT and UPDATE are both `is_staff()` — any internal user can overwrite any session's guidance and follow-ups. INSERT is already correctly scoped to `auth.uid() = created_by AND is_staff()`.

```sql
-- Update only your own session (follow-ups, ticket linking); supervisors may
-- correct any session.
DROP POLICY IF EXISTS "Team can update coach sessions" ON public.coach_sessions;
CREATE POLICY "Team can update coach sessions" ON public.coach_sessions FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.is_supervisor(auth.uid()))
  WITH CHECK (created_by = auth.uid() OR public.is_supervisor(auth.uid()));
```

Read stays `is_staff()` — sessions are operational context on tickets that colleagues legitimately review, and vendors/owners are already excluded by `is_staff()`. No DELETE policy exists, so nobody can delete; that is fine and stays.

## 3. Three layers, fixed responsibilities

- **A — Workflow/policy truth (deterministic, code):** ticket SLA and work-type rules, `recovery-policy.ts`, `maintenance-policy.ts`, `claims.ts`, evidence requirements, closure gates. Owns authority, deadlines, escalation, closure, Next Action. Always wins.
- **B — Authored Playbook guidance (human-approved rows):** judgment, not thresholds. Never restates a dollar amount or an SLA; if it does, that is a defect to flag.
- **C — Coach (later):** may explain A and B conversationally. Never a third source of policy, never the v1 matcher.

Precedence is hard-coded and asserted by tests: workflow state → policy engine → approved Playbook → historical precedent (reference only, never rendered as instruction) → AI explanation. A Playbook whose text conflicts with a live engine value is flagged for review, never surfaced over it.

## 4. Minimal authored Playbook schema

Reuse the Coach shape (`RawGuidanceSchema` in `src/lib/coach-schema.ts`) as the authored template. Added to `playbooks`:

| Column | Type | Why |
| --- | --- | --- |
| `playbook_key` | text | Stable family identity across versions |
| `version` | int, default 1 | Versioning |
| `status` | text (`draft`/`active`/`retired`) | Replaces the bare `active` boolean over time; `active` stays for now |
| `effective_on` | date | When leadership's decision took effect |
| `approved_by` | uuid | Who approved it |
| `applies_to` | text[] | `ticket`, `work_order`, `recovery`, `claim` |
| `matcher` | jsonb | Deterministic match facts |
| `priority_reason` | text | Coach field — why this situation carries its weight |
| `risk_flags` | jsonb | Coach shape `[{title, why}]` — "Things to consider" |
| `immediate_actions` | text[] | Coach field — short judgment steps |
| `escalate_if` | text[] | Coach field |
| `vendor_brief` | jsonb | Coach shape `{scope, must_check, must_not_do, evidence_required, before_leaving}` |

Unique index on `(playbook_key, version)`.

**Dropped from the v1 audit proposal:** `escalate_when` — `escalate_if` already is that field, in the shape the Coach and the team already use. Also dropped: an authored `checklist` column (the existing `playbook_steps` table already is the checklist, and duplicating it invites drift) and an authored evidence list (the evidence architecture owns that). `clarifying_questions`, `guest_message`, `owner_note`, `read_back`, `suggested_title` stay Coach-runtime only — they are per-incident, not authored SOP.

No new tables in Phase One.

## 5. Coach content is reference, not SOP

Nothing in `coach-field-notes.ts` or any `coach_sessions.guidance` row is promoted automatically. Every candidate line is classified: approved/current, useful precedent requiring leadership review, obsolete/conflicting, or unsupported. Only approved/current becomes an active Playbook. No script converts old guidance into rows; a supervisor publishes each one.

## 6. Review of existing 13 Playbooks and Coach material

The 13 seeded Playbooks are step content only — they carry no risk flags, escalation, or vendor brief. None conflicts with policy because none states a threshold. All 13 stay exactly as they are in Phase One; six get authored guidance fields added on top.

| Launch Playbook | Existing steps | Coach/field-note material | Live engine supplies | Notes |
| --- | --- | --- | --- | --- |
| Active leak / water damage | Water leak + post-leak mold, 2 books | Water-shutoff rule, mitigation-before-repair precedent | Emergency mitigation authority, P1 SLA, evidence slots | Merge the two step books later, not now |
| HVAC no heat / no cooling | Present | HVAC precedent on temp thresholds and portable units | Priority floor, owner approval over $350 | Field notes mention comfort-item spend — thresholds must come from the engine, so authored text says "within your approval authority" |
| Lockout / access | Lockout + alarm-panel books | Access/code precedent | SLA, guest-impact priority | Straightforward; credentials stay in the encrypted store, never in Playbook text |
| Vendor dispatch / maintenance approval | Vendor dispatch and quote approval | `vendor_brief` structure, must-not-do rules, owner-preferred-vendor note | $350 threshold, second-quote advice, vendor miss ladder | Existing step text mentions approval flow generically — verify it states no number |
| Guest recovery | Guest compensation and claims decision | Guest-care and compensation precedent, "no promise before approval" | PC/supervisor/director authority, escalation flags | **Conflict risk:** legacy precedent describes older approval amounts; those lines are obsolete/conflicting and must not be authored in |
| Arrival quality failure | Present | Cleans precedent | Priority, evidence, guest communication requirement | Clean fit |

Content safe to activate now: the six step books above plus authored risk flags and escalation drawn from rules already encoded in the engines. Content requiring leadership approval before it can be authored: any compensation amount or approval ceiling from Telegram precedent, relocation handling, difficult-guest escalation wording, and evidence-before-accusation standards — none of which has an approved SOP today.

## 7. GuidanceCard contract

Rendered inline directly below Next Action, compact and collapsed, sections omitted entirely when empty:

- **Why this needs attention** — computed (A)
- **Things to consider** — authored `risk_flags` (B)
- **Suggested operational steps** — authored `immediate_actions` (B)
- **Escalation** — deterministic triggers first, authored `escalate_if` only appended
- **Required evidence** — existing evidence architecture
- **Vendor context** — `vendor_brief`, only when a vendor is engaged
- **View full Playbook** link

Next Action stays separate and primary. The existing copied `ticket_steps` "Resolution playbook" checklist is untouched and stays visually distinct — execution checklist above, judgment guidance below. Long-term recommendation: keep the copied-step model (it correctly freezes what was asked of the person at the time) but stop copying automatically once contextual matching proves out; no change this phase.

## 8. Resolver contract

```ts
matchPlaybook(context: MatchContext): MatchResult
// context: objectType, workTypeId/name, situationId, priority, stayImpact,
//   occupancy, authorityResult, escalationFlags[], warrantyApplies,
//   vendorMisses, evidenceComplete, deadlineState, propertySpecialHandling
// result: { primary?: MatchedPlaybook, secondary: MatchedPlaybook[]  // max 2
//           , reason: string  // why it matched
//           , version: string, hasApprovedGuidance: boolean }
```

Pure function, fully unit-tested, no AI, no network. Primary is the Playbook that explains the current Next Action. When nothing matches: live priority, authority, escalation, Next Action and evidence still render, followed by "No approved Playbook exists for this scenario." Raw Coach precedent is never substituted.

## 9. Phase One scope — files and tables

- Migration: policies above + `playbooks` metadata/guidance columns.
- `src/routes/_authenticated/playbooks.tsx` — capability gate on route and edit controls.
- `src/lib/playbook-match.ts` (new) + tests.
- `src/lib/playbooks.ts` (new) — types and authored-content accessors.
- `src/components/GuidanceCard.tsx` (new).
- `src/routes/_authenticated/tickets.$ticketId.tsx` — mount card below Next Action.
- Property special handling read live from `properties` into the card.
- Low-noise logging via existing `audit_log` (one shown-row per object per day, plus explicit opens).

Not touched: Work Orders, Guest Recovery, Claims, Breezeway, Notion, ticket step copying, any policy engine.

## 10. QA plan

**Security:** staff without `playbooks_edit` can read but cannot insert, update, publish, retire, or reach the editor by direct URL (verified against the database, not just the UI); manager can do all of it; vendor/owner can read neither Playbooks nor Coach sessions; a staff member cannot update another user's Coach session while their own flow still works end to end.

**Functional:** the eight audit scenarios (P1 flooding, $650 repair, $425 within policy, $100 outside policy, undisclosed pet, warranty vs. arrival, AirCover missing invoice, closure blocked on evidence) each show guidance consistent with Next Action; unmatched scenario shows the no-approved-guidance state; empty sections do not render; existing ticket checklist unchanged.

## 11. Risk and recommendation

Migration risk is low: additive columns plus policy replacements on two small tables. The one behavioural change staff will notice is that non-supervisors lose Playbook editing — intended, and worth calling out to the team before publishing. Rollback is a single policy revert.

**GO**, with the permission fix shipped and verified as Step 1 before any Playbook schema or UI work begins.
