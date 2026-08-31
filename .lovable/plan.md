# Resolve — Full App Status Report (Aug 31, 2026)

Shareable snapshot of what exists, what is verified, and what is still open. All figures below were read from the live database and repository today.

## 1. What Resolve is today

An internal operations platform for A Real Home Away covering five portals: Operations, Onboarding, Homeowner (Active Owner), Vendor, and Administration. TanStack Start (React 19, Vite 7) on Lovable Cloud (Postgres + auth + storage). 27 authenticated routes, 68 public tables, 65 applied migrations.

Access model: permission role (admin = Platform Owner, manager = Supervisor, onboarding, tech = **Staff**, vendor, owner) is separate from functional seat/team. Admin-only read-only "View As" preview exists.

## 2. Live data snapshot

| Area | Count | Note |
|---|---|---|
| Properties | 162 (6 demo) | 156 keyed to OwnerRez |
| Tickets | 444 (3 demo) | 437 open, all created Aug 21–25, all unassigned — this is the pre-launch Notion import, not live beta work |
| Work types (SLA catalog) | 21 | drives SLA minutes, closure evidence, playbook |
| Onboarding tasks | 724 | 150-task Full Furnishing template instantiated on demo projects |
| Owner programs | 4 | includes demo owners Riley Alder / Jordan Whitfield |
| Owner time entries | 26 | submit → approve → return → correct cycle verified |
| Approvals | 11 | Handoffs: 5 |
| Coverage shifts | 25 | On-call roster rows: **0** |
| Property owner contacts | 0 | OwnerRez directory import built, not yet run for real |
| Documents (file metadata) | 0 | `resolve-attachments` bucket effectively empty |
| Vendor orgs | 0 | vendor platform built, no real vendors loaded |
| Integration events | 13,150 | 386 created, 12,764 skipped |
| Breezeway webhook events | 3,999 | 3,978 other-property, 15 verify_failed, 2 processed, 1 duplicate, 1 stale, 2 invalid |

## 3. Built and verified

- **Operations**: ticket lifecycle, priorities P1–P4 (lowercase keys), SLA clocks from the work-type catalog, waiting state, closure evidence gates, oversight queue, handoff (not complete until accepted), immutable ticket activity log.
- **Schedule-aware auto-assignment**: `auto_assign_ticket()` trigger, Central time, DST-safe, with an exception queue and admin-managed overnight roster UI.
- **Onboarding**: 150-task Full Furnishing template, milestone recalculation, evidence capture, handoff gate now read by job title (Director of Onboarding review → Director of Operations review → Operations acceptance → Live confirmation).
- **Active Owner program**: single 90-day window (no 30/60 milestones), owner goal 100+ hours / internal operating target 105, manual-only time entry, staff review with return-and-correct, duplicate-correction prevention, "Reported hours" vs "ARHA-approved hours" labels, shared-property activity counted once.
- **Hours & Participation Report**: server-generated branded PDF + detail CSV, in-progress and automatic end-of-window, owner-scoped, no public links; validated against the portal for two demo owners.
- **Breezeway webhook**: signature verification, duplicate protection via unique index + conflict-aware insert, transient/permanent lookup classification, bounded manual retry. Merged (57c1b27), migration applied, published; 8/8 fixture self-test passed.
- **Email intake** (Microsoft Graph, info@arealhomeaway.com): claim-first duplicate protection, category routing, 11 concurrency tests.
- **File storage phase 1**: private `resolve-attachments` bucket + documents metadata + RLS + staff/owner panels (built, holding for the combined Operations release).
- **Vocabulary pass**: "Inspection" now reads **Assessment** in all user-facing labels; `tech` displays as **Staff** everywhere.
- Tests: 46+ unit tests passing; typecheck clean; production build passing.

## 4. Open blockers

1. **Staffing** — of the five functional seats, only **James Almario has redeemed** (manager, Aug 31). Romeo Canales, Avy Vergara, Mike Cacatain, Christine Sendico are still **Pending** (codes ROMC-8T3W, AVYV-6H2N, MIKC-9R5D, CHRS-3F8Q; expire Sep 30). Micah Sinor and Josh Dunham invites also unredeemed. Real profiles today: Emily, Micah, James — the rest are QA/demo accounts.
2. **September overnight roster not entered** (0 rows) — overnight routing has no target person.
3. **SharePoint write access not granted.** Site ARHA Resolve and its "Documents" library are identified and empty. App path is delegated `Sites.Selected` under resolve.integration@; a separate unlinked workspace connection still holds tenant-wide `Sites.ReadWrite.All` / `Sites.Manage.All` and should be narrowed. Needs a tenant-admin site-level **write** grant on `/sites/ARHAResolve` only.
4. **No natural Breezeway event has processed yet** — only fixtures. Awaiting a real task update on 9211 Fitzgerald or approval for a controlled test.
5. **437 imported pre-launch tickets are open and unassigned** and will distort any beta analytics unless excluded or archived.
6. **Property Hub not started** (all eight tabs), current-PID import not started, Operations ticket analytics not started.

## 5. Explicitly out of scope for beta

No historical migration: old tickets, archived pre-launch tickets, Asana/Notion history, legacy documents, old SharePoint/OneDrive folders, historical Breezeway work, productivity backfill. Analytics start from clean non-demo beta activity with a visible "analytics start date" label.

## 6. Critical path

**By Sep 4**
- Current-PID import and field mapping (facts, contacts, external ids, operating instructions, onboarding status)
- Property Hub tabs 1–5 polished (Overview, Property Details, Contacts, Onboarding, Operations) as one consistent application
- Active Owner staff/exec analytics with filters and CSV
- Analytics start-date label; exclude the 437 imported pre-launch tickets and demo records from live reporting
- Enter the September overnight roster (needs your input)

**Week of Sep 7**
- SharePoint-backed uploads (blocked on the site-level write grant), Documents & Media tab
- Approvals with versioned owner-visible files, Activity tab
- Operations ticket analytics: volume, median + average response/resolution, SLA met/breach/at-risk, assignment and handoff credit from the immutable activity log, team filters, CSV export (America/Chicago, timezone in export)
- Accuracy tests (demo/archived excluded, shared activity once, superseded/returned excluded, SLA timestamps, no handoff double-count, Central-time boundaries, CSV = dashboard)
- My Active Projects + handoff review by job title; 5-account demo validation

## 7. Decisions needed from you

- Archive or exclude the 437 imported pre-launch tickets?
- Chase the four unredeemed staff invites, or reissue?
- Request the tenant-admin SharePoint site-level write grant now, and narrow/retire the tenant-wide "ARHA Sharepoint Folder" connection?
- Approve a controlled live Breezeway test on 9211 Fitzgerald?
