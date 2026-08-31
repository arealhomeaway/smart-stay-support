# Resolve — Build History and Remaining Work

A single narrative of how this app was built, where it stands today, and what is left. Written to be shared with a collaborator.

## Part 1 — How we built it

### Stage A: The core idea (Matter Model)
Started from your Notion ticketing setup and the SOP PDFs. Established the Golden Rule that still governs routing: **the property determines the Pod; priority and time determine who gets the task.** Built the ticket ("matter") model with priorities P1–P4, a work-type catalog that drives SLA minutes, required closure evidence and playbook (never hardcoded in components), a waiting state, and an immutable activity log. Added ARHA branding, an onboarding tour, RBAC, analytics scaffolding, and the first Notion / OwnerRez / Breezeway integrations.

### Stage B: Quarterly reviews and the Active Owner program
Ported the Notion quarterly cleaning-supervisor checklists into a real work type with due-date rollover and a /quarterly page. Built the 90-day Active Owner participation program for the STR tax-exception project, with the hard rule you set: **all participation time is manually entered by the homeowner, never prefilled.** Added the portal switcher, admin read-only "View As", and the unified invite system.

### Stage C: Roles, command center, handoff
Replaced ad-hoc roles with a scalable model: admin (Platform Owner), manager (Supervisor), onboarding, tech (**displayed as Staff**), vendor, owner — kept deliberately separate from functional seat/team. Built the Executive Command Center, the gated Onboarding workspace, the formal property handoff workflow (**a handoff is not complete until accepted; the original owner stays responsible**), and the vendor platform with masking, screening and compliance. Vendor scorecards are private points/tiers with anonymous percentile — never a public leaderboard, and no timers/points/leaderboards for internal staff.

### Stage D: Microsoft, mail intake, workspace move
Built email intake through Microsoft Graph from info@arealhomeaway.com with category routing and a claim-first mechanism so retries can't duplicate tickets. Project moved workspaces; reconnected Google Maps, Outlook and Notion. Audited Microsoft file access and confirmed the app path is narrow (delegated `Sites.Selected`, resolve.integration@) and points only at the ARHA Resolve site.

### Stage E: Launch stages 1–3
Stage 1 Operations MVP (queues, SLA clocks, oversight), Stage 1.1 guest matching plus an isolated demo environment, Stage 2 Onboarding portal with handoff gates, Stage 3 Active Owner portal. Registered the Breezeway pilot webhook scoped to 9211 Fitzgerald Dr.

### Stage F: Onboarding template and owner approvals
Extracted the real 150-task Full Furnishing template from your exports. Split owner requirements into **evidence-only** versus **explicit owner approval** (mood boards etc.). Fixed task-dialog state leaks and the evidence capture UI. Produced executive and onboarding walkthrough videos (including the 8:25 Kati Hand onboarding walkthrough on the Bluestem Way demo property).

### Stage G: Active Owner hardening and the participation report
Tested the whole owner journey end-to-end with Playwright: invite redemption by a fresh account, sign-out/sign-in persistence, submit → approve, return → correct → approve with no double counting, duplicate correction blocked. Settled the labels: **"Reported hours"** (pending + approved) vs **"ARHA-approved hours."** Then built the self-serve Hours & Participation Report — server-generated branded PDF plus detail CSV, owner-scoped, no public links, in-progress and automatic end-of-window versions, shared-property entries counted once, out-of-period entries listed separately.

### Stage H: Breezeway webhook correctness (PRs, review, release)
Diagnosed the "signature verification" failures as **verify_failed** — transient Breezeway re-fetch errors (HTTP 500), not auth rejections. Reviewed Claude's PR across three rounds in an isolated scratch copy, fixed a regression where Bun test types leaked globally, verified the migration on a disposable Postgres, then applied it live, merged (57c1b27) and published. Closed a concurrent-duplicate-delivery gap with a unique index plus conflict-aware insert. 46+ tests, clean typecheck, passing build, and an 8/8 fixture-only self-test after publish.

### Stage I: Real file storage and the Operations release
Built the private `resolve-attachments` bucket with documents metadata and RLS, staff upload/view/remove, owners seeing only shared files, wired into ticket detail and onboarding evidence. Integrated PR #2 (operations assignment + contact context) into main while preserving branding and file storage: schedule-aware auto-assignment via an `auto_assign_ticket()` trigger (Central time, DST-safe) with an exception queue, an admin-managed overnight on-call roster, and a read-only primary-owner directory from OwnerRez.

### Stage J: Vocabulary, invitations, meeting alignment
Renamed **Inspection → Assessment** in every user-facing label (internal keys unchanged) and made `tech` display as **Staff**. Created five email-bound single-use invites and emailed the codes. From the Aug 31 meeting with Kati: single 90-day owner review (no 30/60), owner goal 100+ hours with a 105 internal operating target, assessment report is save-only with bids only when the Realtor asks, handoff gate steps read by job title, and carryover work belongs to Operations after handoff with a named owner and due date.

### Stage K: SharePoint architecture audit (read-only, complete)
Confirmed the intended split — **OwnerRez owns identity, Resolve owns PID/onboarding/ops records, SharePoint owns file bytes.** Site and Documents library identified and empty (clean slate). Found the one real conflict: a separate, unlinked workspace connection holding tenant-wide `Sites.ReadWrite.All` / `Sites.Manage.All`. Nothing was changed, moved, granted or published.

## Part 2 — Where it stands right now

162 properties (156 OwnerRez-keyed, 6 demo) · 444 tickets (437 of them the unassigned pre-launch Notion import from Aug 21–25) · 21 work types · 724 onboarding tasks · 4 owner programs, 26 time entries · 11 approvals, 5 handoffs · 25 coverage shifts · 3,999 Breezeway webhook events (2 processed, 15 verify_failed) · 0 documents, 0 vendor orgs, 0 on-call roster rows, 0 owner-contact rows.

**Open blockers**
1. Four of five staff seats still vacant — only **James Almario has redeemed** (Aug 31). Romeo, Avy, Mike and Christine are pending; Micah Sinor and Josh Dunham invites also unredeemed.
2. September overnight roster is empty, so overnight routing has no target person.
3. No SharePoint write grant yet; the tenant-wide connection still needs narrowing.
4. No natural Breezeway event has processed — fixtures only.
5. The 437 imported pre-launch tickets will distort beta analytics unless archived or excluded.
6. Property Hub, current-PID import, and Operations ticket analytics are not started.

## Part 3 — What we still need to complete

**Explicitly out of scope for beta:** all historical migration (old and archived tickets, Asana/Notion history, legacy documents, old SharePoint/OneDrive folders, historical Breezeway work, productivity backfill). Analytics start from clean non-demo beta activity with a visible start-date label.

**By Sep 4**
- Import and map the current authoritative PID field set (facts, contacts, external identifiers, operating instructions, onboarding status) so nobody opens Notion again
- Property Hub tabs 1–5 polished as one application: Overview, Property Details, Contacts, Onboarding, Operations — shared header, consistent status, real empty/loading/permission/error states, no fake data
- Active Owner analytics completed: owner-facing view plus staff/exec program view with filters and CSV
- Analytics start-date label; exclude demo and imported pre-launch records from live reporting
- Enter the September overnight roster (needs your input)

**Week of Sep 7**
- SharePoint-backed uploads once the site-level write grant lands, then Documents & Media
- Approvals with versioned owner-visible files (every package carries at least one file), then Activity
- Operations ticket analytics: volume, median **and** average response/resolution, SLA met/breach/at-risk, assignment and handoff credit derived from the immutable activity log rather than crediting the closer, team filters, CSV export in America/Chicago with timezone included and PII/credentials excluded
- Accuracy tests: demo and archived excluded, shared owner activity counted once, superseded and returned entries excluded, pending vs approved distinguished, correct SLA timestamps, no handoff double-count, Central-time date boundaries, CSV totals equal dashboard totals
- My Active Projects and handoff review by job title; five-account demo validation

**Then (deferred past beta):** Property Hub tabs 6–8 depth, read-only Notion PID inventory and reconciliation report, advanced analytics, retention rules.

## Part 4 — Decisions I need from you

- Archive or just exclude the 437 imported pre-launch tickets?
- Chase the four unredeemed staff invites, or reissue them?
- Request the tenant-admin SharePoint site-level write grant now, and narrow or retire the tenant-wide connection?
- Approve a controlled live Breezeway test on 9211 Fitzgerald?
