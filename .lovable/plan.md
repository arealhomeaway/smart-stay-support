# Admin UX, View As & Demo Environment — audit and plan

## Part 1 — What exists today

**Application areas (portals).** Defined in one registry, `src/lib/portals.ts` — not scattered through pages. Active entries: Operations, Vendor, Onboarding, Active Homeowner, Executive Oversight. A sixth entry, Finance, exists in the registry but is marked `active: false` and has no routes, no data, no screens. Nothing renders it.

**Routes.** All signed-in screens live under one gated layout. Today: dashboard, hub, command-center, oversight, analytics, tickets (list / new / detail), quarterly, map, coach, playbooks, properties, vendors, owner-programs, owner, onboarding, team, integrations, audit, welcome, join, vendor jobs (list / detail / scorecard). Public: overview page and sign-in.

**Authentication.** Already one identity, one login. A single sign-in page, a single gate on the signed-in area, and the same session everywhere. There are no separate auth systems per portal. Nothing in this project needs a second account.

**Roles and permissions.** Six roles stored in a dedicated roles table: Platform Owner (admin), Supervisor, Onboarding staff, Staff, Vendor, Homeowner. Permissions are expressed as named capabilities in `src/lib/permissions.ts` and mapped per role; navigation and pages read capabilities, never role names. The database enforces the same via row-level security and role-checking functions.

**Routing after login.** Sign-in resolves the person's roles, then sends them to their single portal if they only have one, or to the Hub if they have several. A requested destination is honoured only if it is a real registry route.

**How Matters move.** A Matter (ticket) carries priority, work type, assignee, vendor, status and a waiting state; the work-type catalog supplies SLA minutes, required closure evidence and the playbook. Movement between people is recorded as handoffs (not complete until accepted) and as timeline rows in the activity table. Vendor jobs, visits, approvals, owner reviews and quarterly reviews all hang off the same Matter.

## Part 2 — Why administering it is clunky today

1. **View As is cosmetic.** It narrows the menu and switches the app to read-only, but every query still runs as your admin account. You see admin-visible data inside a member's chrome, and you cannot take any action — so it cannot answer "does this workflow actually work?"
2. **Two navigation systems compete.** The sidebar is a hand-grouped list; the Portals menu is registry-driven; the Hub is a third. They can disagree, and portal names appear in three places.
3. **No demo data and no safe place to act.** Testing means touching live matters, live vendors and live homeowners — and the email engine will really send.
4. **No map of the system.** Nothing tells you what areas exist, what state they are in, or which integrations are connected.
5. **The Finance entry is dead weight** and, per your scope rule, should be removed rather than carried.

## Part 3 — What is reusable vs. missing

Reuse as-is: authentication, the roles/capability model, the portal registry, the Matter model, handoffs, the activity timeline, the work-type catalog, the Hub, the global search jump list.

Missing: real perspective switching, a demo data layer, an admin platform map, a workflow trace view, and a health/testing view.

## Part 4 — Recommended approach

**View As — make it real, not cosmetic.** Keep the current session and audit actor as you. Add a demo persona per role: a real account row that exists only for demo purposes. When previewing, the app reads through that persona's permissions, so you see exactly the data and actions that role gets — including the ones it is denied. Writes are allowed **only** against demo records; against live records the preview stays read-only. The banner becomes `ADMIN PREVIEW — Viewing as: <role>` with **Switch view** and **Exit preview**, persistent while you navigate.

**Demo Mode — same app, flagged data.** Add one `is_demo` flag to the record types that participate in workflows (matters, activity, handoffs, approvals, vendor jobs/visits, properties, vendor companies, owner programs and their reviews/notifications). Demo Mode is a toggle that filters every list to demo records, and stamps anything you create as demo. Live views never show demo rows. No parallel app, no duplicate screens, no duplicate workflow code — the same handlers run, so the test is meaningful.

**Safety.** One shared guard blocks outbound side effects when the record is demo: no email, no SMS, no external integration writes, no owner notifications leaving the system (they are still generated so you can see them arrive). Demo rows are excluded from analytics, the command centre, vendor scorecards and SLA metrics. A **Reset demo environment** button deletes all demo rows and re-seeds the scenarios.

**Roles/portals stay dynamic.** The role list comes from the database role type; the area list comes from the registry. Adding an area or role later means one registry entry — the switcher, Hub, platform map, View As list and health board all pick it up automatically.

## Part 5 — Scope of work

1. **Navigation consolidation.** Sidebar groups derive from the registry + capabilities so there is one source of truth. Add breadcrumbs on detail screens. Everything reachable in one or two clicks for an admin.
2. **View As v2** — persona-backed preview, interactive on demo data, persistent banner with switch/exit.
3. **Demo layer** — `is_demo` flag, filtering, creation stamping, side-effect guard, metric exclusion, reset.
4. **Seeded scenarios** — realistic ARHA situations, each one connected Matter carried end to end with a full timeline: AC not cooling with vendor estimate and approval; cleaning quality complaint after a mid-stay report; new-property onboarding through readiness and handoff acceptance; a missed SLA that escalates; an interdepartmental handoff that is returned before it is accepted; a routine matter closed first-touch; a multi-touch matter needing a second visit; a quarterly review cycle. Where a step really happens outside Resolve today (for example a phone call to a vendor), the timeline says so instead of pretending.
5. **Workflow trace** — for any Matter, a stage strip generated from its own history plus the work type's required stages; selecting a stage shows how the Matter looked to that participant.
6. **Platform map** (admin-only) — one row per existing area: purpose, roles, status, key features, integrations, open/view/manage links. Status comes from real signals (route exists, data present, integration connected, last successful sync).
7. **System health / testing board** — per area and per workflow function (access, creation, assignment, routing, checklists, approvals, notifications, escalation, closure evidence, closure, permissions, integrations, cross-area handoffs). Status is derived where derivable and otherwise shown as *Needs testing* — never faked green.
8. **Regular-user experience** — unchanged in shape, verified: no admin controls, no demo affordances, straight to their area after login.
9. **Remove the inactive Finance registry entry.**

## Part 6 — Risk and what stays untouched

Not rebuilt: authentication, the roles/RLS model, the Matter schema, existing workflows, integrations, the Coach, quarterly automation, vendor sourcing/import.

The three things to watch, each handled explicitly: metric queries must exclude demo rows (one shared filter, applied everywhere); the email/SMS engine must respect the demo guard; and the sidebar rework must not change what any non-admin role can see — role visibility is verified per role before this ships.

## Part 7 — Recommendations for later (not built now)

Demo scenario authoring UI for non-engineers; recorded guided tours per role built on the trace view; automated end-to-end workflow tests running against the demo layer nightly.

## Smallest safe order of delivery

1. Demo flag + safety guard + metric exclusion + reset (nothing user-visible yet)
2. Seeded connected scenarios
3. View As v2 on top of the demo layer
4. Navigation consolidation + breadcrumbs
5. Platform map, workflow trace, health board
