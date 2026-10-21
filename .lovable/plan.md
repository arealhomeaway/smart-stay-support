# Simplification Pass 1 — read-only follow-up report (commit 1f872f78)

Nothing was edited, published or written. This is the read-out, not a build plan. Approving it does nothing; the only proposed follow-up work is in the "Defects found" section, and it still needs your go-ahead.

## A) Sidebar after, per role (from AppShell.tsx + permissions.ts + route-access.ts)

**Property Coordinator** — section "My day": Home · My Work · Team Queue · Properties · Work Orders · Guest Claims & Refunds · Inquiry Sources · Record work. If her seat is Guest Experience: also "Owners & Programs": Leads. No Reports, no Admin.
**Supervisor** — "My day" (same 8) · "Oversight": Oversight, Onboarding*, Program Oversight, Quarterly Reviews (only if the quarterly flag is on) · "Team": Team & Coverage, Playbooks · "Owners & Programs": Active Owner, Homeowners, Leads · "Reports" (one item, opens Analytics) · "Admin" (one item, opens Audit History).
**Operations Director** (Supervisor + Ops Director seat) — same as Supervisor; adds the Finance tab inside Reports.
**Admin** — same as Supervisor; Reports opens Analytics; Admin opens Integrations.
**Onboarding staff** — "Onboarding": Onboarding Home · Properties · My Tasks · Owner Completions · Team · Utilities & Accounts (Workflow Templates hidden).
**Onboarding Director** — "Onboarding": same 6 plus Workflow Templates · "Active Owner": Active Owner.

*Onboarding under Oversight appears only if that person also holds the Onboarding portal; not confirmed for Supervisor.

**Tab bars on grouped pages (each tab shows only if the person has access):**
- My Work pages: My Work · Routine Work · STR Cleaner Check
- Properties / a property / Work Map / Availability Finder: Properties · Work Map · Availability Finder
- Work Orders pages: Work Orders · Vendors
- Claims / Refunds pages: Claims · Refunds & Credits
- Reports pages (Analytics, Owner Participation, Finance, Executive View): Analytics · Owner Participation · STR Cleaner Time · Finance (Admin/Ops Director) · Executive View (Admin)
- Admin pages (Integrations, Audit History, Help Tickets, access log): Integrations (Admin only) · Audit History · Help Tickets

**How this differs from the approved plan**
1. "Home" and "Record work" are still in the first section. Record work stayed because the top button hides on every My Work page. The plan did not list either one.
2. The first section is headed "My day". The plan gave no heading.
3. "Booking Tools or Inquiry Sources" ended up as "Inquiry Sources" (same page, same access).
4. Reports and Admin are single menu items that open the first page you can see, not sections with sub-items. Their contents show as tabs.
5. The page is labelled "Quarterly Reviews"; the plan wrote "Quarterly reviews".
6. The STR Cleaner Time page still shows its old "STR cleaner time" menu, not the Reports tabs, so the tab bar disappears when you click that tab. Vendors (from the Work Orders tab) and Owner Participation also have their own older menus. Defect.
7. Onboarding Director and Onboarding staff are unchanged apart from the renamed items.

**Where items ended up:** Team Queue: first section, every Operations role. Leads: Owners & Programs (Supervisor, Admin, Guest Experience coordinators). Inquiry Sources: first section. Homeowners: Owners & Programs, and also the Active Owner menu. Playbooks: Team. Program Oversight: Oversight, and also the Active Owner menu (as "Program oversight").

## B) Text changes (old → new)

Every lowercase "work order(s)" became "Work Order(s)" in about 59 files. That includes Breezeway panels, Work Order pages, vendor portal pages, error messages and comments.
- CoverageSchedulePanel: "Seat unfilled" → "No one assigned" (x2); "Manage seat & schedule" → "Manage coverage"
- ApprovalDetail: "{role} seat" → "{role}"
- join + awaiting-access: "A platform administrator must still assign your leadership seat." → "An admin will finish setting up your access."
- dashboard: "work this seat handles" → "work this role handles"
- OwnerEmailCopyCard: "A property matter was recorded for your home…" → "We recorded an update about your home…"
- owner-notification: "An urgent matter was recorded…" → "We recorded an urgent update…"; "A property matter was marked resolved…" → "An update about your property was marked resolved…"
- owner-portal.server: "The property matter was not confirmed…" → "The home update was not confirmed…"
- AddPropertyDialog: "Mark as a QA / test home (kept out of production reporting)" → "Practice home (hidden from reports)" (x2)
- properties: "Show/Hide QA / test homes" → "Show/Hide practice homes"
- owner-programs: "QA / demo programs" → "practice programs" (3 places); page title "Owner participation programs" → "Active Owner"
- TeamInvitePanel: invite codes description rewritten to "Create a code for a new team member or vendor and send it to them yourself (codes are not emailed). They sign up, then enter the code to get their access. Each code works once and expires after 30 days."; role option "Platform Owner — …" → "Admin — …"
- HandoffPanel, MatterOwnershipPanel, RecoveryList, recovery.my-recoveries, tickets.$ticketId: "handoff" → "reassignment" (Operations ownership transfer only). Onboarding-to-Ops Handoff and Overnight handoff were not changed.
- OwnerApprovalPanel "Decisions for your approval" and owner.tsx "Decisions & approvals" → "Your approvals"; oversight "Decisions needed" → "Owner approvals"
- Role names: "Platform Owner" → "Admin" in permissions, team-invites, portals ("Admins"), command-center, RequireCapability, ActiveOwnerPanel, owner-program/welcome errors, demo, hub, index, onboarding.index, CompanyHealthPanel. "Staff" → "Property Coordinator".
- Page titles: "Tickets queue" → "My Work"; "My onboarding work"/"My work" → "My Tasks"; "Onboarding hub" → "Onboarding Home"; "Active Owner analytics" → "Owner Participation"
- Menu labels: Onboarding "Dashboard" → "Onboarding Home", "My Work" → "My Tasks"; "My work" → "My Work"; "Routine work" → "Routine Work"; Help panel "Vendor Hub" → "Vendors"
- Help & Feedback button now opens a small menu: Ask the Coach (if allowed) · Help & guides · Report a problem or suggestion

**Your specific checks**
- "property matter" and other shown "matter": done (4 strings). The remaining "matters" uses mean "why it matters" and were left alone.
- Seat unfilled / Manage seat & schedule / {role} seat: done.
- "A platform administrator must still assign…": done (2 screens).
- Home "work this seat handles": done.
- QA / test home and QA / demo programs: done. "Closed but never QA'd" on Analytics was not changed.
- Invite codes description: done.
- "Recovery" as a word: not done. The guest refunds page was already called "Refunds & Credits". The remaining words ("Recovery recorded", "Recoveries received", "Recovery closed", "Recovery treatment") describe claim money recovered, which is a separate idea.
- Spending approval wording on Work Orders: not done ("Committed spend, open", "Spending authorized"). I missed it.
- Supervisor for manager: done for the role label only. "Manager view" on Leads and Claims, "Needs a manager's eyes", and "Choose a manager"/"No manager assigned" on Cleaning Regions were not changed. I missed them.

**Defect introduced:** "Platform Owner" → "Admin" produced "a Admin" in about 12 places (it should read "an Admin").

## C) src/lib/onboarding-template.ts

The only change is lowercase "work order(s)" → "Work Order(s)" in Task titles, instructions and comments (about 60 lines, including 4 or more Task titles such as "Create Work Order to meet Cox installer"). Task keys, stages, roles, order and timing did not change. The all-caps "CREATE WORK ORDERS FOR SETUP…" was left as it was.
Effect: existing homes keep their saved Task names and are unaffected. Only plans created after this release would show the new capitalization, and nothing goes live until you publish. The plan said to skip text that ends up stored in the database, so this should be reverted unless you want it.

## D) Builder words still on screen (not changed)

- Team & Coverage: "Seat holder", "Seat updated", "Seat cleared", "Someone covers this seat", "Seat is off duty", "Seat off duty" → allowed by the plan (seat editor)
- Team page: "Seats" tab, "Current seat holder", "Save seat", "Work routes to permanent seats…" → allowed by the plan
- Reassign panel on a Ticket: "Which seat takes the next action?" → "Who takes the next action?"
- New Ticket (process owner): "Which seat owns this process?", "an unassigned seat", "This seat is unassigned" → "Which role owns this?", "no one yet", "No one is assigned"
- Product tour: "Work routes to permanent seats…" → "Work goes to roles, not people…"
- Coverage panel intro: "Change a seat holder…" → "Change who covers a role…"
- Analytics: "Closed but never QA'd" → "Closed without a quality check"
- Workflow Templates CSV import help: "furnishing_scope=full_furnishing; module=pool" → spell out in words
- Onboarding transitions: "Next: {stage}" shows a raw stage code → show the stage name
- Vendor coverage chip: "Not cleared ({status})" shows a raw status → plain status name
- Pool, synthetic, fixture, contract, raw IDs: no user-visible builder uses found ("pool" only means a swimming pool)
- Not swept: text stored in the database (template Tasks on existing homes, playbooks, work-type names, email templates, welcome template)

## E) Preview checklist for Emily (about 10 minutes, signed in as Admin)

1. Open the preview. The left menu should show "My day", then Oversight, Team, Owners & Programs, then single items "Reports" and "Admin".
2. Click My Work. Tabs at the top should read My Work · Routine Work · STR Cleaner Check.
3. Click Properties. Tabs: Properties · Work Map · Availability Finder. Click Work Map; the same tabs should stay.
4. Click Work Orders. Tabs: Work Orders · Vendors. The page should say "Work Order" with a capital O.
5. Click Guest Claims & Refunds. Tabs: Claims · Refunds & Credits.
6. Click Reports. Analytics opens with tabs Analytics · Owner Participation · STR Cleaner Time · Finance · Executive View. Click STR Cleaner Time; the tabs will change (known issue).
7. Click Admin. Integrations opens with tabs Integrations · Audit History · Help Tickets.
8. Click the round ? at the bottom right. You should see Ask the Coach, Help & guides, and Report a problem or suggestion.
9. Click Team & Coverage. Empty roles should say "No one assigned" and the button should say "Manage coverage".
10. Homeowner preview: open Active Owner, open a practice program's homeowner preview. The approvals section should read "Your approvals".
11. Onboarding menu: click Onboarding. The menu should read Onboarding Home, Properties, My Tasks, Owner Completions, Team, Workflow Templates, Utilities & Accounts.
12. Watch for "a Admin" anywhere (known wording slip).

## F) Not verified

- Nothing was clicked through in the preview for any role. Everything above is read from the code.
- Whether Supervisors hold the Onboarding portal, so whether Onboarding shows under their Oversight section.
- Whether a person with a seat, but no role change, sees any different items.
- Tests and build were not re-run for this report. The last run was clean.
- What shows when a page has both an older department menu and the new tabs (Owner Participation, Vendors).
- Text stored in the database.

## Defects found (fix only if you approve)

1. Change "a Admin" to "an Admin" (about 12 places).
2. Give STR Cleaner Time, Owner Participation and Vendors the matching tab bar, or confirm the older menus should stay.
3. Revert the onboarding-template.ts capitalization changes.
4. Finish the missed wording: spending approval on Work Orders, and "Manager view" → "Supervisor view".
