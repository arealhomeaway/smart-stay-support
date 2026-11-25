# Operations screen inventory, 2026-11-25

## What was checked

- Source code for navigation, role preview, queue tabs, ticket panels, arrival checks and automatic page-open actions.
- Signed-in localhost preview restored as Emily, at 1440 px and 390 px widths. No published screen was opened or changed.
- Live database audit readback: two automatic `guidance_shown` history entries were added during the first ticket inspections, at 04:45:40.743898 and 04:46:07.549586 UTC. This was an unintended deviation from the no-database-change request. No corrective write or deletion was made. Later captures blocked `recordGuidanceEvent` and `logQueueOpen`. No business records or switches were intentionally changed.
- No switch state claims are made in this inventory. No switch control was pressed.

## Capture limits and counting

- Full document height is captured at the requested width, including all vertically listed rows. Side panels and the phone menu were expanded by increasing capture height, without editing page content or styles, to include their own scrolling content.
- Wide tables and tab strips remain at their actual horizontal scroll position. Offscreen horizontal columns/tabs are not counted as visible.
- When a panel or phone menu is open, the inventory counts that foreground surface only, not its dimmed background. Closed sections and menus are not expanded.
- Buttons includes visible command buttons, icon buttons and button-shaped navigation/record links. Tabs and clickable filters also count as buttons; category totals therefore overlap. Repeated row links count individually.
- Filter includes visible search fields, selectors, segmented selectors and filter commands, but not row selection checkboxes.
- Chips includes visible small count/status pills. Cards counts framed section surfaces; a table is counted separately from its enclosing surface. Section headings include page headings and menu group labels.
- Icon buttons with no accessible name are listed by icon name where available, otherwise Unlabelled icon button.
- Order is actual screen position, top to bottom, left to right for items sharing the same height. Menu items can interleave with page content on desktop.
- Images were checked for blank screens, correct width and opening the intended page/panel. Long screens preserve the default expanded row lists; they are intentionally very tall.

## Role preview limitation

The existing Admin menu has View as > Property Coordinator. It has no Team A/Team B identity selector. All coordinator captures remain signed in as Emily and use that existing read-only role preview. Team A/Team B queue tabs select the corresponding work. Home/menu are generic coordinator previews, not another staff account or that team’s personalized Home. The repeated Home/menu images document that limitation. Each team ticket panel opens an existing ticket from its team list.

## Files and counts

| File | Buttons | Tabs | Filters | Chips | Banners | Cards | Tables | Headings |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| desktop-home.png | 63 | 9 | 1 | 2 | 0 | 6 | 0 | 12 |
| desktop-left-menu-open.png | 63 | 9 | 1 | 2 | 0 | 6 | 0 | 12 |
| desktop-team-queue-default.png | 369 | 5 | 14 | 363 | 0 | 0 | 1 | 9 |
| desktop-open-ticket-panel.png | 30 | 0 | 4 | 3 | 0 | 1 | 0 | 8 |
| desktop-team-queue-team-b-maintenance.png | 228 | 10 | 12 | 125 | 0 | 0 | 2 | 9 |
| desktop-team-queue-team-b-reported-issues.png | 155 | 10 | 12 | 114 | 0 | 0 | 1 | 9 |
| desktop-new-ticket.png | 9 | 0 | 4 | 0 | 0 | 0 | 0 | 1 |
| desktop-routine-work.png | 435 | 0 | 0 | 2 | 0 | 6 | 1 | 12 |
| desktop-open-arrival-check.png | 30 | 0 | 9 | 3 | 0 | 2 | 0 | 8 |
| desktop-oversight.png | 138 | 0 | 6 | 173 | 0 | 7 | 2 | 15 |
| desktop-supervisor-check.png | 383 | 5 | 14 | 363 | 0 | 6 | 1 | 16 |
| desktop-prepare-handoffs.png | 34 | 0 | 2 | 2 | 0 | 1 | 0 | 7 |
| desktop-guest-ready-standards.png | 40 | 0 | 0 | 2 | 0 | 0 | 1 | 6 |
| desktop-coordinator-team-b-home.png | 43 | 9 | 1 | 1 | 1 | 5 | 0 | 9 |
| desktop-coordinator-team-b-left-menu-open.png | 43 | 9 | 1 | 1 | 1 | 5 | 0 | 9 |
| desktop-coordinator-team-b-team-queue.png | 179 | 10 | 12 | 124 | 1 | 0 | 2 | 7 |
| desktop-coordinator-team-b-open-ticket-panel.png | 11 | 0 | 3 | 3 | 0 | 1 | 0 | 8 |
| desktop-coordinator-team-a-home.png | 43 | 9 | 1 | 1 | 1 | 5 | 0 | 9 |
| desktop-coordinator-team-a-left-menu-open.png | 43 | 9 | 1 | 1 | 1 | 5 | 0 | 9 |
| desktop-coordinator-team-a-team-queue.png | 92 | 5 | 13 | 93 | 1 | 0 | 1 | 7 |
| desktop-coordinator-team-a-open-ticket-panel.png | 18 | 0 | 3 | 3 | 0 | 1 | 0 | 9 |
| phone-home.png | 43 | 9 | 1 | 1 | 0 | 6 | 0 | 7 |
| phone-left-menu-open.png | 19 | 0 | 0 | 1 | 0 | 0 | 0 | 5 |
| phone-team-queue-default.png | 348 | 4 | 14 | 203 | 0 | 0 | 1 | 4 |
| phone-open-ticket-panel.png | 30 | 0 | 4 | 3 | 0 | 1 | 0 | 8 |
| phone-team-queue-team-b-maintenance.png | 205 | 7 | 12 | 87 | 0 | 0 | 2 | 4 |
| phone-team-queue-team-b-reported-issues.png | 132 | 7 | 12 | 87 | 0 | 0 | 1 | 4 |
| phone-new-ticket.png | 9 | 0 | 4 | 0 | 0 | 0 | 0 | 1 |
| phone-routine-work.png | 235 | 0 | 0 | 1 | 0 | 6 | 1 | 7 |
| phone-open-arrival-check.png | 30 | 0 | 9 | 3 | 0 | 2 | 0 | 8 |
| phone-oversight.png | 118 | 0 | 6 | 64 | 0 | 7 | 2 | 10 |
| phone-supervisor-check.png | 362 | 4 | 14 | 203 | 0 | 6 | 1 | 11 |
| phone-prepare-handoffs.png | 14 | 0 | 2 | 1 | 0 | 1 | 0 | 2 |
| phone-guest-ready-standards.png | 20 | 0 | 0 | 1 | 0 | 0 | 1 | 1 |
| phone-coordinator-team-b-home.png | 30 | 9 | 1 | 1 | 1 | 5 | 0 | 6 |
| phone-coordinator-team-b-left-menu-open.png | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| phone-coordinator-team-b-team-queue.png | 163 | 7 | 12 | 87 | 1 | 0 | 2 | 4 |
| phone-coordinator-team-b-open-ticket-panel.png | 11 | 0 | 3 | 3 | 0 | 1 | 0 | 8 |
| phone-coordinator-team-a-home.png | 30 | 9 | 1 | 1 | 1 | 5 | 0 | 6 |
| phone-coordinator-team-a-left-menu-open.png | 12 | 0 | 0 | 0 | 0 | 0 | 0 | 3 |
| phone-coordinator-team-a-team-queue.png | 78 | 4 | 13 | 88 | 1 | 0 | 1 | 4 |
| phone-coordinator-team-a-open-ticket-panel.png | 18 | 0 | 3 | 3 | 0 | 1 | 0 | 9 |

## Visible items, in screen order

### desktop-home.png

Screen: Home with Needs you now. Viewer: Emily. PNG: 1440 × 2270.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Toggle Sidebar |
| 2 | button | Resolve EXECUTIVE ADMINISTRATION |
| 3 | button | Search Resolve ⌘K |
| 4 | button | Record work |
| 5 | button | Record routine work |
| 6 | button | Take the tour |
| 7 | button | Alerts and escalations |
| 8 | button | Chats, 1 unread |
| 9 | button | Notifications |
| 10 | button | Switch to dark mode |
| 11 | chip | 1 |
| 12 | button | Toggle Sidebar |
| 13 | button | Portals |
| 14 | button | Sign out (Admin) |
| 15 | heading | MY DAY |
| 16 | button | Home |
| 17 | button | Team Queue |
| 18 | button | Direct Bookings |
| 19 | heading | Good morning, Emily. |
| 20 | button | Work Orders |
| 21 | button | Databases |
| 22 | button | Oversight 4 |
| 23 | chip | 1 handoff waiting to be accepted, 3 missed shift ends today |
| 24 | card | NEEDS MY DECISION |
| 25 | button | Guest Claims & Refunds |
| 26 | button | Open Oversight |
| 27 | heading | 338 things need your decision. |
| 28 | heading | TEAM |
| 29 | button | Escalations to me 0 Someone asked for a decision and is waiting on you. |
| 30 | button | Approval requests 9 Spend and owner decisions that cannot move until you answer. |
| 31 | button | Needs review before closing 10 Finished work waiting on your decision to close. |
| 32 | button | Unassigned work 125 Nobody has picked these up yet. |
| 33 | button | Team and Coverage |
| 34 | button | Playbooks |
| 35 | button | Team blockers 0 Handoffs nobody accepted, and waiting work with no live follow-up. |
| 36 | button | Overdue / high risk 194 Past a clock, or aging well beyond where this priority should land. |
| 37 | button | Recently escalated / cleared 0 Raised or resolved in the last three days. |
| 38 | button | Guest-ready standards |
| 39 | heading | HOMES AND OWNERS |
| 40 | button | Properties |
| 41 | card | Needs you now |
| 42 | heading | Needs you now |
| 43 | button | Onboarding |
| 44 | button | Active Owner |
| 45 | button | 3 missed shift ends today Shift handoffs |
| 46 | button | Quarterly Reviews |
| 47 | button | 1 handoff waiting to be accepted Shift handoffs |
| 48 | heading | INSIGHT |
| 49 | button | Analytics |
| 50 | button | ALE Direct booking you started. Reply within 3 minutes. |
| 51 | heading | ADMIN |
| 52 | button | Owlmarketplace Direct booking you started. Reply within 3 minutes. |
| 53 | button | Admin tools |
| 54 | button | View as |
| 55 | button | Crsth Direct booking you started. Reply within 3 minutes. |
| 56 | button | ale Direct booking you started. Reply within 3 minutes. |
| 57 | button | Direct booking request Direct booking you started. Reply within 3 minutes. |
| 58 | button | See all in Oversight |
| 59 | card | My work |
| 60 | heading | My work |
| 61 | button | Team queue (0 unclaimed) |
| 62 | button, tab | Active1 |
| 63 | button, tab | Waiting0 |
| 64 | button, tab | Done recently0 |
| 65 | button, tab | All |
| 66 | button, tab | P1 |
| 67 | button, tab | P2 |
| 68 | button, tab | P3 |
| 69 | button, tab | List |
| 70 | button, tab | Board |
| 71 | filter | Search my work |
| 72 | button | 3915 W 104th St S, Jenks, Oklahoma 74037 Scheduled Pest Control Keep the work moving Due Nov 23 P2 |
| 73 | button | My account |
| 74 | card | Routine work due today |
| 75 | heading | Routine work due today |
| 76 | button | Record routine work |
| 77 | button | Help & Feedback |
| 78 | card | My shift |
| 79 | heading | My shift |
| 80 | button | Request time off |
| 81 | button | End my shift |
| 82 | card | Recent activity (1) |
| 83 | heading | Recent activity (1) |
| 84 | button | Show |

**Appears more than once:** button: Toggle Sidebar × 2; button: Record routine work × 2.

### desktop-left-menu-open.png

Screen: Left menu fully open. Viewer: Emily. PNG: 1440 × 2270.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Toggle Sidebar |
| 2 | button | Resolve EXECUTIVE ADMINISTRATION |
| 3 | button | Search Resolve ⌘K |
| 4 | button | Record work |
| 5 | button | Record routine work |
| 6 | button | Take the tour |
| 7 | button | Alerts and escalations |
| 8 | button | Chats, 1 unread |
| 9 | button | Notifications |
| 10 | button | Switch to dark mode |
| 11 | chip | 1 |
| 12 | button | Toggle Sidebar |
| 13 | button | Portals |
| 14 | button | Sign out (Admin) |
| 15 | heading | MY DAY |
| 16 | button | Home |
| 17 | button | Team Queue |
| 18 | button | Direct Bookings |
| 19 | heading | Good morning, Emily. |
| 20 | button | Work Orders |
| 21 | button | Databases |
| 22 | button | Oversight 4 |
| 23 | chip | 1 handoff waiting to be accepted, 3 missed shift ends today |
| 24 | card | NEEDS MY DECISION |
| 25 | button | Guest Claims & Refunds |
| 26 | button | Open Oversight |
| 27 | heading | 338 things need your decision. |
| 28 | heading | TEAM |
| 29 | button | Escalations to me 0 Someone asked for a decision and is waiting on you. |
| 30 | button | Approval requests 9 Spend and owner decisions that cannot move until you answer. |
| 31 | button | Needs review before closing 10 Finished work waiting on your decision to close. |
| 32 | button | Unassigned work 125 Nobody has picked these up yet. |
| 33 | button | Team and Coverage |
| 34 | button | Playbooks |
| 35 | button | Team blockers 0 Handoffs nobody accepted, and waiting work with no live follow-up. |
| 36 | button | Overdue / high risk 194 Past a clock, or aging well beyond where this priority should land. |
| 37 | button | Recently escalated / cleared 0 Raised or resolved in the last three days. |
| 38 | button | Guest-ready standards |
| 39 | heading | HOMES AND OWNERS |
| 40 | button | Properties |
| 41 | card | Needs you now |
| 42 | heading | Needs you now |
| 43 | button | Onboarding |
| 44 | button | Active Owner |
| 45 | button | 3 missed shift ends today Shift handoffs |
| 46 | button | Quarterly Reviews |
| 47 | button | 1 handoff waiting to be accepted Shift handoffs |
| 48 | heading | INSIGHT |
| 49 | button | Analytics |
| 50 | button | ALE Direct booking you started. Reply within 3 minutes. |
| 51 | heading | ADMIN |
| 52 | button | Owlmarketplace Direct booking you started. Reply within 3 minutes. |
| 53 | button | Admin tools |
| 54 | button | View as |
| 55 | button | Crsth Direct booking you started. Reply within 3 minutes. |
| 56 | button | ale Direct booking you started. Reply within 3 minutes. |
| 57 | button | Direct booking request Direct booking you started. Reply within 3 minutes. |
| 58 | button | See all in Oversight |
| 59 | card | My work |
| 60 | heading | My work |
| 61 | button | Team queue (0 unclaimed) |
| 62 | button, tab | Active1 |
| 63 | button, tab | Waiting0 |
| 64 | button, tab | Done recently0 |
| 65 | button, tab | All |
| 66 | button, tab | P1 |
| 67 | button, tab | P2 |
| 68 | button, tab | P3 |
| 69 | button, tab | List |
| 70 | button, tab | Board |
| 71 | filter | Search my work |
| 72 | button | 3915 W 104th St S, Jenks, Oklahoma 74037 Scheduled Pest Control Keep the work moving Due Nov 23 P2 |
| 73 | button | My account |
| 74 | card | Routine work due today |
| 75 | heading | Routine work due today |
| 76 | button | Record routine work |
| 77 | button | Help & Feedback |
| 78 | card | My shift |
| 79 | heading | My shift |
| 80 | button | Request time off |
| 81 | button | End my shift |
| 82 | card | Recent activity (1) |
| 83 | heading | Recent activity (1) |
| 84 | button | Show |

**Appears more than once:** button: Toggle Sidebar × 2; button: Record routine work × 2.

### desktop-team-queue-default.png

Screen: Team Queue default. Viewer: Emily. PNG: 1440 × 13902.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Toggle Sidebar |
| 2 | button | Resolve EXECUTIVE ADMINISTRATION |
| 3 | button | Search Resolve ⌘K |
| 4 | button | Record work |
| 5 | button | Record routine work |
| 6 | button | Take the tour |
| 7 | button | Alerts and escalations |
| 8 | button | Chats, 1 unread |
| 9 | button | Notifications |
| 10 | button | Switch to dark mode |
| 11 | chip | 1 |
| 12 | button | Toggle Sidebar |
| 13 | button | Portals |
| 14 | button | Sign out (Admin) |
| 15 | heading | MY DAY |
| 16 | button | Home |
| 17 | heading | Team Queue |
| 18 | filter | Search by title or home |
| 19 | button, filter | Filter |
| 20 | button | Team Queue |
| 21 | button | Direct Bookings |
| 22 | button, filter | Priority |
| 23 | button, filter | Status |
| 24 | button, filter | Person |
| 25 | button | Work Orders |
| 26 | button, tab | All team 117 |
| 27 | button, tab | Team A 3 |
| 28 | button, tab | Team B 140 |
| 29 | button, tab | Only mine 1 |
| 30 | button, tab | Unassigned 40 |
| 31 | chip | 117 |
| 32 | chip | 3 |
| 33 | chip | 140 |
| 34 | chip | 1 |
| 35 | chip | 40 |
| 36 | button | Databases |
| 37 | button, filter | Unassigned 40 |
| 38 | button, filter | Waiting 2 |
| 39 | button, filter | Blocked 3 |
| 40 | button, filter | Escalated 117 |
| 41 | button, filter | Overdue 112 |
| 42 | button | Oversight 4 |
| 43 | chip | 1 handoff waiting to be accepted, 3 missed shift ends today |
| 44 | table | Open tickets |
| 45 | button | Guest Claims & Refunds |
| 46 | button | P2, hide rows |
| 47 | chip | P2 |
| 48 | button | P2 The Door in the bedroom fell down. The carpet is dirty #4941 207 High Point Way, Justin, Texas 76247 Fort Worth Immediate cleaning need Mike Cacatian Team A In progress Nov 16 Overdue by 8 days Nov 16 |
| 49 | heading | TEAM |
| 50 | chip | P2 |
| 51 | chip | In progress |
| 52 | button | Select ticket 4941 |
| 53 | button | Team and Coverage |
| 54 | button | P2 Guest review: Reported issue: Shower head is not working properly. Needs fixing. #4976 2016 NW 172ND, Edmond, Oklahoma 73012 OKC Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 7d Nov 17 |
| 55 | chip | P2 |
| 56 | chip | Open |
| 57 | button | Select ticket 4976 |
| 58 | button | Playbooks |
| 59 | button | P2 The washer at 7422 has a reported broken timer and may require repair or replacement. Please review the previous updates, confirm the washer #4978 7422 S. Granite Ave, Tulsa, Oklahoma 74136 Tulsa Immediate maintenance Qym Fuenteblanca Team B Open Start work Overdue by 7d Nov 17 |
| 60 | chip | P2 |
| 61 | chip | Open |
| 62 | button | Select ticket 4978 |
| 63 | button | Guest-ready standards |
| 64 | button | P2 Guest touch base: Pending: Finding her the new house she will extend in from Dec 20 onwards. #4972 724 Abilene Way, Yukon, Oklahoma 73099 OKC Current or past guest request Mike Cacatian Team A In progress Nov 17 Overdue by 7 days Nov 17 |
| 65 | chip | P2 |
| 66 | chip | In progress |
| 67 | button | Select ticket 4972 |
| 68 | heading | HOMES AND OWNERS |
| 69 | button | P2 The garage door is broken. It came off the track #4974 5020 S 168th East Ave, Tulsa, Oklahoma 74134 Tulsa Maintenance and landscaping work-order review Qym Fuenteblanca Team B In progress Nov 17 Overdue by 7 days Nov 17 |
| 70 | button | Properties |
| 71 | chip | P2 |
| 72 | chip | In progress |
| 73 | button | Select ticket 4974 |
| 74 | button | P2 Guest touch base: 11/18 - MC #5000 207 High Point Way, Justin, Texas 76247 Fort Worth Current or past guest request Mike Cacatian Team A In progress Nov 18 Overdue by 6 days Nov 18 |
| 75 | button | Onboarding |
| 76 | chip | P2 |
| 77 | chip | In progress |
| 78 | button | Select ticket 5000 |
| 79 | button | Active Owner |
| 80 | button | P2 2014 - get carpet quote to replace #1509 2014 E 52nd St, Tulsa, Oklahoma 74105 Tulsa Other Romeo Canales Team B Waiting on owner Nov 20 · 8:00 AM Overdue by 5d Nov 3 |
| 81 | chip | P2 |
| 82 | chip | Waiting on owner |
| 83 | button | Select ticket 1509 |
| 84 | button | Quarterly Reviews |
| 85 | button | P2 to reach out to owner on considering to replace the carpet #5048 3712 N 39th St., Broken Arrow, Oklahoma 74014 Tulsa Ongoing maintenance Romeo Canales Team B Open Start work Overdue by 4d Nov 20 |
| 86 | chip | P2 |
| 87 | chip | Open |
| 88 | button | Select ticket 5048 |
| 89 | heading | INSIGHT |
| 90 | button | P2 slow shower drain #5046 1068 Berrywood Dr, Greenwood, Indiana 46143 Indy Other James Almario Leadership Open Start work Overdue by 4d Nov 20 |
| 91 | chip | P2 |
| 92 | chip | Open |
| 93 | button | Select ticket 5046 |
| 94 | button | Analytics |
| 95 | button | P2 16401 - dryer not working #1476 16401 Villa Valeria Way, Edmond, Oklahoma 73013 OKC Other Romeo Canales Team B Open Reply now Overdue by 4d Oct 27 |
| 96 | chip | P2 |
| 97 | chip | Open |
| 98 | button | Select ticket 1476 |
| 99 | heading | ADMIN |
| 100 | button | P2 Guest touch base: Guest said no Kleenex, very few kitchen items, and can’t find the volume cont... #5077 305 W 7th St, Edmond, Oklahoma 73003 OKC Current or past guest request Avy Vergara In progress Nov 22 Overdue by 2 days Nov 22 |
| 101 | button | Admin tools |
| 102 | chip | P2 |
| 103 | chip | In progress |
| 104 | button | Select ticket 5077 |
| 105 | button | P2 5923 - yale lock disconnected #1487 5923 Hollyhock Ln, Montgomery, Texas 77316 Houston Other Romeo Canales Team B Waiting on vendor Nov 23 · 8:00 AM Overdue by 39h Oct 29 |
| 106 | button | View as |
| 107 | chip | P2 |
| 108 | chip | Waiting on vendor |
| 109 | button | Select ticket 1487 |
| 110 | button | P2 one of dining chairs was broken #5104 4607 W Union St, Broken Arrow, Oklahoma 74011 Tulsa Immediate maintenance Qym Fuenteblanca Team B Open Start work Overdue by 29h Nov 23 |
| 111 | chip | P2 |
| 112 | chip | Open |
| 113 | button | Select ticket 5104 |
| 114 | button | P2 7006 project. This home is missing quite a few standard items that we need ordered and then a few things need replaced. #5102 7006 E 154th St S, Bixby, Oklahoma 74008 Tulsa Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 28h Nov 23 |
| 115 | chip | P2 |
| 116 | chip | Open |
| 117 | button | Select ticket 5102 |
| 118 | button | P2 bathroom mirror broken #5103 18200 Bodegon Rd., Edmond, Oklahoma 73012 OKC Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 28h Nov 23 |
| 119 | chip | P2 |
| 120 | chip | Open |
| 121 | button | Select ticket 5103 |
| 122 | button | P2 Scheduled Pest Control #5099 3915 W 104th St S, Jenks, Oklahoma 74037 Tulsa Ongoing maintenance Emily Jimenez Leadership In progress Nov 23 Overdue by 1 day Nov 23 |
| 123 | chip | P2 |
| 124 | chip | In progress |
| 125 | button | Select ticket 5099 |
| 126 | button | P2 Guest touch base: The guest reported that the bed sheets were dirty: hair all over them, visibl... #5100 815 E Fulton St, Broken Arrow, Oklahoma 74012 Tulsa Current or past guest request Avy Vergara In progress Nov 23 Overdue by 1 day Nov 23 |
| 127 | chip | P2 |
| 128 | chip | In progress |
| 129 | button | Select ticket 5100 |
| 130 | button | P2 small tear/rip in couch #5132 2004 Cedar Ridge Rd, Edmond, Oklahoma 73013 OKC Ongoing maintenance Romeo Canales Team B Open Start work Overdue by 6h Today 4:43 PM |
| 131 | chip | P2 |
| 132 | chip | Open |
| 133 | button | Select ticket 5132 |
| 134 | button | P2 broken coasters #5133 3333 Welling Rd, Edmond, Oklahoma 73012 OKC Ongoing maintenance Romeo Canales Team B Open Start work Overdue by 6h Today 4:46 PM |
| 135 | chip | P2 |
| 136 | chip | Open |
| 137 | button | Select ticket 5133 |
| 138 | button | P2 towel rack repair #5134 628 Joy Ct, Burleson, Texas 76028 Fort Worth Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:04 PM |
| 139 | chip | P2 |
| 140 | chip | Open |
| 141 | button | Select ticket 5134 |
| 142 | button | P2 repair dining chair #5135 817 Halley Dr., Moore, Oklahoma 73160 OKC Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:06 PM |
| 143 | chip | P2 |
| 144 | chip | Open |
| 145 | button | Select ticket 5135 |
| 146 | button | P2 backyard needs mowed #5136 1169 Blue Sky Lane, Burleson, Texas 76028 Fort Worth Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:23 PM |
| 147 | chip | P2 |
| 148 | chip | Open |
| 149 | button | Select ticket 5136 |
| 150 | button | P2 toilet paper holder #5137 845 Alexandria Ln, Joshua, Texas 76058-6216 Fort Worth Immediate maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:52 PM |
| 151 | button | My account |
| 152 | chip | P2 |
| 153 | chip | Open |
| 154 | button | Select ticket 5137 |
| 155 | button | Help & Feedback |
| 156 | button | P3, hide rows |
| 157 | chip | P3 |
| 158 | button | P3 FROM PREVIOUS TURNS- NOT ADDRESSED #4931 845 Alexandria Ln, Joshua, Texas 76058-6216 Fort Worth Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 159 | chip | P3 |
| 160 | chip | Unassigned |
| 161 | chip | Open |
| 162 | button | Select ticket 4931 |
| 163 | button | P3 Landscaping #4932 3000 W Charlotte St, Broken Arrow, Oklahoma 74011 Tulsa Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 164 | chip | P3 |
| 165 | chip | Unassigned |
| 166 | chip | Open |
| 167 | button | Select ticket 4932 |
| 168 | button | P3 Air filter needs to be changed #4933 3000 W Charlotte St, Broken Arrow, Oklahoma 74011 Tulsa Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 169 | chip | P3 |
| 170 | chip | Unassigned |
| 171 | chip | Open |
| 172 | button | Select ticket 4933 |
| 173 | button | P3 Broken kitchen table chair #4934 817 Halley Dr., Moore, Oklahoma 73160 OKC Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 174 | chip | P3 |
| 175 | chip | Unassigned |
| 176 | chip | Open |
| 177 | button | Select ticket 4934 |
| 178 | button | P3 Broken lamp #4939 14553 Serrano Ridge Dr, Ft. Worth, Texas 76052 Fort Worth Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 179 | chip | P3 |
| 180 | chip | Unassigned |
| 181 | chip | Open |
| 182 | button | Select ticket 4939 |
| 183 | button | P3 Trash #4940 4003 Bendale Rd, Benbrook, Texas 76116 Fort Worth Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 184 | chip | P3 |
| 185 | chip | Unassigned |
| 186 | chip | Open |
| 187 | button | Select ticket 4940 |
| 188 | button | P3 Quarterly property review: 13117 NE 9th St #4892 13117 NE 9th St, Choctaw, Oklahoma 73020 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 189 | chip | P3 |
| 190 | chip | Open |
| 191 | button | Select ticket 4892 |
| 192 | button | P3 Quarterly property review: 19021 Meadows Crossing Dr #4893 19021 Meadows Crossing Dr, Edmond, Oklahoma 73012 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 193 | chip | P3 |
| 194 | chip | Open |
| 195 | button | Select ticket 4893 |
| 196 | button | P3 Quarterly property review: 15226 High Timber Ln #4894 15226 High Timber Ln, Noblesville, Indiana 46060 Indy Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 197 | chip | P3 |
| 198 | chip | Open |
| 199 | button | Select ticket 4894 |
| 200 | button | P3 Quarterly property review: 1640 Glade Meadows Dr #4895 1640 Glade Meadows Dr, Joshua, Texas 76058 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 201 | chip | P3 |
| 202 | chip | Open |
| 203 | button | Select ticket 4895 |
| 204 | button | P3 Quarterly property review: 309 Prince John Dr #4896 309 Prince John Dr, Saginaw, Texas 76179 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 205 | chip | P3 |
| 206 | chip | Open |
| 207 | button | Select ticket 4896 |
| 208 | button | P3 Quarterly property review: 207 High Point Way #4897 207 High Point Way, Justin, Texas 76247 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 209 | chip | P3 |
| 210 | chip | Open |
| 211 | button | Select ticket 4897 |
| 212 | button | P3 Quarterly property review: 4607 S. Lakewood Ave #4898 4607 S. Lakewood Ave, Tulsa, Oklahoma 74135 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 213 | chip | P3 |
| 214 | chip | Open |
| 215 | button | Select ticket 4898 |
| 216 | button | P3 Quarterly property review: 2617 W Madison St. #4899 2617 W Madison St., Broken Arrow, Oklahoma 74012 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 217 | chip | P3 |
| 218 | chip | Open |
| 219 | button | Select ticket 4899 |
| 220 | button | P3 Quarterly property review: 4308 NW 158th St. #4900 4308 NW 158th St., Edmond, Oklahoma 73013 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 221 | chip | P3 |
| 222 | chip | Open |
| 223 | button | Select ticket 4900 |
| 224 | button | P3 Quarterly property review: 1908 E Urbana St #4901 1908 E Urbana St, Broken Arrow, Oklahoma 74012 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 225 | chip | P3 |
| 226 | chip | Open |
| 227 | button | Select ticket 4901 |
| 228 | button | P3 Quarterly property review: 10845 Sara Ct #4902 10845 Sara Ct, Midwest City, Oklahoma 73130 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 229 | chip | P3 |
| 230 | chip | Open |
| 231 | button | Select ticket 4902 |
| 232 | button | P3 Quarterly property review: 5034 N. 35th St. #4903 5034 N. 35th St., Broken Arrow, Oklahoma 74014 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 233 | chip | P3 |
| 234 | chip | Open |
| 235 | button | Select ticket 4903 |
| 236 | button | P3 Quarterly property review: 4308 S 177th Pl E #4904 4308 S 177th Pl E, Tulsa, Oklahoma 74134 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 237 | chip | P3 |
| 238 | chip | Open |
| 239 | button | Select ticket 4904 |
| 240 | button | P3 Quarterly property review: 628 Joy Ct #4905 628 Joy Ct, Burleson, Texas 76028 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 241 | chip | P3 |
| 242 | chip | Open |
| 243 | button | Select ticket 4905 |
| 244 | button | P3 Quarterly property review: 3712 N 39th St. #4906 3712 N 39th St., Broken Arrow, Oklahoma 74014 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 245 | chip | P3 |
| 246 | chip | Open |
| 247 | button | Select ticket 4906 |
| 248 | button | P3 Quarterly property review: 428 Drowsy Water Trl #4907 428 Drowsy Water Trl, Ft. Worth, Texas 76131 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 249 | chip | P3 |
| 250 | chip | Open |
| 251 | button | Select ticket 4907 |
| 252 | button | P3 Quarterly property review: 2332 Los Angeles Ave #4908 2332 Los Angeles Ave, Edmond, Oklahoma 73034 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 253 | chip | P3 |
| 254 | chip | Open |
| 255 | button | Select ticket 4908 |
| 256 | button | P3 Quarterly property review: 2016 NW 172ND #4909 2016 NW 172ND, Edmond, Oklahoma 73012 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 257 | chip | P3 |
| 258 | chip | Open |
| 259 | button | Select ticket 4909 |
| 260 | button | P3 Quarterly property review: 7071 Richardson Ct #4910 7071 Richardson Ct, Warr Acres, Oklahoma 73132 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 261 | chip | P3 |
| 262 | chip | Open |
| 263 | button | Select ticket 4910 |
| 264 | button | P3 Quarterly property review: 7351 Red Rock Rd #4911 7351 Red Rock Rd, Indianapolis, Indiana 46236 Indy Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 265 | chip | P3 |
| 266 | chip | Open |
| 267 | button | Select ticket 4911 |
| 268 | button | P3 Quarterly property review: 341 Thistlewood Dr #4912 341 Thistlewood Dr, Greenfield, Indiana 46140 Indy Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 269 | chip | P3 |
| 270 | chip | Open |
| 271 | button | Select ticket 4912 |
| 272 | button | P3 Quarterly property review: 9235 E 133rd St S #4913 9235 E 133rd St S, Bixby, Oklahoma 74008 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 273 | chip | P3 |
| 274 | chip | Open |
| 275 | button | Select ticket 4913 |
| 276 | button | P3 Quarterly property review: 815 E Fulton St #4914 815 E Fulton St, Broken Arrow, Oklahoma 74012 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 277 | chip | P3 |
| 278 | chip | Open |
| 279 | button | Select ticket 4914 |
| 280 | button | P3 Quarterly property review: 305 W 7th St #4915 305 W 7th St, Edmond, Oklahoma 73003 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 281 | chip | P3 |
| 282 | chip | Open |
| 283 | button | Select ticket 4915 |
| 284 | button | P3 Quarterly property review: 236 N Starnes St #4916 236 N Starnes St, Grapevine, Texas 76051 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 285 | chip | P3 |
| 286 | chip | Open |
| 287 | button | Select ticket 4916 |
| 288 | button | P3 Quarterly property review: 8408 NW 162nd St. #4917 8408 NW 162nd St., Edmond, Oklahoma 73013 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 289 | chip | P3 |
| 290 | chip | Open |
| 291 | button | Select ticket 4917 |
| 292 | button | P3 Quarterly property review: 2012 W. Black Powder Way #4918 2012 W. Black Powder Way, Mustang, Oklahoma 73064 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 293 | chip | P3 |
| 294 | chip | Open |
| 295 | button | Select ticket 4918 |
| 296 | button | P3 Quarterly property review: 8332 Welder Pl #4919 8332 Welder Pl, Indianapolis, Indiana 46237 Indy Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 297 | chip | P3 |
| 298 | chip | Open |
| 299 | button | Select ticket 4919 |
| 300 | button | P3 Quarterly property review: 5020 S 168th East Ave #4920 5020 S 168th East Ave, Tulsa, Oklahoma 74134 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 301 | chip | P3 |
| 302 | chip | Open |
| 303 | button | Select ticket 4920 |
| 304 | button | P3 Quarterly property review: 7422 S. Granite Ave #4921 7422 S. Granite Ave, Tulsa, Oklahoma 74136 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 305 | chip | P3 |
| 306 | chip | Open |
| 307 | button | Select ticket 4921 |
| 308 | button | P3 Quarterly property review: 401 E 10th St #4922 401 E 10th St, Edmond, Oklahoma 73034 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 309 | chip | P3 |
| 310 | chip | Open |
| 311 | button | Select ticket 4922 |
| 312 | button | P3 Quarterly property review: 33 Center Ln S #4923 33 Center Ln S, Carlton Landing, Oklahoma 74332 Carlton Landing Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 313 | chip | P3 |
| 314 | chip | Open |
| 315 | button | Select ticket 4923 |
| 316 | button | P3 Quarterly property review: 1636 NE 32nd St #4924 1636 NE 32nd St, Moore, Oklahoma 73160 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 317 | chip | P3 |
| 318 | chip | Open |
| 319 | button | Select ticket 4924 |
| 320 | button | P3 Quarterly property review: 3201 Belmont Circle #4925 3201 Belmont Circle, Edmond, Oklahoma 73034 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 321 | chip | P3 |
| 322 | chip | Open |
| 323 | button | Select ticket 4925 |
| 324 | button | P3 Quarterly property review: 2414 W. Kingsport Ct. S #4926 2414 W. Kingsport Ct. S, Broken Arrow, Oklahoma 74011 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 325 | chip | P3 |
| 326 | chip | Open |
| 327 | button | Select ticket 4926 |
| 328 | button | P3 Quarterly property review: 5923 Hollyhock Ln #4927 5923 Hollyhock Ln, Montgomery, Texas 77316 Houston Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 329 | chip | P3 |
| 330 | chip | Open |
| 331 | button | Select ticket 4927 |
| 332 | button | P3 Quarterly property review: 852 Inland Dr #4928 852 Inland Dr, Avon, Indiana 46123 Indy Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 333 | chip | P3 |
| 334 | chip | Open |
| 335 | button | Select ticket 4928 |
| 336 | button | P3 Back patio/furniture #4961 136 Magnolia Estates St., Crowley, Texas 76036 Fort Worth Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 337 | chip | P3 |
| 338 | chip | Unassigned |
| 339 | chip | Open |
| 340 | button | Select ticket 4961 |
| 341 | button | P3 Ruined linens #4962 136 Magnolia Estates St., Crowley, Texas 76036 Fort Worth Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 342 | chip | P3 |
| 343 | chip | Unassigned |
| 344 | chip | Open |
| 345 | button | Select ticket 4962 |
| 346 | button | P3 Carpet/ rug shampooing. #4963 136 Magnolia Estates St., Crowley, Texas 76036 Fort Worth Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 347 | chip | P3 |
| 348 | chip | Unassigned |
| 349 | chip | Open |
| 350 | button | Select ticket 4963 |
| 351 | button | P3 Yard work #4964 136 Magnolia Estates St., Crowley, Texas 76036 Fort Worth Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 352 | chip | P3 |
| 353 | chip | Unassigned |
| 354 | chip | Open |
| 355 | button | Select ticket 4964 |
| 356 | button | P3 Driveway stains. #4965 136 Magnolia Estates St., Crowley, Texas 76036 Fort Worth Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 357 | chip | P3 |
| 358 | chip | Unassigned |
| 359 | chip | Open |
| 360 | button | Select ticket 4965 |
| 361 | button | P3 Guest items. #4966 136 Magnolia Estates St., Crowley, Texas 76036 Fort Worth Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 362 | chip | P3 |
| 363 | chip | Unassigned |
| 364 | chip | Open |
| 365 | button | Select ticket 4966 |
| 366 | button | P3 Guest bathroom #4975 904 NE 34th Ter, Moore, Oklahoma 73160 OKC Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 367 | chip | P3 |
| 368 | chip | Unassigned |
| 369 | chip | Open |
| 370 | button | Select ticket 4975 |
| 371 | button | P3 Quarterly property review: 11249 Pegasus Dr #4944 11249 Pegasus Dr, Noblesville, Indiana 46060 Indy Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 372 | chip | P3 |
| 373 | chip | Open |
| 374 | button | Select ticket 4944 |
| 375 | button | P3 Quarterly property review: 64 Turtle Loop #4945 64 Turtle Loop, Eufaula, Oklahoma 74432 Carlton Landing Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 376 | chip | P3 |
| 377 | chip | Open |
| 378 | button | Select ticket 4945 |
| 379 | button | P3 Quarterly property review: 7317 NW 159th Ter #4946 7317 NW 159th Ter, Edmond, Oklahoma 73013 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 380 | chip | P3 |
| 381 | chip | Open |
| 382 | button | Select ticket 4946 |
| 383 | button | P3 Quarterly property review: 2901 E 75th St #4947 2901 E 75th St, Tulsa, Oklahoma 74136 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 384 | chip | P3 |
| 385 | chip | Open |
| 386 | button | Select ticket 4947 |
| 387 | button | P3 Quarterly property review: 85 Lower Green Way #4948 85 Lower Green Way, Eufaula, Oklahoma 74432 Carlton Landing Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 388 | chip | P3 |
| 389 | chip | Open |
| 390 | button | Select ticket 4948 |
| 391 | button | P3 Quarterly property review: 13325 E 43rd Pl S #4949 13325 E 43rd Pl S, Tulsa, Oklahoma 74134 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 392 | chip | P3 |
| 393 | chip | Open |
| 394 | button | Select ticket 4949 |
| 395 | button | P3 Quarterly property review: 1722 Westchester Dr #4950 1722 Westchester Dr, The Village, Oklahoma 73120 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 396 | chip | P3 |
| 397 | chip | Open |
| 398 | button | Select ticket 4950 |
| 399 | button | P3 Quarterly property review: 4513 Black Mesa Lane #4951 4513 Black Mesa Lane, Yukon, Oklahoma 73099 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 400 | chip | P3 |
| 401 | chip | Open |
| 402 | button | Select ticket 4951 |
| 403 | button | P3 Quarterly property review: 1056 Wildwood Dr. #4952 1056 Wildwood Dr., Joshua, Texas 76058 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 404 | chip | P3 |
| 405 | chip | Open |
| 406 | button | Select ticket 4952 |
| 407 | button | P3 Quarterly property review: 9008 Scarlet Blvd #4953 9008 Scarlet Blvd, Yukon, Oklahoma 73099 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 408 | chip | P3 |
| 409 | chip | Open |
| 410 | button | Select ticket 4953 |
| 411 | button | P3 Quarterly property review: 10320 Lightning Creek Dr #4954 10320 Lightning Creek Dr, Yukon, Oklahoma 73099 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 412 | chip | P3 |
| 413 | chip | Open |
| 414 | button | Select ticket 4954 |
| 415 | button | P3 Quarterly property review: 1152 Western Yarrow Ave #4955 1152 Western Yarrow Ave, Justin, Texas 76247 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 416 | chip | P3 |
| 417 | chip | Open |
| 418 | button | Select ticket 4955 |
| 419 | button | P3 Quarterly property review: 721 Vaquero St. #4956 721 Vaquero St., White Settlement, Texas 76108 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 420 | chip | P3 |
| 421 | chip | Open |
| 422 | button | Select ticket 4956 |
| 423 | button | P3 Quarterly property review: 1600 E Quantico St #4957 1600 E Quantico St, Broken Arrow, Oklahoma 74011 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 424 | chip | P3 |
| 425 | chip | Open |
| 426 | button | Select ticket 4957 |
| 427 | button | P3 Quarterly property review: 11514 S. Locust Ave #4958 11514 S. Locust Ave, Jenks, Oklahoma 74037 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 428 | chip | P3 |
| 429 | chip | Open |
| 430 | button | Select ticket 4958 |
| 431 | button | P3 Worn dreeeser #4997 5512 Hidden Trail lane, Warr Acres, Oklahoma 73132 OKC Other Unassigned Open Reply now Overdue by 6d Nov 18 |
| 432 | chip | P3 |
| 433 | chip | Unassigned |
| 434 | chip | Open |
| 435 | button | Select ticket 4997 |
| 436 | button | P3 Yard #4998 1169 Blue Sky Lane, Burleson, Texas 76028 Fort Worth Other Unassigned Open Reply now Overdue by 6d Nov 18 |
| 437 | chip | P3 |
| 438 | chip | Unassigned |
| 439 | chip | Open |
| 440 | button | Select ticket 4998 |
| 441 | button | P3 walls #4999 7006 E 154th St S, Bixby, Oklahoma 74008 Tulsa Other Unassigned Open Reply now Overdue by 6d Nov 18 |
| 442 | chip | P3 |
| 443 | chip | Unassigned |
| 444 | chip | Open |
| 445 | button | Select ticket 4999 |
| 446 | button | P3 Trash #5025 4003 Bendale Rd, Benbrook, Texas 76116 Fort Worth Other Unassigned Open Reply now Overdue by 5d Nov 19 |
| 447 | chip | P3 |
| 448 | chip | Unassigned |
| 449 | chip | Open |
| 450 | button | Select ticket 5025 |
| 451 | button | P3 Bedroom near bathroom smells like dog urine #5027 10320 Lightning Creek Dr, Yukon, Oklahoma 73099 OKC Other Unassigned Open Reply now Overdue by 5d Nov 19 |
| 452 | chip | P3 |
| 453 | chip | Unassigned |
| 454 | chip | Open |
| 455 | button | Select ticket 5027 |
| 456 | button | P3 Carpet stain #5028 10320 Lightning Creek Dr, Yukon, Oklahoma 73099 OKC Other Unassigned Open Reply now Overdue by 5d Nov 19 |
| 457 | chip | P3 |
| 458 | chip | Unassigned |
| 459 | chip | Open |
| 460 | button | Select ticket 5028 |
| 461 | button | P3 Quarterly property review: 5253 Tracey Jo Rd #5023 5253 Tracey Jo Rd, Greenwood, Indiana 46142 Indy Quarterly inspection review James Almario Leadership Open Start work Overdue by 5d Nov 19 |
| 462 | chip | P3 |
| 463 | chip | Open |
| 464 | button | Select ticket 5023 |
| 465 | button | P3 Landscaping #5049 11508 E 94th Pl N, Owasso, Oklahoma 74055 Tulsa Other Unassigned Open Reply now Overdue by 4d Nov 20 |
| 466 | chip | P3 |
| 467 | chip | Unassigned |
| 468 | chip | Open |
| 469 | button | Select ticket 5049 |
| 470 | button | P3 Touch up paint #5065 10121 E 131st Pl S, Bixby, Oklahoma 74008 Tulsa Other Unassigned Open Reply now Overdue by 3d Nov 21 |
| 471 | chip | P3 |
| 472 | chip | Unassigned |
| 473 | chip | Open |
| 474 | button | Select ticket 5065 |
| 475 | button | P3 Landscaping #5066 10121 E 131st Pl S, Bixby, Oklahoma 74008 Tulsa Other Unassigned Open Reply now Overdue by 3d Nov 21 |
| 476 | chip | P3 |
| 477 | chip | Unassigned |
| 478 | chip | Open |
| 479 | button | Select ticket 5066 |
| 480 | button | P3 Light fixtures require replacing #5076 4718 E Shadowbrook Dr, Camby, Indiana 46113 Indy Other Unassigned Open Reply now Overdue by 2d Nov 22 |
| 481 | chip | P3 |
| 482 | chip | Unassigned |
| 483 | chip | Open |
| 484 | button | Select ticket 5076 |
| 485 | button | P3 Broken kitchen chair #5078 817 Halley Dr., Moore, Oklahoma 73160 OKC Other Unassigned Open Reply now Overdue by 2d Nov 22 |
| 486 | chip | P3 |
| 487 | chip | Unassigned |
| 488 | chip | Open |
| 489 | button | Select ticket 5078 |
| 490 | button | P3 Dog poop #5079 1152 Western Yarrow Ave, Justin, Texas 76247 Fort Worth Other Unassigned Open Reply now Overdue by 2d Nov 22 |
| 491 | chip | P3 |
| 492 | chip | Unassigned |
| 493 | chip | Open |
| 494 | button | Select ticket 5079 |
| 495 | button | P3 Package #5080 4003 Bendale Rd, Benbrook, Texas 76116 Fort Worth Other Unassigned Open Reply now Overdue by 2d Nov 22 |
| 496 | chip | P3 |
| 497 | chip | Unassigned |
| 498 | chip | Open |
| 499 | button | Select ticket 5080 |
| 500 | button | P3 Broken towel rack #5081 628 Joy Ct, Burleson, Texas 76028 Fort Worth Other Unassigned Open Reply now Overdue by 2d Nov 22 |
| 501 | chip | P3 |
| 502 | chip | Unassigned |
| 503 | chip | Open |
| 504 | button | Select ticket 5081 |
| 505 | button | P3 Reservation #107555754 #5095 2522 S. Irvington Ave, Tulsa, Oklahoma 74114 Tulsa Other Unassigned Open Reply now Overdue by 34h Nov 23 |
| 506 | chip | P3 |
| 507 | chip | Unassigned |
| 508 | chip | Open |
| 509 | button | Select ticket 5095 |
| 510 | button | P3 Damage to kitchen table top #5096 3333 Welling Rd, Edmond, Oklahoma 73012 OKC Other Unassigned Open Reply now Overdue by 34h Nov 23 |
| 511 | chip | P3 |
| 512 | chip | Unassigned |
| 513 | chip | Open |
| 514 | button | Select ticket 5096 |
| 515 | button | P3 Needs a smoke alarm #5097 9120 Yassir Blvd, Yukon, Oklahoma 73099 OKC Other Unassigned Open Reply now Overdue by 34h Nov 23 |
| 516 | chip | P3 |
| 517 | chip | Unassigned |
| 518 | chip | Open |
| 519 | button | Select ticket 5097 |
| 520 | button | P3 Smoke alarm #5098 9120 Yassir Blvd, Yukon, Oklahoma 73099 OKC Other Unassigned Open Reply now Overdue by 34h Nov 23 |
| 521 | chip | P3 |
| 522 | chip | Unassigned |
| 523 | chip | Open |
| 524 | button | Select ticket 5098 |
| 525 | button | P3 3 broken coasters #5101 3333 Welling Rd, Edmond, Oklahoma 73012 OKC Other Unassigned Open Reply now Overdue by 30h Nov 23 |
| 526 | chip | P3 |
| 527 | chip | Unassigned |
| 528 | chip | Open |
| 529 | button | Select ticket 5101 |
| 530 | button | P3 Quarterly property review: 19104 Meadows Crossing Dr. #4891 19104 Meadows Crossing Dr., Edmond, Oklahoma 73012 OKC Quarterly inspection review Micah Sinor In progress Nov 23 Overdue by 1 day Nov 16 |
| 531 | chip | P3 |
| 532 | chip | In progress |
| 533 | button | Select ticket 4891 |
| 534 | button | P3 Reservation #107883011 #5124 33 Center Ln S, Carlton Landing, Oklahoma 74332 Carlton Landing Other Unassigned Open Reply now Overdue by 13h Today 7:20 AM |
| 535 | chip | P3 |
| 536 | chip | Unassigned |
| 537 | chip | Open |
| 538 | button | Select ticket 5124 |
| 539 | button | P3 Couch has small tear #5125 2004 Cedar Ridge Rd, Edmond, Oklahoma 73013 OKC Other Unassigned Open Reply now Overdue by 11h Today 10:17 AM |
| 540 | chip | P3 |
| 541 | chip | Unassigned |
| 542 | chip | Open |
| 543 | button | Select ticket 5125 |
| 544 | button | P3 Broken chair #5126 207 High Point Way, Justin, Texas 76247 Fort Worth Other Unassigned Open Reply now Overdue by 10h Today 10:28 AM |
| 545 | chip | P3 |
| 546 | chip | Unassigned |
| 547 | chip | Open |
| 548 | button | Select ticket 5126 |
| 549 | button | P3 Linens ruined. #5127 207 High Point Way, Justin, Texas 76247 Fort Worth Other Unassigned Open Reply now Overdue by 10h Today 10:31 AM |
| 550 | chip | P3 |
| 551 | chip | Unassigned |
| 552 | chip | Open |
| 553 | button | Select ticket 5127 |
| 554 | button | P3 Excessive trash. #5128 207 High Point Way, Justin, Texas 76247 Fort Worth Other Unassigned Open Reply now Overdue by 10h Today 10:32 AM |
| 555 | chip | P3 |
| 556 | chip | Unassigned |
| 557 | chip | Open |
| 558 | button | Select ticket 5128 |
| 559 | button | P3 Broken lamp #5129 2004 Cedar Ridge Rd, Edmond, Oklahoma 73013 OKC Other Unassigned Open Reply now Overdue by 10h Today 11:03 AM |
| 560 | chip | P3 |
| 561 | chip | Unassigned |
| 562 | chip | Open |
| 563 | button | Select ticket 5129 |
| 564 | button | P3 downstairs bathroom #5130 7422 S. Granite Ave, Tulsa, Oklahoma 74136 Tulsa Other Unassigned Open Reply now Overdue by 9h Today 12:02 PM |
| 565 | chip | P3 |
| 566 | chip | Unassigned |
| 567 | chip | Open |
| 568 | button | Select ticket 5130 |
| 569 | button | P3 Trash outside by front door #5131 3201 Belmont Circle, Edmond, Oklahoma 73034 OKC Other Unassigned Open Reply now Overdue by 5h Today 3:54 PM |
| 570 | chip | P3 |
| 571 | chip | Unassigned |
| 572 | chip | Open |
| 573 | button | Select ticket 5131 |
| 574 | button | Kanban |
| 575 | button | Calendar |
| 576 | heading | Pick up work |
| 577 | button, filter | Team A 0 |
| 578 | button, filter | Team B 40 |
| 579 | button, filter | All teams 40 |
| 580 | button, filter | All unclaimed 40 |
| 581 | heading | From Breezeway |
| 582 | button | Take it |
| 583 | chip | Breezeway |
| 584 | chip | P3 |
| 585 | button | Open in Breezeway |
| 586 | button | Take it |
| 587 | chip | Breezeway |
| 588 | chip | P3 |
| 589 | button | Open in Breezeway |
| 590 | button | Take it |
| 591 | chip | Breezeway |
| 592 | chip | P3 |
| 593 | button | Open in Breezeway |
| 594 | button | Take it |
| 595 | chip | Breezeway |
| 596 | chip | P3 |
| 597 | button | Open in Breezeway |
| 598 | button | Take it |
| 599 | chip | Breezeway |
| 600 | chip | P3 |
| 601 | button | Open in Breezeway |
| 602 | button | Take it |
| 603 | chip | Breezeway |
| 604 | chip | P3 |
| 605 | button | Open in Breezeway |
| 606 | button | Take it |
| 607 | chip | Breezeway |
| 608 | chip | P3 |
| 609 | button | Open in Breezeway |
| 610 | button | Take it |
| 611 | chip | Breezeway |
| 612 | chip | P3 |
| 613 | button | Open in Breezeway |
| 614 | button | Take it |
| 615 | chip | Breezeway |
| 616 | chip | P3 |
| 617 | button | Open in Breezeway |
| 618 | button | Take it |
| 619 | chip | Breezeway |
| 620 | chip | P3 |
| 621 | button | Open in Breezeway |
| 622 | button | Take it |
| 623 | chip | Breezeway |
| 624 | chip | P3 |
| 625 | button | Open in Breezeway |
| 626 | button | Take it |
| 627 | chip | Breezeway |
| 628 | chip | P3 |
| 629 | button | Open in Breezeway |
| 630 | button | Take it |
| 631 | chip | Breezeway |
| 632 | chip | P3 |
| 633 | button | Open in Breezeway |
| 634 | button | Take it |
| 635 | chip | Breezeway |
| 636 | chip | P3 |
| 637 | button | Open in Breezeway |
| 638 | button | Take it |
| 639 | chip | Breezeway |
| 640 | chip | P3 |
| 641 | button | Open in Breezeway |
| 642 | button | Take it |
| 643 | chip | Breezeway |
| 644 | chip | P3 |
| 645 | button | Open in Breezeway |
| 646 | button | Take it |
| 647 | chip | Breezeway |
| 648 | chip | P3 |
| 649 | button | Open in Breezeway |
| 650 | button | Take it |
| 651 | chip | Breezeway |
| 652 | chip | P3 |
| 653 | button | Open in Breezeway |
| 654 | button | Take it |
| 655 | chip | Breezeway |
| 656 | chip | P3 |
| 657 | button | Open in Breezeway |
| 658 | button | Take it |
| 659 | chip | Breezeway |
| 660 | chip | P3 |
| 661 | button | Open in Breezeway |
| 662 | button | Take it |
| 663 | chip | Breezeway |
| 664 | chip | P3 |
| 665 | button | Open in Breezeway |
| 666 | button | Take it |
| 667 | chip | Breezeway |
| 668 | chip | P3 |
| 669 | button | Open in Breezeway |
| 670 | button | Take it |
| 671 | chip | Breezeway |
| 672 | chip | P3 |
| 673 | button | Open in Breezeway |
| 674 | button | Take it |
| 675 | chip | Breezeway |
| 676 | chip | P3 |
| 677 | button | Open in Breezeway |
| 678 | button | Take it |
| 679 | chip | Breezeway |
| 680 | chip | P3 |
| 681 | button | Open in Breezeway |
| 682 | button | Take it |
| 683 | chip | Breezeway |
| 684 | chip | P3 |
| 685 | button | Open in Breezeway |
| 686 | button | Take it |
| 687 | chip | Breezeway |
| 688 | chip | P3 |
| 689 | button | Open in Breezeway |
| 690 | button | Take it |
| 691 | chip | Breezeway |
| 692 | chip | P3 |
| 693 | button | Open in Breezeway |
| 694 | button | Take it |
| 695 | chip | Breezeway |
| 696 | chip | P3 |
| 697 | button | Open in Breezeway |
| 698 | button | Take it |
| 699 | chip | Breezeway |
| 700 | chip | P3 |
| 701 | button | Open in Breezeway |
| 702 | button | Take it |
| 703 | chip | Breezeway |
| 704 | chip | P3 |
| 705 | button | Open in Breezeway |
| 706 | button | Take it |
| 707 | chip | Breezeway |
| 708 | chip | P3 |
| 709 | button | Open in Breezeway |
| 710 | button | Take it |
| 711 | chip | Breezeway |
| 712 | chip | P3 |
| 713 | button | Open in Breezeway |
| 714 | button | Take it |
| 715 | chip | Breezeway |
| 716 | chip | P3 |
| 717 | button | Open in Breezeway |
| 718 | button | Take it |
| 719 | chip | Breezeway |
| 720 | chip | P3 |
| 721 | button | Open in Breezeway |
| 722 | button | Take it |
| 723 | chip | Breezeway |
| 724 | chip | P3 |
| 725 | button | Open in Breezeway |
| 726 | button | Take it |
| 727 | chip | Breezeway |
| 728 | chip | P3 |
| 729 | button | Open in Breezeway |
| 730 | button | Take it |
| 731 | chip | Breezeway |
| 732 | chip | P3 |
| 733 | button | Open in Breezeway |
| 734 | button | Take it |
| 735 | chip | Breezeway |
| 736 | chip | P3 |
| 737 | button | Open in Breezeway |
| 738 | button | Take it |
| 739 | chip | Breezeway |
| 740 | chip | P3 |
| 741 | button | Open in Breezeway |
| 742 | button | Show |
| 743 | heading | Imported from Notion |

**Appears more than once:** button: Toggle Sidebar × 2; chip: 1 × 2; button: Unassigned 40 × 2; chip: P2 × 24; chip: In progress × 8; chip: Open × 107; chip: P3 × 135; chip: Unassigned × 40; button: Take it × 40; chip: Breezeway × 40; button: Open in Breezeway × 40.

### desktop-open-ticket-panel.png

Screen: Open ticket panel. Viewer: Emily. PNG: 1440 × 2463.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Open full page |
| 2 | button | Close Ticket |
| 3 | heading | Ticket |
| 4 | heading | The Door in the bedroom fell down. The carpet is dirty |
| 5 | button | More |
| 6 | button | Due date Nov 16. Change the due date |
| 7 | button | Close ticket |
| 8 | button | Reopen ticket (disabled) |
| 9 | chip | Logged |
| 10 | chip | Fix it |
| 11 | chip | Done |
| 12 | heading | Do this now |
| 13 | button | Change next step |
| 14 | heading | CLEANING COMPLAINT · STEP 2 |
| 15 | heading | Get photos or video from the guest. |
| 16 | button | Attached |
| 17 | button | Guest won't send |
| 18 | button | Choose an answer. (disabled) |
| 19 | button | This doesn't apply |
| 20 | button | Edit step 1 |
| 21 | button | Show vendor and work order tools |
| 22 | button | Waiting on someone? |
| 23 | card | Make it right |
| 24 | button | lucide-chevron-down |
| 25 | heading | Make it right |
| 26 | button | Yes |
| 27 | button | No |
| 28 | button | Yes, open a claim |
| 29 | heading | DETAILS |
| 30 | filter | Add an update: who you called, what the vendor found, what the guest said… |
| 31 | button | lucide-building-2 |
| 32 | button | lucide-send |
| 33 | button | lucide-send |
| 34 | heading | Unnamed heading |
| 35 | button | lucide-external-link |
| 36 | button | View 8fa496d3-4613-4ddb-8cba-da8602df77bd.jpeg |
| 37 | button | Download 8fa496d3-4613-4ddb-8cba-da8602df77bd.jpeg |
| 38 | button | Remove 8fa496d3-4613-4ddb-8cba-da8602df77bd.jpeg |
| 39 | button, filter | Issue is tied to |
| 40 | button, filter | Active-stay impact |
| 41 | button, filter | Guest communication required |
| 42 | button | lucide-external-link |
| 43 | button | lucide-external-link |

**Appears more than once:** button: lucide-send × 2; button: lucide-external-link × 3.

### desktop-team-queue-team-b-maintenance.png

Screen: Team Queue Team B Maintenance. Viewer: Emily. PNG: 1440 × 11672.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Toggle Sidebar |
| 2 | button | Resolve EXECUTIVE ADMINISTRATION |
| 3 | button | Search Resolve ⌘K |
| 4 | button | Record work |
| 5 | button | Record routine work |
| 6 | button | Take the tour |
| 7 | button | Alerts and escalations |
| 8 | button | Chats, 1 unread |
| 9 | button | Notifications |
| 10 | button | Switch to dark mode |
| 11 | chip | 1 |
| 12 | button | Toggle Sidebar |
| 13 | button | Portals |
| 14 | button | Sign out (Admin) |
| 15 | heading | MY DAY |
| 16 | button | Home |
| 17 | heading | Team Queue |
| 18 | filter | Search by title or home |
| 19 | button | Filter 1 |
| 20 | button | Clear 1 filter |
| 21 | button | Team Queue |
| 22 | button | Direct Bookings |
| 23 | button, filter | Priority |
| 24 | button, filter | Status |
| 25 | button, filter | Person |
| 26 | button | Work Orders |
| 27 | button, tab | All team 117 |
| 28 | button, tab | Team A 3 |
| 29 | button, tab | Team B 140 |
| 30 | button, tab | Only mine 1 |
| 31 | button, tab | Unassigned 40 |
| 32 | chip | 117 |
| 33 | chip | 3 |
| 34 | chip | 140 |
| 35 | chip | 1 |
| 36 | chip | 40 |
| 37 | button | Databases |
| 38 | button, tab | Maintenance 73 |
| 39 | button, tab | Reported issues 13 |
| 40 | button, tab | Cleaning reviews 0 |
| 41 | button, tab | Inspection reviews 0 |
| 42 | button, tab | Lawn care reviews 54 |
| 43 | chip | 73 |
| 44 | chip | 13 |
| 45 | chip | 0 |
| 46 | chip | 0 |
| 47 | chip | 54 |
| 48 | button | Oversight 4 |
| 49 | chip | 1 handoff waiting to be accepted, 3 missed shift ends today |
| 50 | button, filter | Due today 73 |
| 51 | button, filter | This week 91 |
| 52 | button, filter | Next week 0 |
| 53 | button, filter | Closed 14 |
| 54 | button | Guest Claims & Refunds |
| 55 | table | Table |
| 56 | button | New House Setup - Stage Decor |
| 57 | heading | TEAM |
| 58 | button | Team and Coverage |
| 59 | button | Stock Supply Box |
| 60 | button | Playbooks |
| 61 | button | Change Smoke Detector Batteries |
| 62 | button | Guest-ready standards |
| 63 | button | New House Setup - Press Curtains |
| 64 | heading | HOMES AND OWNERS |
| 65 | button | Properties |
| 66 | button | Island is missing a piece of wood and it needs paint touch up |
| 67 | button | Onboarding |
| 68 | button | Install Air Filters |
| 69 | button | Active Owner |
| 70 | button | New House Setup - Setting Up ROKU TVs & Storing Remotes |
| 71 | button | Quarterly Reviews |
| 72 | button | Spare Front Door Key |
| 73 | heading | INSIGHT |
| 74 | button | Analytics |
| 75 | button | Carpet Cleaning + Curtain Replacement |
| 76 | heading | ADMIN |
| 77 | button | Hall bath tub - stopper |
| 78 | button | Admin tools |
| 79 | button | Fireplace not working + clogged toilet |
| 80 | button | View as |
| 81 | button | Onsite Inspection & Quote Collection – 401 E. 10th St. |
| 82 | button | Haulaway Bins |
| 83 | button | Repair Loose Front Door Handle & Toilet Paper Holder – 9211 |
| 84 | button | Repair Broken Dining Chair – 817 Halley Dr. |
| 85 | button | Amazon Return: Ironing Board |
| 86 | button | carpet cleaning |
| 87 | button | Inspect and Repair AC Unit – 2617 W Madison St |
| 88 | button | New House Setup - Prep Property / Meet Photographer |
| 89 | button | Delivering the TV remote |
| 90 | button | Front Door Lock - Low Battery |
| 91 | button | My account |
| 92 | button | Trash Removal and Disposal – 3333 Welling Rd |
| 93 | button | Help & Feedback |
| 94 | button | Remove and Dispose of Excess Trash – 19013 Meadows Crossing |
| 95 | button | Bathroom Vanity Lights Flickering – Inspection and Repair |
| 96 | button | Front Door Lock - Low Battery |
| 97 | button | Carpet stain |
| 98 | button | Carpet/ rug shampooing. |
| 99 | button | Back patio/furniture |
| 100 | button | Driveway stains. |
| 101 | button | trash haulaway |
| 102 | button | Front Door Lock - Low Battery |
| 103 | button | Purchase and Install Garage Door Opener – 9120 Yassir |
| 104 | button | Check Low Water Pressure in Bathroom – 3000 |
| 105 | button | Trash Removal Before Guest Check-In |
| 106 | button | Dead Animal Removal – 10320 |
| 107 | button | fix drywall hole |
| 108 | button | Recharge Ring Doorbell Camera |
| 109 | button | Front Door Lock - Low Battery |
| 110 | button | TEST - Work Order Instructions for Breezeway |
| 111 | button | Front Door Lock - Low Battery |
| 112 | button | Walmart Return Items |
| 113 | button | Bedroom Carpet Cleaning – Dog Urine Odor |
| 114 | button | Light fixtures require replacing |
| 115 | button | Haulaway |
| 116 | button | Front Door Lock - Low Battery |
| 117 | button | Front Door Lock - Low Battery |
| 118 | button | Front Door Lock - Low Battery |
| 119 | button | Kitchen Disposal Replacement |
| 120 | button | Reservation #64895038 |
| 121 | button | Shower Curtain Replacement |
| 122 | button | Haulaway Bins |
| 123 | button | Haul the trash + Broken Bed Board |
| 124 | button | loose toilet |
| 125 | button | The Master Bather Shower is Faulty |
| 126 | button | Inspect and Repair Master Bathroom Shower Head |
| 127 | button | Front Door Lock - Low Battery |
| 128 | button | Garage Door is Broken. |
| 129 | table | Open tickets |
| 130 | button | P2, hide rows |
| 131 | chip | P2 |
| 132 | button | Guest review: Reported issue: Shower head is not working properly. Needs fixing. Manual 2016 NW 172ND, Edmond, Oklahoma 73012 OKC P2 Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 7d Nov 17 |
| 133 | button | Add an update to ticket 4976 |
| 134 | chip | P2 |
| 135 | chip | Open |
| 136 | button | The washer at 7422 has a reported broken timer and may require repair or replacement. Please review the previous updates, confirm the washer Manual 7422 S. Granite Ave, Tulsa, Oklahoma 74136 Tulsa P2 Immediate maintenance Qym Fuenteblanca Team B Open Start work Overdue by 7d Nov 17 |
| 137 | button | Add an update to ticket 4978 |
| 138 | chip | P2 |
| 139 | chip | Open |
| 140 | button | The garage door is broken. It came off the track Manual 5020 S 168th East Ave, Tulsa, Oklahoma 74134 Tulsa P2 Maintenance and landscaping work-order review Qym Fuenteblanca Team B In progress Nov 17 Overdue by 7 days Nov 17 |
| 141 | button | Add an update to ticket 4974 |
| 142 | chip | P2 |
| 143 | chip | In progress |
| 144 | button | 2014 - get carpet quote to replace Manual 2014 E 52nd St, Tulsa, Oklahoma 74105 Tulsa P2 Other Romeo Canales Team B Waiting on owner Nov 20 · 8:00 AM Overdue by 5d Nov 3 |
| 145 | button | Add an update to ticket 1509 |
| 146 | chip | P2 |
| 147 | chip | Waiting on owner |
| 148 | button | to reach out to owner on considering to replace the carpet Manual 3712 N 39th St., Broken Arrow, Oklahoma 74014 Tulsa P2 Ongoing maintenance Romeo Canales Team B Open Start work Overdue by 4d Nov 20 |
| 149 | button | Add an update to ticket 5048 |
| 150 | chip | P2 |
| 151 | chip | Open |
| 152 | button | 16401 - dryer not working Manual 16401 Villa Valeria Way, Edmond, Oklahoma 73013 OKC P2 Other Romeo Canales Team B Open Reply now Overdue by 4d Oct 27 |
| 153 | button | Add an update to ticket 1476 |
| 154 | chip | P2 |
| 155 | chip | Open |
| 156 | button | 5923 - yale lock disconnected Manual 5923 Hollyhock Ln, Montgomery, Texas 77316 Houston P2 Other Romeo Canales Team B Waiting on vendor Nov 23 · 8:00 AM Overdue by 39h Oct 29 |
| 157 | button | Add an update to ticket 1487 |
| 158 | chip | P2 |
| 159 | chip | Waiting on vendor |
| 160 | button | one of dining chairs was broken Manual 4607 W Union St, Broken Arrow, Oklahoma 74011 Tulsa P2 Immediate maintenance Qym Fuenteblanca Team B Open Start work Overdue by 29h Nov 23 |
| 161 | button | Add an update to ticket 5104 |
| 162 | chip | P2 |
| 163 | chip | Open |
| 164 | button | 7006 project. This home is missing quite a few standard items that we need ordered and then a few things need replaced. Manual 7006 E 154th St S, Bixby, Oklahoma 74008 Tulsa P2 Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 28h Nov 23 |
| 165 | button | Add an update to ticket 5102 |
| 166 | chip | P2 |
| 167 | chip | Open |
| 168 | button | bathroom mirror broken Manual 18200 Bodegon Rd., Edmond, Oklahoma 73012 OKC P2 Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 28h Nov 23 |
| 169 | button | Add an update to ticket 5103 |
| 170 | chip | P2 |
| 171 | chip | Open |
| 172 | button | small tear/rip in couch Manual 2004 Cedar Ridge Rd, Edmond, Oklahoma 73013 OKC P2 Ongoing maintenance Romeo Canales Team B Open Start work Overdue by 6h Today 4:43 PM |
| 173 | button | Add an update to ticket 5132 |
| 174 | chip | P2 |
| 175 | chip | Open |
| 176 | button | broken coasters Manual 3333 Welling Rd, Edmond, Oklahoma 73012 OKC P2 Ongoing maintenance Romeo Canales Team B Open Start work Overdue by 6h Today 4:46 PM |
| 177 | button | Add an update to ticket 5133 |
| 178 | chip | P2 |
| 179 | chip | Open |
| 180 | button | towel rack repair Manual 628 Joy Ct, Burleson, Texas 76028 Fort Worth P2 Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:04 PM |
| 181 | button | Add an update to ticket 5134 |
| 182 | chip | P2 |
| 183 | chip | Open |
| 184 | button | repair dining chair Manual 817 Halley Dr., Moore, Oklahoma 73160 OKC P2 Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:06 PM |
| 185 | button | Add an update to ticket 5135 |
| 186 | chip | P2 |
| 187 | chip | Open |
| 188 | button | backyard needs mowed Manual 1169 Blue Sky Lane, Burleson, Texas 76028 Fort Worth P2 Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:23 PM |
| 189 | button | Add an update to ticket 5136 |
| 190 | chip | P2 |
| 191 | chip | Open |
| 192 | button | toilet paper holder Manual 845 Alexandria Ln, Joshua, Texas 76058-6216 Fort Worth P2 Immediate maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:52 PM |
| 193 | button | Add an update to ticket 5137 |
| 194 | chip | P2 |
| 195 | chip | Open |
| 196 | button | Kanban |
| 197 | button | Calendar |
| 198 | heading | Pick up work |
| 199 | button, filter | Team A 0 |
| 200 | button, filter | Team B 40 |
| 201 | button, filter | All teams 40 |
| 202 | button, filter | All unclaimed 40 |
| 203 | heading | From Breezeway |
| 204 | button | Take it |
| 205 | chip | Breezeway |
| 206 | chip | P3 |
| 207 | button | Open in Breezeway |
| 208 | button | Take it |
| 209 | chip | Breezeway |
| 210 | chip | P3 |
| 211 | button | Open in Breezeway |
| 212 | button | Take it |
| 213 | chip | Breezeway |
| 214 | chip | P3 |
| 215 | button | Open in Breezeway |
| 216 | button | Take it |
| 217 | chip | Breezeway |
| 218 | chip | P3 |
| 219 | button | Open in Breezeway |
| 220 | button | Take it |
| 221 | chip | Breezeway |
| 222 | chip | P3 |
| 223 | button | Open in Breezeway |
| 224 | button | Take it |
| 225 | chip | Breezeway |
| 226 | chip | P3 |
| 227 | button | Open in Breezeway |
| 228 | button | Take it |
| 229 | chip | Breezeway |
| 230 | chip | P3 |
| 231 | button | Open in Breezeway |
| 232 | button | Take it |
| 233 | chip | Breezeway |
| 234 | chip | P3 |
| 235 | button | Open in Breezeway |
| 236 | button | Take it |
| 237 | chip | Breezeway |
| 238 | chip | P3 |
| 239 | button | Open in Breezeway |
| 240 | button | Take it |
| 241 | chip | Breezeway |
| 242 | chip | P3 |
| 243 | button | Open in Breezeway |
| 244 | button | Take it |
| 245 | chip | Breezeway |
| 246 | chip | P3 |
| 247 | button | Open in Breezeway |
| 248 | button | Take it |
| 249 | chip | Breezeway |
| 250 | chip | P3 |
| 251 | button | Open in Breezeway |
| 252 | button | Take it |
| 253 | chip | Breezeway |
| 254 | chip | P3 |
| 255 | button | Open in Breezeway |
| 256 | button | Take it |
| 257 | chip | Breezeway |
| 258 | chip | P3 |
| 259 | button | Open in Breezeway |
| 260 | button | Take it |
| 261 | chip | Breezeway |
| 262 | chip | P3 |
| 263 | button | Open in Breezeway |
| 264 | button | Take it |
| 265 | chip | Breezeway |
| 266 | chip | P3 |
| 267 | button | Open in Breezeway |
| 268 | button | Take it |
| 269 | chip | Breezeway |
| 270 | chip | P3 |
| 271 | button | Open in Breezeway |
| 272 | button | Take it |
| 273 | chip | Breezeway |
| 274 | chip | P3 |
| 275 | button | Open in Breezeway |
| 276 | button | Take it |
| 277 | chip | Breezeway |
| 278 | chip | P3 |
| 279 | button | Open in Breezeway |
| 280 | button | Take it |
| 281 | chip | Breezeway |
| 282 | chip | P3 |
| 283 | button | Open in Breezeway |
| 284 | button | Take it |
| 285 | chip | Breezeway |
| 286 | chip | P3 |
| 287 | button | Open in Breezeway |
| 288 | button | Take it |
| 289 | chip | Breezeway |
| 290 | chip | P3 |
| 291 | button | Open in Breezeway |
| 292 | button | Take it |
| 293 | chip | Breezeway |
| 294 | chip | P3 |
| 295 | button | Open in Breezeway |
| 296 | button | Take it |
| 297 | chip | Breezeway |
| 298 | chip | P3 |
| 299 | button | Open in Breezeway |
| 300 | button | Take it |
| 301 | chip | Breezeway |
| 302 | chip | P3 |
| 303 | button | Open in Breezeway |
| 304 | button | Take it |
| 305 | chip | Breezeway |
| 306 | chip | P3 |
| 307 | button | Open in Breezeway |
| 308 | button | Take it |
| 309 | chip | Breezeway |
| 310 | chip | P3 |
| 311 | button | Open in Breezeway |
| 312 | button | Take it |
| 313 | chip | Breezeway |
| 314 | chip | P3 |
| 315 | button | Open in Breezeway |
| 316 | button | Take it |
| 317 | chip | Breezeway |
| 318 | chip | P3 |
| 319 | button | Open in Breezeway |
| 320 | button | Take it |
| 321 | chip | Breezeway |
| 322 | chip | P3 |
| 323 | button | Open in Breezeway |
| 324 | button | Take it |
| 325 | chip | Breezeway |
| 326 | chip | P3 |
| 327 | button | Open in Breezeway |
| 328 | button | Take it |
| 329 | chip | Breezeway |
| 330 | chip | P3 |
| 331 | button | Open in Breezeway |
| 332 | button | Take it |
| 333 | chip | Breezeway |
| 334 | chip | P3 |
| 335 | button | Open in Breezeway |
| 336 | button | Take it |
| 337 | chip | Breezeway |
| 338 | chip | P3 |
| 339 | button | Open in Breezeway |
| 340 | button | Take it |
| 341 | chip | Breezeway |
| 342 | chip | P3 |
| 343 | button | Open in Breezeway |
| 344 | button | Take it |
| 345 | chip | Breezeway |
| 346 | chip | P3 |
| 347 | button | Open in Breezeway |
| 348 | button | Take it |
| 349 | chip | Breezeway |
| 350 | chip | P3 |
| 351 | button | Open in Breezeway |
| 352 | button | Take it |
| 353 | chip | Breezeway |
| 354 | chip | P3 |
| 355 | button | Open in Breezeway |
| 356 | button | Take it |
| 357 | chip | Breezeway |
| 358 | chip | P3 |
| 359 | button | Open in Breezeway |
| 360 | button | Take it |
| 361 | chip | Breezeway |
| 362 | chip | P3 |
| 363 | button | Open in Breezeway |
| 364 | button | Show |
| 365 | heading | Imported from Notion |

**Appears more than once:** button: Toggle Sidebar × 2; chip: 1 × 2; chip: 0 × 2; button: Haulaway Bins × 2; button: Front Door Lock - Low Battery × 9; chip: P2 × 17; chip: Open × 13; button: Take it × 40; chip: Breezeway × 40; chip: P3 × 40; button: Open in Breezeway × 40.

### desktop-team-queue-team-b-reported-issues.png

Screen: Team Queue Team B Reported issues. Viewer: Emily. PNG: 1440 × 7728.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Toggle Sidebar |
| 2 | button | Resolve EXECUTIVE ADMINISTRATION |
| 3 | button | Search Resolve ⌘K |
| 4 | button | Record work |
| 5 | button | Record routine work |
| 6 | button | Take the tour |
| 7 | button | Alerts and escalations |
| 8 | button | Chats, 1 unread |
| 9 | button | Notifications |
| 10 | button | Switch to dark mode |
| 11 | chip | 1 |
| 12 | button | Toggle Sidebar |
| 13 | button | Portals |
| 14 | button | Sign out (Admin) |
| 15 | heading | MY DAY |
| 16 | button | Home |
| 17 | heading | Team Queue |
| 18 | filter | Search by title or home |
| 19 | button | Filter 1 |
| 20 | button | Clear 1 filter |
| 21 | button | Team Queue |
| 22 | button | Direct Bookings |
| 23 | button, filter | Priority |
| 24 | button, filter | Status |
| 25 | button, filter | Person |
| 26 | button | Work Orders |
| 27 | button, tab | All team 117 |
| 28 | button, tab | Team A 3 |
| 29 | button, tab | Team B 140 |
| 30 | button, tab | Only mine 1 |
| 31 | button, tab | Unassigned 40 |
| 32 | chip | 117 |
| 33 | chip | 3 |
| 34 | chip | 140 |
| 35 | chip | 1 |
| 36 | chip | 40 |
| 37 | button | Databases |
| 38 | button, tab | Maintenance 73 |
| 39 | button, tab | Reported issues 13 |
| 40 | button, tab | Cleaning reviews 0 |
| 41 | button, tab | Inspection reviews 0 |
| 42 | button, tab | Lawn care reviews 54 |
| 43 | chip | 73 |
| 44 | chip | 13 |
| 45 | chip | 0 |
| 46 | chip | 0 |
| 47 | chip | 54 |
| 48 | button | Oversight 4 |
| 49 | chip | 1 handoff waiting to be accepted, 3 missed shift ends today |
| 50 | button, filter | Due today 13 |
| 51 | button, filter | This week 27 |
| 52 | button, filter | Next week 13 |
| 53 | button, filter | Closed 0 |
| 54 | button | Guest Claims & Refunds |
| 55 | table | Open tickets |
| 56 | button | P3, hide rows |
| 57 | heading | TEAM |
| 58 | chip | P3 |
| 59 | button | Team and Coverage |
| 60 | button | FROM PREVIOUS TURNS- NOT ADDRESSED Breezeway reported issue 845 Alexandria Ln, Joshua, Texas 76058-6216 Fort Worth P3 Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 61 | button | Add an update to ticket 4931 |
| 62 | chip | P3 |
| 63 | chip | Unassigned |
| 64 | chip | Open |
| 65 | button | Playbooks |
| 66 | button | 2 reported issues Breezeway reported issue Show issues 3000 W Charlotte St, Broken Arrow, Oklahoma 74011 Tulsa P3 Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 67 | button | Add an update to ticket 4933 |
| 68 | button | Guest-ready standards |
| 69 | chip | P3 |
| 70 | chip | Unassigned |
| 71 | chip | Open |
| 72 | button | Show issues |
| 73 | heading | HOMES AND OWNERS |
| 74 | button | Broken kitchen table chair Breezeway reported issue 817 Halley Dr., Moore, Oklahoma 73160 OKC P3 Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 75 | button | Add an update to ticket 4934 |
| 76 | chip | P3 |
| 77 | chip | Unassigned |
| 78 | chip | Open |
| 79 | button | Properties |
| 80 | button | Broken lamp Breezeway reported issue 14553 Serrano Ridge Dr, Ft. Worth, Texas 76052 Fort Worth P3 Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 81 | button | Add an update to ticket 4939 |
| 82 | chip | P3 |
| 83 | chip | Unassigned |
| 84 | chip | Open |
| 85 | button | Onboarding |
| 86 | button | Trash Breezeway reported issue 4003 Bendale Rd, Benbrook, Texas 76116 Fort Worth P3 Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 87 | button | Add an update to ticket 4940 |
| 88 | button | Active Owner |
| 89 | chip | P3 |
| 90 | chip | Unassigned |
| 91 | chip | Open |
| 92 | button | 6 reported issues Breezeway reported issue Show issues 136 Magnolia Estates St., Crowley, Texas 76036 Fort Worth P3 Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 93 | button | Quarterly Reviews |
| 94 | button | Add an update to ticket 4966 |
| 95 | chip | P3 |
| 96 | chip | Unassigned |
| 97 | chip | Open |
| 98 | button | Show issues |
| 99 | heading | INSIGHT |
| 100 | button | Guest bathroom Breezeway reported issue 904 NE 34th Ter, Moore, Oklahoma 73160 OKC P3 Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 101 | button | Analytics |
| 102 | button | Add an update to ticket 4975 |
| 103 | chip | P3 |
| 104 | chip | Unassigned |
| 105 | chip | Open |
| 106 | heading | ADMIN |
| 107 | button | Kanban |
| 108 | button | Calendar |
| 109 | button | Admin tools |
| 110 | button | View as |
| 111 | heading | Pick up work |
| 112 | button, filter | Team A 0 |
| 113 | button, filter | Team B 40 |
| 114 | button, filter | All teams 40 |
| 115 | button, filter | All unclaimed 40 |
| 116 | heading | From Breezeway |
| 117 | button | Take it |
| 118 | chip | Breezeway |
| 119 | chip | P3 |
| 120 | button | Open in Breezeway |
| 121 | button | Take it |
| 122 | chip | Breezeway |
| 123 | chip | P3 |
| 124 | button | Open in Breezeway |
| 125 | button | Take it |
| 126 | chip | Breezeway |
| 127 | chip | P3 |
| 128 | button | Open in Breezeway |
| 129 | button | Take it |
| 130 | button | My account |
| 131 | chip | Breezeway |
| 132 | chip | P3 |
| 133 | button | Help & Feedback |
| 134 | button | Open in Breezeway |
| 135 | button | Take it |
| 136 | chip | Breezeway |
| 137 | chip | P3 |
| 138 | button | Open in Breezeway |
| 139 | button | Take it |
| 140 | chip | Breezeway |
| 141 | chip | P3 |
| 142 | button | Open in Breezeway |
| 143 | button | Take it |
| 144 | chip | Breezeway |
| 145 | chip | P3 |
| 146 | button | Open in Breezeway |
| 147 | button | Take it |
| 148 | chip | Breezeway |
| 149 | chip | P3 |
| 150 | button | Open in Breezeway |
| 151 | button | Take it |
| 152 | chip | Breezeway |
| 153 | chip | P3 |
| 154 | button | Open in Breezeway |
| 155 | button | Take it |
| 156 | chip | Breezeway |
| 157 | chip | P3 |
| 158 | button | Open in Breezeway |
| 159 | button | Take it |
| 160 | chip | Breezeway |
| 161 | chip | P3 |
| 162 | button | Open in Breezeway |
| 163 | button | Take it |
| 164 | chip | Breezeway |
| 165 | chip | P3 |
| 166 | button | Open in Breezeway |
| 167 | button | Take it |
| 168 | chip | Breezeway |
| 169 | chip | P3 |
| 170 | button | Open in Breezeway |
| 171 | button | Take it |
| 172 | chip | Breezeway |
| 173 | chip | P3 |
| 174 | button | Open in Breezeway |
| 175 | button | Take it |
| 176 | chip | Breezeway |
| 177 | chip | P3 |
| 178 | button | Open in Breezeway |
| 179 | button | Take it |
| 180 | chip | Breezeway |
| 181 | chip | P3 |
| 182 | button | Open in Breezeway |
| 183 | button | Take it |
| 184 | chip | Breezeway |
| 185 | chip | P3 |
| 186 | button | Open in Breezeway |
| 187 | button | Take it |
| 188 | chip | Breezeway |
| 189 | chip | P3 |
| 190 | button | Open in Breezeway |
| 191 | button | Take it |
| 192 | chip | Breezeway |
| 193 | chip | P3 |
| 194 | button | Open in Breezeway |
| 195 | button | Take it |
| 196 | chip | Breezeway |
| 197 | chip | P3 |
| 198 | button | Open in Breezeway |
| 199 | button | Take it |
| 200 | chip | Breezeway |
| 201 | chip | P3 |
| 202 | button | Open in Breezeway |
| 203 | button | Take it |
| 204 | chip | Breezeway |
| 205 | chip | P3 |
| 206 | button | Open in Breezeway |
| 207 | button | Take it |
| 208 | chip | Breezeway |
| 209 | chip | P3 |
| 210 | button | Open in Breezeway |
| 211 | button | Take it |
| 212 | chip | Breezeway |
| 213 | chip | P3 |
| 214 | button | Open in Breezeway |
| 215 | button | Take it |
| 216 | chip | Breezeway |
| 217 | chip | P3 |
| 218 | button | Open in Breezeway |
| 219 | button | Take it |
| 220 | chip | Breezeway |
| 221 | chip | P3 |
| 222 | button | Open in Breezeway |
| 223 | button | Take it |
| 224 | chip | Breezeway |
| 225 | chip | P3 |
| 226 | button | Open in Breezeway |
| 227 | button | Take it |
| 228 | chip | Breezeway |
| 229 | chip | P3 |
| 230 | button | Open in Breezeway |
| 231 | button | Take it |
| 232 | chip | Breezeway |
| 233 | chip | P3 |
| 234 | button | Open in Breezeway |
| 235 | button | Take it |
| 236 | chip | Breezeway |
| 237 | chip | P3 |
| 238 | button | Open in Breezeway |
| 239 | button | Take it |
| 240 | chip | Breezeway |
| 241 | chip | P3 |
| 242 | button | Open in Breezeway |
| 243 | button | Take it |
| 244 | chip | Breezeway |
| 245 | chip | P3 |
| 246 | button | Open in Breezeway |
| 247 | button | Take it |
| 248 | chip | Breezeway |
| 249 | chip | P3 |
| 250 | button | Open in Breezeway |
| 251 | button | Take it |
| 252 | chip | Breezeway |
| 253 | chip | P3 |
| 254 | button | Open in Breezeway |
| 255 | button | Take it |
| 256 | chip | Breezeway |
| 257 | chip | P3 |
| 258 | button | Open in Breezeway |
| 259 | button | Take it |
| 260 | chip | Breezeway |
| 261 | chip | P3 |
| 262 | button | Open in Breezeway |
| 263 | button | Take it |
| 264 | chip | Breezeway |
| 265 | chip | P3 |
| 266 | button | Open in Breezeway |
| 267 | button | Take it |
| 268 | chip | Breezeway |
| 269 | chip | P3 |
| 270 | button | Open in Breezeway |
| 271 | button | Take it |
| 272 | chip | Breezeway |
| 273 | chip | P3 |
| 274 | button | Open in Breezeway |
| 275 | button | Take it |
| 276 | chip | Breezeway |
| 277 | chip | P3 |
| 278 | button | Open in Breezeway |
| 279 | button | Show |
| 280 | heading | Imported from Notion |

**Appears more than once:** button: Toggle Sidebar × 2; chip: 1 × 2; chip: 0 × 2; chip: P3 × 48; chip: Unassigned × 7; chip: Open × 7; button: Show issues × 2; button: Take it × 40; chip: Breezeway × 40; button: Open in Breezeway × 40.

### desktop-new-ticket.png

Screen: New ticket. Viewer: Emily. PNG: 1440 × 1800.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Close |
| 2 | heading | Record work |
| 3 | button | Ask the Coach |
| 4 | button, filter | Which home? |
| 5 | button, filter | Ticket type |
| 6 | button | Add photo |
| 7 | button, filter | Speak |
| 8 | filter | What did you do? |
| 9 | button | Send Breezeway work order now |
| 10 | button | Create ticket (disabled) |
| 11 | button | One touch: nothing more to do. Save to home history. (disabled) |

**Appears more than once:** No exact repeated label detected in the counted foreground surface..

### desktop-routine-work.png

Screen: Routine Work. Viewer: Emily. PNG: 1440 × 21003.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Toggle Sidebar |
| 2 | button | Resolve EXECUTIVE ADMINISTRATION |
| 3 | button | Search Resolve ⌘K |
| 4 | button | Record work |
| 5 | button | Record routine work |
| 6 | button | Take the tour |
| 7 | button | Alerts and escalations |
| 8 | button | Chats, 1 unread |
| 9 | button | Notifications |
| 10 | button | Switch to dark mode |
| 11 | chip | 1 |
| 12 | button | Toggle Sidebar |
| 13 | button | Portals |
| 14 | button | Sign out (Admin) |
| 15 | heading | MY DAY |
| 16 | button | Home |
| 17 | button | Team Queue |
| 18 | heading | 105 routine checks are late |
| 19 | button | Direct Bookings |
| 20 | button | Record routine work |
| 21 | button | My team |
| 22 | button | Everything |
| 23 | button | Work Orders |
| 24 | card | Arrival checks · 90 |
| 25 | button | Databases |
| 26 | heading | Arrival checks · 90 |
| 27 | button | Oversight 4 |
| 28 | table | arrival-checks |
| 29 | chip | 1 handoff waiting to be accepted, 3 missed shift ends today |
| 30 | button | Take it |
| 31 | button | Open |
| 32 | button | Guest Claims & Refunds |
| 33 | button | Take it |
| 34 | button | Open |
| 35 | heading | TEAM |
| 36 | button | Take it |
| 37 | button | Open |
| 38 | button | Team and Coverage |
| 39 | button | Take it |
| 40 | button | Open |
| 41 | button | Playbooks |
| 42 | button | Take it |
| 43 | button | Open |
| 44 | button | Guest-ready standards |
| 45 | button | Take it |
| 46 | button | Open |
| 47 | heading | HOMES AND OWNERS |
| 48 | button | Take it |
| 49 | button | Open |
| 50 | button | Properties |
| 51 | button | Take it |
| 52 | button | Open |
| 53 | button | Onboarding |
| 54 | button | Take it |
| 55 | button | Open |
| 56 | button | Active Owner |
| 57 | button | Take it |
| 58 | button | Open |
| 59 | button | Quarterly Reviews |
| 60 | button | Take it |
| 61 | button | Open |
| 62 | button | Take it |
| 63 | button | Open |
| 64 | heading | INSIGHT |
| 65 | button | Take it |
| 66 | button | Open |
| 67 | button | Analytics |
| 68 | button | Take it |
| 69 | button | Open |
| 70 | heading | ADMIN |
| 71 | button | Take it |
| 72 | button | Open |
| 73 | button | Admin tools |
| 74 | button | Take it |
| 75 | button | Open |
| 76 | button | View as |
| 77 | button | Take it |
| 78 | button | Open |
| 79 | button | Take it |
| 80 | button | Open |
| 81 | button | Take it |
| 82 | button | Open |
| 83 | button | Take it |
| 84 | button | Open |
| 85 | button | Take it |
| 86 | button | Open |
| 87 | button | Take it |
| 88 | button | Open |
| 89 | button | Take it |
| 90 | button | Open |
| 91 | button | Take it |
| 92 | button | Open |
| 93 | button | Take it |
| 94 | button | Open |
| 95 | button | Take it |
| 96 | button | Open |
| 97 | button | Take it |
| 98 | button | Open |
| 99 | button | Take it |
| 100 | button | Open |
| 101 | button | Take it |
| 102 | button | Open |
| 103 | button | Take it |
| 104 | button | Open |
| 105 | button | My account |
| 106 | button | Take it |
| 107 | button | Open |
| 108 | button | Help & Feedback |
| 109 | button | Take it |
| 110 | button | Open |
| 111 | button | Take it |
| 112 | button | Open |
| 113 | button | Take it |
| 114 | button | Open |
| 115 | button | Take it |
| 116 | button | Open |
| 117 | button | Take it |
| 118 | button | Open |
| 119 | button | Take it |
| 120 | button | Open |
| 121 | button | Take it |
| 122 | button | Open |
| 123 | button | Take it |
| 124 | button | Open |
| 125 | button | Take it |
| 126 | button | Open |
| 127 | button | Take it |
| 128 | button | Open |
| 129 | button | Take it |
| 130 | button | Open |
| 131 | button | Take it |
| 132 | button | Open |
| 133 | button | Take it |
| 134 | button | Open |
| 135 | button | Take it |
| 136 | button | Open |
| 137 | button | Take it |
| 138 | button | Open |
| 139 | button | Take it |
| 140 | button | Open |
| 141 | button | Take it |
| 142 | button | Open |
| 143 | button | Take it |
| 144 | button | Open |
| 145 | button | Take it |
| 146 | button | Open |
| 147 | button | Take it |
| 148 | button | Open |
| 149 | button | Take it |
| 150 | button | Open |
| 151 | button | Take it |
| 152 | button | Open |
| 153 | button | Take it |
| 154 | button | Open |
| 155 | button | Take it |
| 156 | button | Open |
| 157 | button | Take it |
| 158 | button | Open |
| 159 | button | Take it |
| 160 | button | Open |
| 161 | button | Take it |
| 162 | button | Open |
| 163 | button | Take it |
| 164 | button | Open |
| 165 | button | Take it |
| 166 | button | Open |
| 167 | button | Take it |
| 168 | button | Open |
| 169 | button | Take it |
| 170 | button | Open |
| 171 | button | Take it |
| 172 | button | Open |
| 173 | button | Take it |
| 174 | button | Open |
| 175 | button | Take it |
| 176 | button | Open |
| 177 | button | Take it |
| 178 | button | Open |
| 179 | button | Take it |
| 180 | button | Open |
| 181 | button | Take it |
| 182 | button | Open |
| 183 | button | Take it |
| 184 | button | Open |
| 185 | button | Take it |
| 186 | button | Open |
| 187 | button | Take it |
| 188 | button | Open |
| 189 | button | Take it |
| 190 | button | Open |
| 191 | button | Take it |
| 192 | button | Open |
| 193 | button | Take it |
| 194 | button | Open |
| 195 | button | Take it |
| 196 | button | Open |
| 197 | button | Take it |
| 198 | button | Open |
| 199 | button | Take it |
| 200 | button | Open |
| 201 | button | Take it |
| 202 | button | Open |
| 203 | button | Take it |
| 204 | button | Open |
| 205 | button | Take it |
| 206 | button | Open |
| 207 | button | Take it |
| 208 | button | Open |
| 209 | button | Take it |
| 210 | button | Open |
| 211 | button | Take it |
| 212 | button | Open |
| 213 | button | Take it |
| 214 | button | Open |
| 215 | button | Take it |
| 216 | button | Open |
| 217 | button | Take it |
| 218 | button | Open |
| 219 | button | Take it |
| 220 | button | Open |
| 221 | button | Take it |
| 222 | button | Open |
| 223 | button | Take it |
| 224 | button | Open |
| 225 | button | Take it |
| 226 | button | Open |
| 227 | card | Late · 105 |
| 228 | heading | Late · 105 |
| 229 | button | 1P New House Setup - Stage Decor Maintenance Review · 11249 Pegasus Dr Due now |
| 230 | button | 3P Lawn Care Maintenance Review · 3012 Piper St Due now |
| 231 | button | 1B Lawn Care Maintenance Review · 1068 Berrywood Dr Due now |
| 232 | button | 9F Lawn Care Maintenance Review · 9211 Fitzgerald Dr Due now |
| 233 | button | 8E Stock Supply Box Maintenance Review · 8602 E. Galveston St. Due now |
| 234 | button | 8E Change Smoke Detector Batteries Maintenance Review · 8602 E. Galveston St. Due now |
| 235 | button | 8E New House Setup - Press Curtains Maintenance Review · 8602 E. Galveston St. Due now |
| 236 | button | 1N Island is missing a piece of wood and it needs paint touch up Maintenance Review · 1636 NE 32nd St Due now |
| 237 | button | 8E Install Air Filters Maintenance Review · 8602 E. Galveston St. Due now |
| 238 | button | 8E New House Setup - Setting Up ROKU TVs & Storing Remotes Maintenance Review · 8602 E. Galveston St. Due now |
| 239 | button | 8E Spare Front Door Key Maintenance Review · 8602 E. Galveston St. Due now |
| 240 | button | 1E Carpet Cleaning + Curtain Replacement Maintenance Review · 1908 E Urbana St Due now |
| 241 | button | 8E Hall bath tub - stopper Maintenance Review · 815 E Fulton St Due now |
| 242 | button | 1N Fireplace not working + clogged toilet Maintenance Review · 1016 NW 191st St Due now |
| 243 | button | 4E Onsite Inspection & Quote Collection – 401 E. 10th St. Maintenance Review · 401 E 10th St Due now |
| 244 | button | 3W Haulaway Bins Maintenance Review · 3915 W 104th St S Due now |
| 245 | button | 9F Repair Loose Front Door Handle & Toilet Paper Holder – 9211 Maintenance Review · 9211 Fitzgerald Dr Due now |
| 246 | button | 8H Repair Broken Dining Chair – 817 Halley Dr. Maintenance Review · 817 Halley Dr. Due now |
| 247 | button | 4E Amazon Return: Ironing Board Maintenance Review · 401 E 10th St Due now |
| 248 | button | 3B carpet cleaning Maintenance Review · 3201 Belmont Circle Due now |
| 249 | button | 5T Lawn Care Maintenance Review · 5253 Tracey Jo Rd Due now |
| 250 | button | 1S Lawn Care Maintenance Review · 11109 SW 34th Ter Due now |
| 251 | button | 3U Lawn Care Maintenance Review · 3613 Upland Ridge Dr. Due now |
| 252 | button | 5T Lawn Care Maintenance Review · 5671 Teak Ln Due now |
| 253 | button | 3S Lawn Care Maintenance Review · 3117 Scissortail Way Due now |
| 254 | button | 2L Lawn Care Maintenance Review · 2100 Liberty Way Dr Due now |
| 255 | button | 2S Lawn Care Maintenance Review · 2259 Summer Shore Dr Due now |
| 256 | button | 2W Inspect and Repair AC Unit – 2617 W Madison St Maintenance Review · 2617 W Madison St. Due now |
| 257 | button | 2W Lawn Care Maintenance Review · 2017 W. Flintlock Way Due now |
| 258 | button | 2W Lawn Care Maintenance Review · 2012 W. Black Powder Way Due now |
| 259 | button | 7D Lawn Care Maintenance Review · 721 Dusty Trail Due now |
| 260 | button | 7A Lawn Care Maintenance Review · 724 Abilene Way Due now |
| 261 | button | 8E New House Setup - Prep Property / Meet Photographer Maintenance Review · 8602 E. Galveston St. Due now |
| 262 | button | 1S Lawn Care Maintenance Review · 11736 SW 15th Terr Due now |
| 263 | button | 3W Delivering the TV remote Maintenance Review · 3000 W Charlotte St Due now |
| 264 | button | 1B Front Door Lock - Low Battery Maintenance Review · 1169 Blue Sky Lane Due now |
| 265 | button | 3W Trash Removal and Disposal – 3333 Welling Rd Maintenance Review · 3333 Welling Rd Due now |
| 266 | button | 1M Remove and Dispose of Excess Trash – 19013 Meadows Crossing Maintenance Review · 19013 Meadows Crossing Dr. Due now |
| 267 | button | 9S Lawn Care Maintenance Review · 9008 Scarlet Blvd Due now |
| 268 | button | 9N Bathroom Vanity Lights Flickering – Inspection and Repair Maintenance Review · 904 NE 34th Ter Due now |
| 269 | button | 1L Lawn Care Maintenance Review · 10320 Lightning Creek Dr Due now |
| 270 | button | 5N Lawn Care Maintenance Review · 5217 NW 109th St Due now |
| 271 | button | 5H Lawn Care Maintenance Review · 5512 Hidden Trail lane Due now |
| 272 | button | 1E Front Door Lock - Low Battery Maintenance Review · 10121 E 131st Pl S Due now |
| 273 | button | 7R Lawn Care Maintenance Review · 7071 Richardson Ct Due now |
| 274 | button | 4N Lawn Care Maintenance Review · 4317 NW 19th St Due now |
| 275 | button | 1L Carpet stain Maintenance Review · 10320 Lightning Creek Dr Due now |
| 276 | button | 1M Carpet/ rug shampooing. Maintenance Review · 136 Magnolia Estates St. Due now |
| 277 | button | 1M Back patio/furniture Maintenance Review · 136 Magnolia Estates St. Due now |
| 278 | button | 1M Driveway stains. Maintenance Review · 136 Magnolia Estates St. Due now |
| 279 | button | 4B trash haulaway Maintenance Review · 4003 Bendale Rd Due now |
| 280 | button | 6T Lawn Care Maintenance Review · 64 Turtle Loop Due now |
| 281 | button | 6T Lawn Care Maintenance Review · 64 Turtle Loop Due now |
| 282 | button | 6T Lawn Care Maintenance Review · 64 Turtle Loop Due now |
| 283 | button | 6T Lawn Care Maintenance Review · 64 Turtle Loop Due now |
| 284 | button | 8E Lawn Care Maintenance Review · 8602 E. Galveston St. Due now |
| 285 | button | 6C Front Door Lock - Low Battery Maintenance Review · 6847 Cardiff Dr Due now |
| 286 | button | 4S Lawn Care Maintenance Review · 409 S 85th St Due now |
| 287 | button | 9Y Purchase and Install Garage Door Opener – 9120 Yassir Maintenance Review · 9120 Yassir Blvd Due now |
| 288 | button | 3W Check Low Water Pressure in Bathroom – 3000 Maintenance Review · 3000 W Charlotte St Due now |
| 289 | button | 1B Lawn Care Maintenance Review · 18000 Barracho Dr. Due now |
| 290 | button | 2N Lawn Care Maintenance Review · 2016 NW 172ND Due now |
| 291 | button | 1L Trash Removal Before Guest Check-In Maintenance Review · 10320 Lightning Creek Dr Due now |
| 292 | button | 1L Dead Animal Removal – 10320 Maintenance Review · 10320 Lightning Creek Dr Due now |
| 293 | button | 2B fix drywall hole Maintenance Review · 2701 Berkshire Way Due now |
| 294 | button | 3M Recharge Ring Doorbell Camera Maintenance Review · 31445 Moore Rd Due now |
| 295 | button | 3M Front Door Lock - Low Battery Maintenance Review · 31445 Moore Rd Due now |
| 296 | button | 4D TEST - Work Order Instructions for Breezeway Maintenance Review · 428 Drowsy Water Trl Due now |
| 297 | button | 3W Lawn Care Maintenance Review · 3915 W 104th St S Due now |
| 298 | button | 1W Lawn Care Maintenance Review · 1722 Westchester Dr Due now |
| 299 | button | 5S Lawn Care Maintenance Review · 504 S. 47th St. Due now |
| 300 | button | 1S Lawn Care Maintenance Review · 10302 S. 230th East Ave Due now |
| 301 | button | 2T Lawn Care Maintenance Review · 2208 Toledo St Due now |
| 302 | button | 1E Lawn Care Maintenance Review · 1908 E Urbana St Due now |
| 303 | button | 8E Lawn Care Maintenance Review · 815 E Fulton St Due now |
| 304 | button | 3W Lawn Care Maintenance Review · 3000 W Charlotte St Due now |
| 305 | button | 5S Front Door Lock - Low Battery Maintenance Review · 504 S. 47th St. Due now |
| 306 | button | 1S Walmart Return Items Maintenance Review · 10302 S. 230th East Ave Due now |
| 307 | button | 1L Bedroom Carpet Cleaning – Dog Urine Odor Maintenance Review · 10320 Lightning Creek Dr Due now |
| 308 | button | 4E Light fixtures require replacing Maintenance Review · 4718 E Shadowbrook Dr Due now |
| 309 | button | 1P Haulaway Maintenance Review · 11249 Pegasus Dr Due now |
| 310 | button | 1W Front Door Lock - Low Battery Maintenance Review · 1152 Western Yarrow Ave Due now |
| 311 | button | 2S Front Door Lock - Low Battery Maintenance Review · 2522 S. Irvington Ave Due now |
| 312 | button | 5H Front Door Lock - Low Battery Maintenance Review · 5923 Hollyhock Ln Due now |
| 313 | button | 3N Kitchen Disposal Replacement Maintenance Review · 3029 NW 181st Due now |
| 314 | button | 1S Lawn Care Maintenance Review · 10549 SE 23rd St Due now |
| 315 | button | 1S Lawn Care Maintenance Review · 10845 Sara Ct Due now |
| 316 | button | 1N Lawn Care Maintenance Review · 13117 NE 9th St Due now |
| 317 | button | 8S Lawn Care Maintenance Review · 8708 Scirocco Cir Due now |
| 318 | button | 1N Reservation #64895038 Maintenance Review · 1636 NE 32nd St Due now |
| 319 | button | 9N Lawn Care Maintenance Review · 904 NE 34th Ter Due now |
| 320 | button | 1N Lawn Care Maintenance Review · 1636 NE 32nd St Due now |
| 321 | button | 2N Lawn Care Maintenance Review · 2527 NE 15th St Due now |
| 322 | button | 2S Shower Curtain Replacement Maintenance Review · 2522 S. Irvington Ave Due now |
| 323 | button | 2H Lawn Care Maintenance Review · 2817 Hazel Hollow Due now |
| 324 | button | 3P Lawn Care Maintenance Review · 3012 Piper St Due now |
| 325 | button | 8H Lawn Care Maintenance Review · 817 Halley Dr. Due now |
| 326 | button | 2S Lawn Care Maintenance Review · 2608 SE 38th St Due now |
| 327 | button | 1E Haulaway Bins Maintenance Review · 10121 E 131st Pl S Due now |
| 328 | button | 8E Haul the trash + Broken Bed Board Maintenance Review · 815 E Fulton St Due now |
| 329 | button | 52 Lawn Care Maintenance Review · 525 23rd Ave NE Due now |
| 330 | button | 1S Lawn Care Maintenance Review · 105 Summit Bnd Due now |
| 331 | button | 2L Lawn Care Maintenance Review · 2008 Ladera Ln Due now |
| 332 | button | 3B Lawn Care Maintenance Review · 3200 Birmingham Dr. Due now |
| 333 | button | 2S Lawn Care Maintenance Review · 220 SW 167th St Due now |
| 334 | card | Due today · 40 |
| 335 | heading | Due today · 40 |
| 336 | button | 8L Lawn Care Maintenance Review · 816 Lakeview Dr Due Wed 12:18 AM |
| 337 | button | 1S loose toilet Maintenance Review · 10845 Sara Ct Due Wed 12:36 AM |
| 338 | button | 2N The Master Bather Shower is Faulty Maintenance Review · 2016 NW 172ND Due Wed 12:55 AM |
| 339 | button | 2N Inspect and Repair Master Bathroom Shower Head Maintenance Review · 2016 NW 172ND Due Wed 1:02 AM |
| 340 | button | 2E Front Door Lock - Low Battery Maintenance Review · 2014 E 52nd St Due Wed 1:23 AM |
| 341 | button | 2N Garage Door is Broken. Maintenance Review · 2016 NW 172ND Due Wed 4:05 AM |
| 342 | button | 1S Lawn Care Maintenance Review · 15905 Sky Run Dr. Due Wed 2:27 PM |
| 343 | button | 4E Front Door Lock - Low Battery Maintenance Review · 4718 E Shadowbrook Dr Due Wed 2:29 PM |
| 344 | button | 4N Lawn Care Maintenance Review · 4308 NW 158th St. Due Wed 3:04 PM |
| 345 | button | 2N Lawn Care Maintenance Review · 2321 NW 158th St Due Wed 3:43 PM |
| 346 | button | 3N Lawn Care Maintenance Review · 3405 NW 159th Ter Due Wed 3:43 PM |
| 347 | button | 1W Lawn Care Maintenance Review · 16216 Whistle Crk Blvd Due Wed 4:43 PM |
| 348 | button | 1W Lawn Care Maintenance Review · 1700 Whispering Creek Dr Due Wed 5:11 PM |
| 349 | button | 2C Front Door Lock - Low Battery Maintenance Review · 2004 Cedar Ridge Rd Due Wed 5:34 PM |
| 350 | button | 3W Lawn Care Maintenance Review · 305 W 7th St Due Wed 6:25 PM |
| 351 | button | 2E Trash is full - HAUL request Maintenance Review · 2901 E 75th St Due Wed 6:29 PM |
| 352 | button | 2C Lawn Care Maintenance Review · 2004 Cedar Ridge Rd Due Wed 6:51 PM |
| 353 | button | 2H Excessive trash. Maintenance Review · 207 High Point Way Due Wed 7:40 PM |
| 354 | button | 2H Broken chair Maintenance Review · 207 High Point Way Due Wed 7:41 PM |
| 355 | button | 1W Dog poop Maintenance Review · 1152 Western Yarrow Ave Due Wed 7:47 PM |
| 356 | button | 2F Lawn Care Maintenance Review · 2525 Fallview Dr Due Wed 7:50 PM |
| 357 | button | 4D Lawn Care Maintenance Review · 417 Dauphin Ave Due Wed 8:42 PM |
| 358 | button | 4B Lawn Care Maintenance Review · 441 Belmont Dr Due Wed 8:43 PM |
| 359 | button | 3B Lawn Care Maintenance Review · 3201 Belmont Circle Due Wed 8:43 PM |
| 360 | button | 2L Lawn Care Maintenance Review · 2332 Los Angeles Ave Due Wed 9:17 PM |
| 361 | button | 1P Lawn Care Maintenance Review · 1701 Park Lane Dr. Due Wed 9:41 PM |
| 362 | button | 1N Lawn Care Maintenance Review · 1016 NW 191st St Due Wed 10:03 PM |
| 363 | button | 2C Broken lamp Maintenance Review · 2004 Cedar Ridge Rd Due Wed 10:34 PM |
| 364 | button | 2H Linens ruined. Maintenance Review · 207 High Point Way Due Wed 10:40 PM |
| 365 | button | 2C Couch has small tear Maintenance Review · 2004 Cedar Ridge Rd Due Wed 10:41 PM |
| 366 | button | 3W Damage to kitchen table top Maintenance Review · 3333 Welling Rd Due Wed 10:45 PM |
| 367 | button | 3W 3 broken coasters Maintenance Review · 3333 Welling Rd Due Wed 10:46 PM |
| 368 | button | 2S Reservation #107555754 Maintenance Review · 2522 S. Irvington Ave Due Wed 11:03 PM |
| 369 | button | 4B Package Maintenance Review · 4003 Bendale Rd Due Wed 11:05 PM |
| 370 | button | 8H Broken kitchen chair Maintenance Review · 817 Halley Dr. Due Wed 11:06 PM |
| 371 | button | 1E Landscaping Maintenance Review · 10121 E 131st Pl S Due Wed 11:19 PM |
| 372 | button | 1E Touch up paint Maintenance Review · 10121 E 131st Pl S Due Wed 11:19 PM |
| 373 | button | 1B Yard Maintenance Review · 1169 Blue Sky Lane Due Wed 11:22 PM |
| 374 | button | 1M Yard work Maintenance Review · 136 Magnolia Estates St. Due Wed 11:25 PM |
| 375 | button | 8A FROM PREVIOUS TURNS- NOT ADDRESSED Maintenance Review · 845 Alexandria Ln Due Wed 11:40 PM |
| 376 | card | Coming up · 3 |
| 377 | heading | Coming up · 3 |
| 378 | button | 9N Install King-Size Bedsheets Maintenance Review · 904 NE 34th Ter Thu 12:01 AM |
| 379 | button | 3W Lawn Care Maintenance Review · 3333 Welling Rd Thu 12:12 AM |
| 380 | button | 2S Replace Light Bulb – Unit 2608 Maintenance Review · 2608 SE 38th St Thu 2:30 AM |
| 381 | card | Maintenance review |
| 382 | heading | Maintenance review |
| 383 | button | Replace Light Bulb – Unit 2608 2608 SE 38th St · Finished 11/25/2026 |
| 384 | button | Install King-Size Bedsheets 904 NE 34th Ter · Finished 11/25/2026 |
| 385 | button | New House Setup - Unbox Deliveries / Check for Damage 624 Daniel Court · Finished 11/24/2026 |
| 386 | button | New House Setup - Assemble Boxed Furniture 624 Daniel Court · Finished 11/24/2026 |
| 387 | button | New House Setup - Setting out Essentials 624 Daniel Court · Finished 11/24/2026 |
| 388 | button | Trash is full - HAUL request 2901 E 75th St · Finished 11/24/2026 |
| 389 | button | New House Setup - Standard Inspection 624 Daniel Court · Finished 11/24/2026 |
| 390 | button | Install Air Filters 624 Daniel Court · Finished 11/24/2026 |
| 391 | button | Front Door Lock - Low Battery 2004 Cedar Ridge Rd · Finished 11/24/2026 |
| 392 | button | Front Door Lock - Low Battery 4718 E Shadowbrook Dr · Finished 11/24/2026 |
| 393 | button | Garage Door is Broken. 2016 NW 172ND · Finished 11/24/2026 |
| 394 | button | Front Door Lock - Low Battery 2014 E 52nd St · Finished 11/24/2026 |
| 395 | button | Inspect and Repair Master Bathroom Shower Head 2016 NW 172ND · Finished 11/24/2026 |
| 396 | button | The Master Bather Shower is Faulty 2016 NW 172ND · Finished 11/24/2026 |
| 397 | button | loose toilet 10845 Sara Ct · Finished 11/24/2026 |
| 398 | button | Haul the trash + Broken Bed Board 815 E Fulton St · Finished 11/23/2026 |
| 399 | button | Haulaway Bins 10121 E 131st Pl S · Finished 11/23/2026 |
| 400 | button | Shower Curtain Replacement 2522 S. Irvington Ave · Finished 11/23/2026 |
| 401 | button | New House Setup - Painting 624 Daniel Court · Finished 11/23/2026 |
| 402 | button | Kitchen Disposal Replacement 3029 NW 181st · Finished 11/22/2026 |
| 403 | button | Front Door Lock - Low Battery 5923 Hollyhock Ln · Finished 11/22/2026 |
| 404 | button | Front Door Lock - Low Battery 2522 S. Irvington Ave · Finished 11/22/2026 |
| 405 | button | Front Door Lock - Low Battery 1152 Western Yarrow Ave · Finished 11/22/2026 |
| 406 | button | Haulaway 11249 Pegasus Dr · Finished 11/22/2026 |
| 407 | button | Light fixtures require replacing 4718 E Shadowbrook Dr · Finished 11/22/2026 |
| 408 | button | Bedroom Carpet Cleaning – Dog Urine Odor 10320 Lightning Creek Dr · Finished 11/22/2026 |
| 409 | button | Walmart Return Items 10302 S. 230th East Ave · Finished 11/21/2026 |
| 410 | button | Front Door Lock - Low Battery 504 S. 47th St. · Finished 11/21/2026 |
| 411 | button | Front Door Lock - Low Battery 31445 Moore Rd · Finished 11/20/2026 |
| 412 | button | Recharge Ring Doorbell Camera 31445 Moore Rd · Finished 11/20/2026 |
| 413 | button | fix drywall hole 2701 Berkshire Way · Finished 11/20/2026 |
| 414 | button | Dead Animal Removal – 10320 10320 Lightning Creek Dr · Finished 11/20/2026 |
| 415 | button | Trash Removal Before Guest Check-In 10320 Lightning Creek Dr · Finished 11/20/2026 |
| 416 | button | New House Setup - Prep Property / Meet Photographer 250 Springfield Xing · Finished 11/20/2026 |
| 417 | button | New House Setup - Setting Up ROKU TVs & Storing Remotes 250 Springfield Xing · Finished 11/20/2026 |
| 418 | button | New House Setup - Meet Furniture Delivery and Set out Mattresses 624 Daniel Court · Finished 11/20/2026 |
| 419 | button | New House Setup - Pre-Work Inspection 624 Daniel Court · Finished 11/20/2026 |
| 420 | button | New House Setup - Bring Deliveries Inside 624 Daniel Court · Finished 11/20/2026 |
| 421 | button | New House Setup - Bring Deliveries Inside 624 Daniel Court · Finished 11/20/2026 |
| 422 | button | Purchase and Install Garage Door Opener – 9120 Yassir 9120 Yassir Blvd · Finished 11/20/2026 |
| 423 | button | Front Door Lock - Low Battery 6847 Cardiff Dr · Finished 11/20/2026 |
| 424 | button | New House Setup - Place surveillance signs on property 624 Daniel Court · Finished 11/19/2026 |
| 425 | button | trash haulaway 4003 Bendale Rd · Finished 11/19/2026 |
| 426 | button | Front Door Lock - Low Battery 10121 E 131st Pl S · Finished 11/19/2026 |
| 427 | button | Bathroom Vanity Lights Flickering – Inspection and Repair 904 NE 34th Ter · Finished 11/18/2026 |
| 428 | button | Remove and Dispose of Excess Trash – 19013 Meadows Crossing 19013 Meadows Crossing Dr. · Finished 11/18/2026 |
| 429 | button | Trash Removal and Disposal – 3333 Welling Rd 3333 Welling Rd · Finished 11/18/2026 |
| 430 | button | New House Setup - Install Locks / Garage Lockbox and Keypad 624 Daniel Court · Finished 11/18/2026 |
| 431 | button | New House Setup - Bring Deliveries Inside 624 Daniel Court · Finished 11/18/2026 |
| 432 | button | Front Door Lock - Low Battery 1169 Blue Sky Lane · Finished 11/18/2026 |
| 433 | button | Delivering the TV remote 3000 W Charlotte St · Finished 11/18/2026 |
| 434 | button | New House Setup - Prep Property / Meet Photographer 8602 E. Galveston St. · Finished 11/18/2026 |
| 435 | button | New House Setup - Bring Deliveries Inside 624 Daniel Court · Finished 11/18/2026 |
| 436 | button | New House Setup - Create Houzz Pro 3D Floorplans of Each Room 8738 Comstock Ct · Finished 11/18/2026 |
| 437 | button | New House Setup - Install Ring Devices / Connect to ARHA Ring Account 624 Daniel Court · Finished 11/18/2026 |
| 438 | button | carpet cleaning 3201 Belmont Circle · Finished 11/17/2026 |
| 439 | button | New House Setup - Bring Deliveries Inside 624 Daniel Court · Finished 11/17/2026 |
| 440 | button | New House Setup - Wash Linens 250 Springfield Xing · Finished 11/17/2026 |
| 441 | button | New House Setup - Provide Repair/Improvements Estimates 8738 Comstock Ct · Finished 11/17/2026 |
| 442 | button | Amazon Return: Ironing Board 401 E 10th St · Finished 11/17/2026 |
| 443 | card | Recently completed |
| 444 | heading | Recently completed |
| 445 | button | 1S Cleaning Review — Serene Sara Ct (10845) Cleaning Review · 10845 Sara Ct Needs follow-up |
| 446 | button | 1W Guest touch base Guest Touch Base · 1152 Western Yarrow Ave Looks good |
| 447 | button | 2L Guest touch base Guest Touch Base · 2100 Liberty Way Dr Looks good |
| 448 | button | 1S Guest touch base Guest Touch Base · 14553 Serrano Ridge Dr Looks good |
| 449 | button | 4W Guest touch base Guest Touch Base · 4607 W Union St Looks good |
| 450 | button | 7V Guest touch base Guest Touch Base · 721 Vaquero St. Looks good |
| 451 | button | 2W Guest touch base Guest Touch Base · 2012 W. Black Powder Way Looks good |
| 452 | button | 2H Guest touch base Guest Touch Base · 207 High Point Way Looks good |
| 453 | button | 4B Guest touch base Guest Touch Base · 453 Blue Crow Lane Looks good |
| 454 | button | 1W Guest touch base Guest Touch Base · 1056 Wildwood Dr. Looks good |
| 455 | button | 3M Guest touch base Guest Touch Base · 31445 Moore Rd Looks good |
| 456 | button | 1E Guest touch base Guest Touch Base · 13325 E 43rd Pl S Looks good |

**Appears more than once:** button: Toggle Sidebar × 2; button: Record routine work × 2; button: Take it × 90; button: Open × 90; button: 3P Lawn Care Maintenance Review · 3012 Piper St Due now × 2; button: 6T Lawn Care Maintenance Review · 64 Turtle Loop Due now × 4; button: New House Setup - Bring Deliveries Inside 624 Daniel Court · Finished 11/20/2026 × 2; button: New House Setup - Bring Deliveries Inside 624 Daniel Court · Finished 11/18/2026 × 2.

### desktop-open-arrival-check.png

Screen: Open arrival check. Viewer: Emily. PNG: 1440 × 2709.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Open full page |
| 2 | button | Close Ticket |
| 3 | heading | Ticket |
| 4 | heading | Arrival check: 1068 Berrywood Dr |
| 5 | button | More |
| 6 | button | Due date Nov 19. Change the due date |
| 7 | button | Close ticket |
| 8 | button | Reopen ticket (disabled) |
| 9 | chip | Logged |
| 10 | chip | Fix it |
| 11 | chip | Done |
| 12 | heading | Do this now |
| 13 | button | Change next step |
| 14 | button | Done |
| 15 | card | Arrival check |
| 16 | heading | Arrival check |
| 17 | button | Open the home |
| 18 | button | Open Breezeway requirements |
| 19 | button | Remind me to recheck |
| 20 | button, filter | Connected |
| 21 | button, filter | Not connected |
| 22 | button | I reviewed the open work orders |
| 23 | button | Check-in details sent |
| 24 | button, filter | Ready for the guest |
| 25 | button, filter | Issue found |
| 26 | button | Complete check (disabled) |
| 27 | heading | Confirm you have it |
| 28 | filter | Anything worth noting (optional) |
| 29 | button | Continue |
| 30 | button | Waiting on someone? |
| 31 | card | Make it right |
| 32 | button | lucide-chevron-down |
| 33 | heading | Make it right |
| 34 | button | Yes |
| 35 | button | No |
| 36 | button | Yes, open a claim |
| 37 | heading | DETAILS |
| 38 | filter | Add an update: who you called, what the vendor found, what the guest said… |
| 39 | button | lucide-building-2 |
| 40 | button | lucide-send |
| 41 | button | lucide-send |
| 42 | heading | Unnamed heading |
| 43 | button, filter | Issue is tied to |
| 44 | button, filter | Active-stay impact |
| 45 | button, filter | Guest communication required |

**Appears more than once:** button: lucide-send × 2.

### desktop-oversight.png

Screen: Oversight. Viewer: Emily. PNG: 1440 × 17407.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Toggle Sidebar |
| 2 | button | Resolve EXECUTIVE ADMINISTRATION |
| 3 | button | Search Resolve ⌘K |
| 4 | button | Record work |
| 5 | button | Record routine work |
| 6 | button | Take the tour |
| 7 | button | Alerts and escalations |
| 8 | button | Chats, 1 unread |
| 9 | button | Notifications |
| 10 | button | Switch to dark mode |
| 11 | chip | 1 |
| 12 | button | Toggle Sidebar |
| 13 | button | Portals |
| 14 | button | Sign out (Admin) |
| 15 | heading | MY DAY |
| 16 | button | Home |
| 17 | button | Oversight |
| 18 | button | Supervisor check |
| 19 | button | Shift handoffs |
| 20 | button | Team records |
| 21 | button | Coaching |
| 22 | button | Weekly scorecard |
| 23 | button | Team Queue |
| 24 | button | Direct Bookings |
| 25 | heading | Operations oversight |
| 26 | button | Work Orders |
| 27 | button | Databases |
| 28 | card | Overdue arrival checks |
| 29 | button | Oversight 4 |
| 30 | heading | Overdue arrival checks |
| 31 | chip | 1 handoff waiting to be accepted, 3 missed shift ends today |
| 32 | button | Guest Claims & Refunds |
| 33 | button | Bulk close as completed outside Resolve |
| 34 | heading | TEAM |
| 35 | card | All open tickets (190) |
| 36 | button | Team and Coverage |
| 37 | heading | All open tickets (190) |
| 38 | button | Playbooks |
| 39 | table | Table |
| 40 | button | Guest-ready standards |
| 41 | heading | HOMES AND OWNERS |
| 42 | button | Properties |
| 43 | button | Onboarding |
| 44 | button | Active Owner |
| 45 | button | Quarterly Reviews |
| 46 | heading | INSIGHT |
| 47 | button | Analytics |
| 48 | heading | ADMIN |
| 49 | button | Admin tools |
| 50 | button | View as |
| 51 | button | My account |
| 52 | button | Help & Feedback |
| 53 | button | Nightly export check |
| 54 | card | On call · Emily Jimenez After hours now Details |
| 55 | card | Overnight handoff 0 open Details |
| 56 | card | Insurance risk (0) |
| 57 | heading | Insurance risk (0) |
| 58 | button, filter | Decisions needed 129 |
| 59 | button, filter | Escalations 130 |
| 60 | button, filter | Blockers 67 |
| 61 | button, filter | Overdue / high-risk 65 |
| 62 | button, filter | Approvals 9 |
| 63 | button, filter | Review before closing 14 |
| 64 | table | Work that needs a supervisor |
| 65 | button | Decisions needed, hide rows |
| 66 | button | P3 Trash outside by front door #5131 3201 Belmont Circle, Edmond, Oklahoma 73034 OKC Unassigned Open Nobody owns this Reported Today 3:54 PM Assign an owner |
| 67 | chip | P3 |
| 68 | chip | Unassigned |
| 69 | chip | Open |
| 70 | button | P3 downstairs bathroom #5130 7422 S. Granite Ave, Tulsa, Oklahoma 74136 Tulsa Unassigned Open Nobody owns this Reported Today 12:02 PM Assign an owner |
| 71 | chip | P3 |
| 72 | chip | Unassigned |
| 73 | chip | Open |
| 74 | button | P3 Broken lamp #5129 2004 Cedar Ridge Rd, Edmond, Oklahoma 73013 OKC Unassigned Open Nobody owns this Reported Today 11:03 AM Assign an owner |
| 75 | chip | P3 |
| 76 | chip | Unassigned |
| 77 | chip | Open |
| 78 | button | P3 Excessive trash. #5128 207 High Point Way, Justin, Texas 76247 Fort Worth Unassigned Open Nobody owns this Reported Today 10:32 AM Assign an owner |
| 79 | chip | P3 |
| 80 | chip | Unassigned |
| 81 | chip | Open |
| 82 | button | P3 Linens ruined. #5127 207 High Point Way, Justin, Texas 76247 Fort Worth Unassigned Open Nobody owns this Reported Today 10:31 AM Assign an owner |
| 83 | chip | P3 |
| 84 | chip | Unassigned |
| 85 | chip | Open |
| 86 | button | P3 Broken chair #5126 207 High Point Way, Justin, Texas 76247 Fort Worth Unassigned Open Nobody owns this Reported Today 10:28 AM Assign an owner |
| 87 | chip | P3 |
| 88 | chip | Unassigned |
| 89 | chip | Open |
| 90 | button | P3 Couch has small tear #5125 2004 Cedar Ridge Rd, Edmond, Oklahoma 73013 OKC Unassigned Open Nobody owns this Reported Today 10:17 AM Assign an owner |
| 91 | chip | P3 |
| 92 | chip | Unassigned |
| 93 | chip | Open |
| 94 | button | P3 Reservation #107883011 #5124 33 Center Ln S, Carlton Landing, Oklahoma 74332 Carlton Landing Unassigned Open Nobody owns this Reported Today 7:20 AM Assign an owner |
| 95 | chip | P3 |
| 96 | chip | Unassigned |
| 97 | chip | Open |
| 98 | button | P2 Arrival check: 2608 SE 38th St #5113 2608 SE 38th St, Moore, Oklahoma 73160 OKC Unassigned Open Nobody owns this Reported Today 6:00 AM Assign an owner |
| 99 | chip | P2 |
| 100 | chip | Unassigned |
| 101 | chip | Open |
| 102 | button | P2 Arrival check: 4718 E Shadowbrook Dr #5117 4718 E Shadowbrook Dr, Camby, Indiana 46113 Indy Unassigned Open Nobody owns this Reported Today 6:00 AM Assign an owner |
| 103 | chip | P2 |
| 104 | chip | Unassigned |
| 105 | chip | Open |
| 106 | button | P2 Arrival check: 3915 W 104th St S #5120 3915 W 104th St S, Jenks, Oklahoma 74037 Tulsa Unassigned Open Nobody owns this Reported Today 6:00 AM Assign an owner |
| 107 | chip | P2 |
| 108 | chip | Unassigned |
| 109 | chip | Open |
| 110 | button | P2 Arrival check: 2332 Los Angeles Ave #5116 2332 Los Angeles Ave, Edmond, Oklahoma 73034 OKC Unassigned Open Nobody owns this Reported Today 6:00 AM Assign an owner |
| 111 | chip | P2 |
| 112 | chip | Unassigned |
| 113 | chip | Open |
| 114 | button | Escalations, hide rows |
| 115 | button | P3 Trash outside by front door #5131 3201 Belmont Circle, Edmond, Oklahoma 73034 OKC Unassigned Open Response overdue Reported Today 3:54 PM Reply now |
| 116 | chip | P3 |
| 117 | chip | Unassigned |
| 118 | chip | Open |
| 119 | button | P3 downstairs bathroom #5130 7422 S. Granite Ave, Tulsa, Oklahoma 74136 Tulsa Unassigned Open Response overdue Reported Today 12:02 PM Reply now |
| 120 | chip | P3 |
| 121 | chip | Unassigned |
| 122 | chip | Open |
| 123 | button | P3 Broken lamp #5129 2004 Cedar Ridge Rd, Edmond, Oklahoma 73013 OKC Unassigned Open Response overdue Reported Today 11:03 AM Reply now |
| 124 | chip | P3 |
| 125 | chip | Unassigned |
| 126 | chip | Open |
| 127 | button | P3 Excessive trash. #5128 207 High Point Way, Justin, Texas 76247 Fort Worth Unassigned Open Response overdue Reported Today 10:32 AM Reply now |
| 128 | chip | P3 |
| 129 | chip | Unassigned |
| 130 | chip | Open |
| 131 | button | P3 Linens ruined. #5127 207 High Point Way, Justin, Texas 76247 Fort Worth Unassigned Open Response overdue Reported Today 10:31 AM Reply now |
| 132 | chip | P3 |
| 133 | chip | Unassigned |
| 134 | chip | Open |
| 135 | button | P3 Broken chair #5126 207 High Point Way, Justin, Texas 76247 Fort Worth Unassigned Open Response overdue Reported Today 10:28 AM Reply now |
| 136 | chip | P3 |
| 137 | chip | Unassigned |
| 138 | chip | Open |
| 139 | button | P3 Couch has small tear #5125 2004 Cedar Ridge Rd, Edmond, Oklahoma 73013 OKC Unassigned Open Response overdue Reported Today 10:17 AM Reply now |
| 140 | chip | P3 |
| 141 | chip | Unassigned |
| 142 | chip | Open |
| 143 | button | P3 Reservation #107883011 #5124 33 Center Ln S, Carlton Landing, Oklahoma 74332 Carlton Landing Unassigned Open Response overdue Reported Today 7:20 AM Reply now |
| 144 | chip | P3 |
| 145 | chip | Unassigned |
| 146 | chip | Open |
| 147 | button | P2 Arrival check: 2608 SE 38th St #5113 2608 SE 38th St, Moore, Oklahoma 73160 OKC Unassigned Open Response overdue Reported Today 6:00 AM Reply now |
| 148 | chip | P2 |
| 149 | chip | Unassigned |
| 150 | chip | Open |
| 151 | button | P2 Arrival check: 4718 E Shadowbrook Dr #5117 4718 E Shadowbrook Dr, Camby, Indiana 46113 Indy Unassigned Open Response overdue Reported Today 6:00 AM Reply now |
| 152 | chip | P2 |
| 153 | chip | Unassigned |
| 154 | chip | Open |
| 155 | button | P2 Arrival check: 3915 W 104th St S #5120 3915 W 104th St S, Jenks, Oklahoma 74037 Tulsa Unassigned Open Response overdue Reported Today 6:00 AM Reply now |
| 156 | chip | P2 |
| 157 | chip | Unassigned |
| 158 | chip | Open |
| 159 | button | P2 Arrival check: 2332 Los Angeles Ave #5116 2332 Los Angeles Ave, Edmond, Oklahoma 73034 OKC Unassigned Open Response overdue Reported Today 6:00 AM Reply now |
| 160 | chip | P2 |
| 161 | chip | Unassigned |
| 162 | chip | Open |
| 163 | button | Blockers, hide rows |
| 164 | button | P2 toilet paper holder #5137 845 Alexandria Ln, Joshua, Texas 76058-6216 Fort Worth Qym Fuenteblanca Team B Open Acknowledged but not started Reported Today 5:52 PM Start work |
| 165 | chip | P2 |
| 166 | chip | Open |
| 167 | button | P2 backyard needs mowed #5136 1169 Blue Sky Lane, Burleson, Texas 76028 Fort Worth Qym Fuenteblanca Team B Open Acknowledged but not started Reported Today 5:23 PM Start work |
| 168 | chip | P2 |
| 169 | chip | Open |
| 170 | button | P2 repair dining chair #5135 817 Halley Dr., Moore, Oklahoma 73160 OKC Qym Fuenteblanca Team B Open Acknowledged but not started Reported Today 5:06 PM Start work |
| 171 | chip | P2 |
| 172 | chip | Open |
| 173 | button | P2 towel rack repair #5134 628 Joy Ct, Burleson, Texas 76028 Fort Worth Qym Fuenteblanca Team B Open Acknowledged but not started Reported Today 5:04 PM Start work |
| 174 | chip | P2 |
| 175 | chip | Open |
| 176 | button | P2 broken coasters #5133 3333 Welling Rd, Edmond, Oklahoma 73012 OKC Romeo Canales Team B Open Acknowledged but not started Reported Today 4:46 PM Start work |
| 177 | chip | P2 |
| 178 | chip | Open |
| 179 | button | P2 small tear/rip in couch #5132 2004 Cedar Ridge Rd, Edmond, Oklahoma 73013 OKC Romeo Canales Team B Open Acknowledged but not started Reported Today 4:43 PM Start work |
| 180 | chip | P2 |
| 181 | chip | Open |
| 182 | button | P2 one of dining chairs was broken #5104 4607 W Union St, Broken Arrow, Oklahoma 74011 Tulsa Qym Fuenteblanca Team B Open Acknowledged but not started Reported Nov 23 Start work |
| 183 | chip | P2 |
| 184 | chip | Open |
| 185 | button | P2 bathroom mirror broken #5103 18200 Bodegon Rd., Edmond, Oklahoma 73012 OKC Qym Fuenteblanca Team B Open Acknowledged but not started Reported Nov 23 Start work |
| 186 | chip | P2 |
| 187 | chip | Open |
| 188 | button | P2 7006 project. This home is missing quite a few standard items that we need ordered and then a few things need replaced. #5102 7006 E 154th St S, Bixby, Oklahoma 74008 Tulsa Qym Fuenteblanca Team B Open Acknowledged but not started Reported Nov 23 Start work |
| 189 | chip | P2 |
| 190 | chip | Open |
| 191 | button | P2 to reach out to owner on considering to replace the carpet #5048 3712 N 39th St., Broken Arrow, Oklahoma 74014 Tulsa Romeo Canales Team B Open Acknowledged but not started Reported Nov 20 Start work |
| 192 | chip | P2 |
| 193 | chip | Open |
| 194 | button | P2 slow shower drain #5046 1068 Berrywood Dr, Greenwood, Indiana 46143 Indy James Almario Leadership Open Acknowledged but not started Reported Nov 20 Start work |
| 195 | chip | P2 |
| 196 | chip | Open |
| 197 | button | P3 Quarterly property review: 5253 Tracey Jo Rd #5023 5253 Tracey Jo Rd, Greenwood, Indiana 46142 Indy James Almario Leadership Open Acknowledged but not started Reported Nov 19 Start work |
| 198 | chip | P3 |
| 199 | chip | Open |
| 200 | button | P2 The Door in the bedroom fell down. The carpet is dirty #4941 207 High Point Way, Justin, Texas 76247 Fort Worth Mike Cacatian Team A In progress Handoff not accepted Reported Nov 16 Accept the handoff |
| 201 | chip | P2 |
| 202 | chip | In progress |
| 203 | button | Overdue / high-risk, hide rows |
| 204 | button | P2 2014 - get carpet quote to replace #1509 2014 E 52nd St, Tulsa, Oklahoma 74105 Tulsa Romeo Canales Team B Waiting on owner Waiting past its review date Overdue by 5d Update the review |
| 205 | chip | P2 |
| 206 | chip | Waiting on owner |
| 207 | button | P2 5923 - yale lock disconnected #1487 5923 Hollyhock Ln, Montgomery, Texas 77316 Houston Romeo Canales Team B Waiting on vendor Waiting past its review date Overdue by 39h Update the review |
| 208 | chip | P2 |
| 209 | chip | Waiting on vendor |
| 210 | button | P2 Arrival check: 11508 E 94th Pl N #5067 11508 E 94th Pl N, Owasso, Oklahoma 74055 Tulsa Unassigned Open P1 and P2 aging Reported Nov 21 Push this forward |
| 211 | chip | P2 |
| 212 | chip | Unassigned |
| 213 | chip | Open |
| 214 | button | P2 Arrival check: 1169 Blue Sky Lane #5062 1169 Blue Sky Lane, Burleson, Texas 76028 Fort Worth Unassigned Open P1 and P2 aging Reported Nov 21 Push this forward |
| 215 | chip | P2 |
| 216 | chip | Unassigned |
| 217 | chip | Open |
| 218 | button | P2 Arrival check: 4513 Black Mesa Lane #5061 4513 Black Mesa Lane, Yukon, Oklahoma 73099 OKC Unassigned Open P1 and P2 aging Reported Nov 21 Push this forward |
| 219 | chip | P2 |
| 220 | chip | Unassigned |
| 221 | chip | Open |
| 222 | button | P2 Arrival check: 10121 E 131st Pl S #5051 10121 E 131st Pl S, Bixby, Oklahoma 74008 Tulsa Unassigned Open P1 and P2 aging Reported Nov 21 Push this forward |
| 223 | chip | P2 |
| 224 | chip | Unassigned |
| 225 | chip | Open |
| 226 | button | P2 Arrival check: 2100 Liberty Way Dr #5052 2100 Liberty Way Dr, Greenwood, Indiana 46143 Indy Unassigned Open P1 and P2 aging Reported Nov 21 Push this forward |
| 227 | chip | P2 |
| 228 | chip | Unassigned |
| 229 | chip | Open |
| 230 | button | P2 Arrival check: 10320 Lightning Creek Dr #5057 10320 Lightning Creek Dr, Yukon, Oklahoma 73099 OKC Unassigned Open P1 and P2 aging Reported Nov 21 Push this forward |
| 231 | chip | P2 |
| 232 | chip | Unassigned |
| 233 | chip | Open |
| 234 | button | P2 Arrival check: 7071 Richardson Ct #5050 7071 Richardson Ct, Warr Acres, Oklahoma 73132 OKC Unassigned Open P1 and P2 aging Reported Nov 21 Push this forward |
| 235 | chip | P2 |
| 236 | chip | Unassigned |
| 237 | chip | Open |
| 238 | button | P2 Arrival check: 305 W 7th St #5056 305 W 7th St, Edmond, Oklahoma 73003 OKC Unassigned Open P1 and P2 aging Reported Nov 21 Push this forward |
| 239 | chip | P2 |
| 240 | chip | Unassigned |
| 241 | chip | Open |
| 242 | button | P2 Arrival check: 3613 Upland Ridge Dr. #5053 3613 Upland Ridge Dr., Yukon, Oklahoma 73099 OKC Unassigned Open P1 and P2 aging Reported Nov 21 Push this forward |
| 243 | chip | P2 |
| 244 | chip | Unassigned |
| 245 | chip | Open |
| 246 | button | P2 Arrival check: 15226 High Timber Ln #5054 15226 High Timber Ln, Noblesville, Indiana 46060 Indy Unassigned Open P1 and P2 aging Reported Nov 21 Push this forward |
| 247 | chip | P2 |
| 248 | chip | Unassigned |
| 249 | chip | Open |
| 250 | button | P2 Arrival check: 2701 Berkshire Way #5060 2701 Berkshire Way, Oklahoma City, Oklahoma 73120 OKC Unassigned Open P1 and P2 aging Reported Nov 21 Push this forward |
| 251 | chip | P2 |
| 252 | chip | Unassigned |
| 253 | chip | Open |
| 254 | button | P2 Arrival check: 3712 N 39th St. #5055 3712 N 39th St., Broken Arrow, Oklahoma 74014 Tulsa Unassigned Open P1 and P2 aging Reported Nov 21 Push this forward |
| 255 | chip | P2 |
| 256 | chip | Unassigned |
| 257 | chip | Open |
| 258 | button | Approvals, hide rows |
| 259 | button | Send recommended repair & home improvements cost projections to prospective buyer Awaiting a decision Onboarding task Review |
| 260 | chip | Awaiting a decision |
| 261 | button | 10. Obtain owner decisions and approvals Awaiting a decision Onboarding task Due 10/31/2026 Review |
| 262 | chip | Awaiting a decision |
| 263 | button | Send recommended repair & home improvements cost projections to prospective buyer Awaiting a decision Onboarding task Review |
| 264 | chip | Awaiting a decision |
| 265 | button | 10. Obtain owner decisions and approvals Awaiting a decision Onboarding task Review |
| 266 | chip | Awaiting a decision |
| 267 | button | 10. Obtain owner decisions and approvals Awaiting a decision Onboarding task Review |
| 268 | chip | Awaiting a decision |
| 269 | button | Send recommended repair & home improvements cost projections to prospective buyer Awaiting a decision Onboarding task Due 11/05/2026 Review |
| 270 | chip | Awaiting a decision |
| 271 | button | Send A Real Home Away management agreement to prospective buyer for review and signature Awaiting a decision Onboarding task Review |
| 272 | chip | Awaiting a decision |
| 273 | button | Send A Real Home Away management agreement to prospective buyer for review and signature Awaiting a decision Onboarding task Review |
| 274 | chip | Awaiting a decision |
| 275 | button | Send A Real Home Away management agreement to prospective buyer for review and signature Awaiting a decision Onboarding task Due 10/27/2026 Review |
| 276 | chip | Awaiting a decision |
| 277 | button | Review before closing, hide rows |
| 278 | button | P2 toilet seat is loose causing bottom seal to leak water #5047 10845 Sara Ct, Midwest City, Oklahoma 73130 OKC Romeo Canales Team B Resolved Needs review before closing Reported Nov 20 Review and decide |
| 279 | chip | P2 |
| 280 | chip | Resolved |
| 281 | button | P2 Washer is not working #5030 7422 S. Granite Ave, Tulsa, Oklahoma 74136 Tulsa Romeo Canales Team B Resolved Needs review before closing Reported Nov 19 Review and decide |
| 282 | chip | P2 |
| 283 | chip | Resolved |
| 284 | button | P2 Living Room Drywall Hole #5026 2701 Berkshire Way, Oklahoma City, Oklahoma 73120 OKC Romeo Canales Team B Resolved Needs review before closing Reported Nov 19 Review and decide |
| 285 | chip | P2 |
| 286 | chip | Resolved |
| 287 | button | P2 Guest review: Please check the kitchen extractor hood, as it is barely working. #4977 721 Vaquero St., White Settlement, Texas 76108 Fort Worth Qym Fuenteblanca Team B Resolved Needs review before closing Reported Nov 17 Review and decide |
| 288 | chip | P2 |
| 289 | chip | Resolved |
| 290 | button | P2 Guest touch base: STOVE not working. #4971 1701 Park Lane Dr., Edmond, Oklahoma 73003 OKC Qym Fuenteblanca Team B Resolved Needs review before closing Reported Nov 17 Review and decide |
| 291 | chip | P2 |
| 292 | chip | Resolved |
| 293 | button | P2 Thermostat switched to heat but still blowing cool air #4960 1039 Swinton Way, Westfield, Indiana 46074 Indy Romeo Canales Team B Resolved Needs review before closing Reported Nov 17 Review and decide |
| 294 | chip | P2 |
| 295 | chip | Resolved |
| 296 | button | P2 Jennifer Wright at 1215 - Thermostat cannot be set to heat #4930 1215 N Elder Ave, Broken Arrow, Oklahoma 74012 Tulsa Romeo Canales Team B Resolved Needs review before closing Reported Nov 16 Review and decide |
| 297 | chip | P2 |
| 298 | chip | Resolved |
| 299 | button | P2 14553 - dishwasher is not working again. #1514 14553 Serrano Ridge Dr, Ft. Worth, Texas 76052 Fort Worth Romeo Canales Team B Resolved Needs review before closing Reported Nov 5 Review and decide |
| 300 | chip | P2 |
| 301 | chip | Resolved |
| 302 | button | P2 5047 - pilot light is out again + microwave door handle + front door handle + screen door #1510 5047 Skipping Stone Dr, Indianapolis, Indiana 46237 Indy Romeo Canales Team B Resolved Needs review before closing Reported Nov 4 Review and decide |
| 303 | chip | P2 |
| 304 | chip | Resolved |
| 305 | button | P1 508 - potential leak #1511 508 NW 183rd St, Edmond, Oklahoma 73012 OKC Romeo Canales Team B Resolved Needs review before closing Reported Nov 4 Review and decide |
| 306 | chip | P1 |
| 307 | chip | Resolved |
| 308 | button | P2 2817 - microwave door won’t shut #1502 2817 Hazel Hollow, Moore, Oklahoma 73160 OKC Romeo Canales Team B Resolved Needs review before closing Reported Nov 1 Review and decide |
| 309 | chip | P2 |
| 310 | chip | Resolved |
| 311 | button | P2 64 Turtle Loop - Resecure Pool Umbrellas #1475 64 Turtle Loop, Eufaula, Oklahoma 74432 Carlton Landing Romeo Canales Team B Resolved Needs review before closing Reported Oct 26 Review and decide |
| 312 | chip | P2 |
| 313 | chip | Resolved |
| 314 | card | Workload by person |
| 315 | heading | Where the work sits |
| 316 | heading | Workload by person |
| 317 | button | Maintenance / Breezeway 23 25 repair requests sent 23 past the committed date |
| 318 | button | Routine controls 111 111 late · 148 open 99 completed in the last 7 days |
| 319 | button | Unassigned 129 |
| 320 | button | Micah Sinor 53 |
| 321 | button | Qym Fuenteblanca 10 |
| 322 | button | Approvals 9 9 awaiting a decision |
| 323 | button | Claims 36 open 0 inside a platform deadline window |
| 324 | button | Romeo Canales 6 |
| 325 | button | Mike Cacatian 3 |
| 326 | button | Avy Vergara 2 |
| 327 | button | James Almario 2 |
| 328 | button | Guest refunds & credits 1 open 0 waiting on approval |
| 329 | button | Leads Pipeline and follow-ups |
| 330 | button | Emily Jimenez 1 |
| 331 | card | Where issues are coming from |
| 332 | heading | Where issues are coming from |
| 333 | heading | PROPERTY |
| 334 | heading | MARKET |
| 335 | heading | TICKET TYPE |

**Appears more than once:** button: Toggle Sidebar × 2; chip: P3 × 17; chip: Unassigned × 36; chip: Open × 48; chip: P2 × 45; button: Send recommended repair & home improvements cost projections to prospective buyer Awaiting a decision Onboarding task Review × 2; chip: Awaiting a decision × 9; button: 10. Obtain owner decisions and approvals Awaiting a decision Onboarding task Review × 2; button: Send A Real Home Away management agreement to prospective buyer for review and signature Awaiting a decision Onboarding task Review × 2; chip: Resolved × 12.

### desktop-supervisor-check.png

Screen: Supervisor check. Viewer: Emily. PNG: 1440 × 27304.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Toggle Sidebar |
| 2 | button | Resolve EXECUTIVE ADMINISTRATION |
| 3 | button | Search Resolve ⌘K |
| 4 | button | Record work |
| 5 | button | Record routine work |
| 6 | button | Take the tour |
| 7 | button | Alerts and escalations |
| 8 | button | Chats, 1 unread |
| 9 | button | Notifications |
| 10 | button | Switch to dark mode |
| 11 | chip | 1 |
| 12 | button | Toggle Sidebar |
| 13 | button | Portals |
| 14 | button | Sign out (Admin) |
| 15 | heading | MY DAY |
| 16 | button | Home |
| 17 | button | Oversight |
| 18 | button | Supervisor check |
| 19 | button | Shift handoffs |
| 20 | button | Team records |
| 21 | button | Coaching |
| 22 | button | Weekly scorecard |
| 23 | button | Team Queue |
| 24 | button | Direct Bookings |
| 25 | heading | Supervisor check |
| 26 | button | Work Orders |
| 27 | heading | Team Queue |
| 28 | filter | Search by title or home |
| 29 | button, filter | Filter |
| 30 | button | Databases |
| 31 | button | Oversight 4 |
| 32 | chip | 1 handoff waiting to be accepted, 3 missed shift ends today |
| 33 | button, filter | Priority |
| 34 | button, filter | Status |
| 35 | button, filter | Person |
| 36 | button, tab | All team 117 |
| 37 | button, tab | Team A 3 |
| 38 | button, tab | Team B 140 |
| 39 | button, tab | Only mine 1 |
| 40 | button, tab | Unassigned 40 |
| 41 | chip | 117 |
| 42 | chip | 3 |
| 43 | chip | 140 |
| 44 | chip | 1 |
| 45 | chip | 40 |
| 46 | button | Guest Claims & Refunds |
| 47 | button, filter | Unassigned 40 |
| 48 | button, filter | Waiting 2 |
| 49 | button, filter | Blocked 3 |
| 50 | button, filter | Escalated 117 |
| 51 | button, filter | Overdue 112 |
| 52 | heading | TEAM |
| 53 | button | Team and Coverage |
| 54 | table | Open tickets |
| 55 | button | P2, hide rows |
| 56 | button | Playbooks |
| 57 | chip | P2 |
| 58 | button | P2 The Door in the bedroom fell down. The carpet is dirty #4941 207 High Point Way, Justin, Texas 76247 Fort Worth Immediate cleaning need Mike Cacatian Team A In progress Nov 16 Overdue by 8 days Nov 16 |
| 59 | button | Guest-ready standards |
| 60 | chip | P2 |
| 61 | chip | In progress |
| 62 | button | Select ticket 4941 |
| 63 | button | P2 Guest review: Reported issue: Shower head is not working properly. Needs fixing. #4976 2016 NW 172ND, Edmond, Oklahoma 73012 OKC Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 7d Nov 17 |
| 64 | chip | P2 |
| 65 | chip | Open |
| 66 | button | Select ticket 4976 |
| 67 | heading | HOMES AND OWNERS |
| 68 | button | Properties |
| 69 | button | P2 The washer at 7422 has a reported broken timer and may require repair or replacement. Please review the previous updates, confirm the washer #4978 7422 S. Granite Ave, Tulsa, Oklahoma 74136 Tulsa Immediate maintenance Qym Fuenteblanca Team B Open Start work Overdue by 7d Nov 17 |
| 70 | chip | P2 |
| 71 | chip | Open |
| 72 | button | Select ticket 4978 |
| 73 | button | Onboarding |
| 74 | button | P2 Guest touch base: Pending: Finding her the new house she will extend in from Dec 20 onwards. #4972 724 Abilene Way, Yukon, Oklahoma 73099 OKC Current or past guest request Mike Cacatian Team A In progress Nov 17 Overdue by 7 days Nov 17 |
| 75 | chip | P2 |
| 76 | chip | In progress |
| 77 | button | Select ticket 4972 |
| 78 | button | Active Owner |
| 79 | button | P2 The garage door is broken. It came off the track #4974 5020 S 168th East Ave, Tulsa, Oklahoma 74134 Tulsa Maintenance and landscaping work-order review Qym Fuenteblanca Team B In progress Nov 17 Overdue by 7 days Nov 17 |
| 80 | chip | P2 |
| 81 | chip | In progress |
| 82 | button | Select ticket 4974 |
| 83 | button | Quarterly Reviews |
| 84 | button | P2 Guest touch base: 11/18 - MC #5000 207 High Point Way, Justin, Texas 76247 Fort Worth Current or past guest request Mike Cacatian Team A In progress Nov 18 Overdue by 6 days Nov 18 |
| 85 | chip | P2 |
| 86 | chip | In progress |
| 87 | button | Select ticket 5000 |
| 88 | heading | INSIGHT |
| 89 | button | P2 2014 - get carpet quote to replace #1509 2014 E 52nd St, Tulsa, Oklahoma 74105 Tulsa Other Romeo Canales Team B Waiting on owner Nov 20 · 8:00 AM Overdue by 5d Nov 3 |
| 90 | button | Analytics |
| 91 | chip | P2 |
| 92 | chip | Waiting on owner |
| 93 | button | Select ticket 1509 |
| 94 | button | P2 to reach out to owner on considering to replace the carpet #5048 3712 N 39th St., Broken Arrow, Oklahoma 74014 Tulsa Ongoing maintenance Romeo Canales Team B Open Start work Overdue by 4d Nov 20 |
| 95 | chip | P2 |
| 96 | chip | Open |
| 97 | button | Select ticket 5048 |
| 98 | heading | ADMIN |
| 99 | button | P2 slow shower drain #5046 1068 Berrywood Dr, Greenwood, Indiana 46143 Indy Other James Almario Leadership Open Start work Overdue by 4d Nov 20 |
| 100 | button | Admin tools |
| 101 | chip | P2 |
| 102 | chip | Open |
| 103 | button | Select ticket 5046 |
| 104 | button | View as |
| 105 | button | P2 16401 - dryer not working #1476 16401 Villa Valeria Way, Edmond, Oklahoma 73013 OKC Other Romeo Canales Team B Open Reply now Overdue by 4d Oct 27 |
| 106 | chip | P2 |
| 107 | chip | Open |
| 108 | button | Select ticket 1476 |
| 109 | button | P2 Guest touch base: Guest said no Kleenex, very few kitchen items, and can’t find the volume cont... #5077 305 W 7th St, Edmond, Oklahoma 73003 OKC Current or past guest request Avy Vergara In progress Nov 22 Overdue by 2 days Nov 22 |
| 110 | chip | P2 |
| 111 | chip | In progress |
| 112 | button | Select ticket 5077 |
| 113 | button | P2 5923 - yale lock disconnected #1487 5923 Hollyhock Ln, Montgomery, Texas 77316 Houston Other Romeo Canales Team B Waiting on vendor Nov 23 · 8:00 AM Overdue by 39h Oct 29 |
| 114 | chip | P2 |
| 115 | chip | Waiting on vendor |
| 116 | button | Select ticket 1487 |
| 117 | button | P2 one of dining chairs was broken #5104 4607 W Union St, Broken Arrow, Oklahoma 74011 Tulsa Immediate maintenance Qym Fuenteblanca Team B Open Start work Overdue by 29h Nov 23 |
| 118 | chip | P2 |
| 119 | chip | Open |
| 120 | button | Select ticket 5104 |
| 121 | button | P2 7006 project. This home is missing quite a few standard items that we need ordered and then a few things need replaced. #5102 7006 E 154th St S, Bixby, Oklahoma 74008 Tulsa Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 29h Nov 23 |
| 122 | chip | P2 |
| 123 | chip | Open |
| 124 | button | Select ticket 5102 |
| 125 | button | P2 bathroom mirror broken #5103 18200 Bodegon Rd., Edmond, Oklahoma 73012 OKC Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 29h Nov 23 |
| 126 | chip | P2 |
| 127 | chip | Open |
| 128 | button | Select ticket 5103 |
| 129 | button | P2 Scheduled Pest Control #5099 3915 W 104th St S, Jenks, Oklahoma 74037 Tulsa Ongoing maintenance Emily Jimenez Leadership In progress Nov 23 Overdue by 1 day Nov 23 |
| 130 | chip | P2 |
| 131 | chip | In progress |
| 132 | button | Select ticket 5099 |
| 133 | button | P2 Guest touch base: The guest reported that the bed sheets were dirty: hair all over them, visibl... #5100 815 E Fulton St, Broken Arrow, Oklahoma 74012 Tulsa Current or past guest request Avy Vergara In progress Nov 23 Overdue by 1 day Nov 23 |
| 134 | chip | P2 |
| 135 | chip | In progress |
| 136 | button | Select ticket 5100 |
| 137 | button | P2 small tear/rip in couch #5132 2004 Cedar Ridge Rd, Edmond, Oklahoma 73013 OKC Ongoing maintenance Romeo Canales Team B Open Start work Overdue by 6h Today 4:43 PM |
| 138 | chip | P2 |
| 139 | chip | Open |
| 140 | button | Select ticket 5132 |
| 141 | button | P2 broken coasters #5133 3333 Welling Rd, Edmond, Oklahoma 73012 OKC Ongoing maintenance Romeo Canales Team B Open Start work Overdue by 6h Today 4:46 PM |
| 142 | chip | P2 |
| 143 | chip | Open |
| 144 | button | Select ticket 5133 |
| 145 | button | P2 towel rack repair #5134 628 Joy Ct, Burleson, Texas 76028 Fort Worth Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:04 PM |
| 146 | chip | P2 |
| 147 | chip | Open |
| 148 | button | Select ticket 5134 |
| 149 | button | P2 repair dining chair #5135 817 Halley Dr., Moore, Oklahoma 73160 OKC Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:06 PM |
| 150 | button | My account |
| 151 | chip | P2 |
| 152 | chip | Open |
| 153 | button | Select ticket 5135 |
| 154 | button | Help & Feedback |
| 155 | button | P2 backyard needs mowed #5136 1169 Blue Sky Lane, Burleson, Texas 76028 Fort Worth Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:23 PM |
| 156 | chip | P2 |
| 157 | chip | Open |
| 158 | button | Select ticket 5136 |
| 159 | button | P2 toilet paper holder #5137 845 Alexandria Ln, Joshua, Texas 76058-6216 Fort Worth Immediate maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:52 PM |
| 160 | chip | P2 |
| 161 | chip | Open |
| 162 | button | Select ticket 5137 |
| 163 | button | P3, hide rows |
| 164 | chip | P3 |
| 165 | button | P3 FROM PREVIOUS TURNS- NOT ADDRESSED #4931 845 Alexandria Ln, Joshua, Texas 76058-6216 Fort Worth Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 166 | chip | P3 |
| 167 | chip | Unassigned |
| 168 | chip | Open |
| 169 | button | Select ticket 4931 |
| 170 | button | P3 Landscaping #4932 3000 W Charlotte St, Broken Arrow, Oklahoma 74011 Tulsa Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 171 | chip | P3 |
| 172 | chip | Unassigned |
| 173 | chip | Open |
| 174 | button | Select ticket 4932 |
| 175 | button | P3 Air filter needs to be changed #4933 3000 W Charlotte St, Broken Arrow, Oklahoma 74011 Tulsa Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 176 | chip | P3 |
| 177 | chip | Unassigned |
| 178 | chip | Open |
| 179 | button | Select ticket 4933 |
| 180 | button | P3 Broken kitchen table chair #4934 817 Halley Dr., Moore, Oklahoma 73160 OKC Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 181 | chip | P3 |
| 182 | chip | Unassigned |
| 183 | chip | Open |
| 184 | button | Select ticket 4934 |
| 185 | button | P3 Broken lamp #4939 14553 Serrano Ridge Dr, Ft. Worth, Texas 76052 Fort Worth Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 186 | chip | P3 |
| 187 | chip | Unassigned |
| 188 | chip | Open |
| 189 | button | Select ticket 4939 |
| 190 | button | P3 Trash #4940 4003 Bendale Rd, Benbrook, Texas 76116 Fort Worth Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 191 | chip | P3 |
| 192 | chip | Unassigned |
| 193 | chip | Open |
| 194 | button | Select ticket 4940 |
| 195 | button | P3 Quarterly property review: 13117 NE 9th St #4892 13117 NE 9th St, Choctaw, Oklahoma 73020 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 196 | chip | P3 |
| 197 | chip | Open |
| 198 | button | Select ticket 4892 |
| 199 | button | P3 Quarterly property review: 19021 Meadows Crossing Dr #4893 19021 Meadows Crossing Dr, Edmond, Oklahoma 73012 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 200 | chip | P3 |
| 201 | chip | Open |
| 202 | button | Select ticket 4893 |
| 203 | button | P3 Quarterly property review: 15226 High Timber Ln #4894 15226 High Timber Ln, Noblesville, Indiana 46060 Indy Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 204 | chip | P3 |
| 205 | chip | Open |
| 206 | button | Select ticket 4894 |
| 207 | button | P3 Quarterly property review: 1640 Glade Meadows Dr #4895 1640 Glade Meadows Dr, Joshua, Texas 76058 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 208 | chip | P3 |
| 209 | chip | Open |
| 210 | button | Select ticket 4895 |
| 211 | button | P3 Quarterly property review: 309 Prince John Dr #4896 309 Prince John Dr, Saginaw, Texas 76179 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 212 | chip | P3 |
| 213 | chip | Open |
| 214 | button | Select ticket 4896 |
| 215 | button | P3 Quarterly property review: 207 High Point Way #4897 207 High Point Way, Justin, Texas 76247 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 216 | chip | P3 |
| 217 | chip | Open |
| 218 | button | Select ticket 4897 |
| 219 | button | P3 Quarterly property review: 4607 S. Lakewood Ave #4898 4607 S. Lakewood Ave, Tulsa, Oklahoma 74135 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 220 | chip | P3 |
| 221 | chip | Open |
| 222 | button | Select ticket 4898 |
| 223 | button | P3 Quarterly property review: 2617 W Madison St. #4899 2617 W Madison St., Broken Arrow, Oklahoma 74012 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 224 | chip | P3 |
| 225 | chip | Open |
| 226 | button | Select ticket 4899 |
| 227 | button | P3 Quarterly property review: 4308 NW 158th St. #4900 4308 NW 158th St., Edmond, Oklahoma 73013 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 228 | chip | P3 |
| 229 | chip | Open |
| 230 | button | Select ticket 4900 |
| 231 | button | P3 Quarterly property review: 1908 E Urbana St #4901 1908 E Urbana St, Broken Arrow, Oklahoma 74012 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 232 | chip | P3 |
| 233 | chip | Open |
| 234 | button | Select ticket 4901 |
| 235 | button | P3 Quarterly property review: 10845 Sara Ct #4902 10845 Sara Ct, Midwest City, Oklahoma 73130 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 236 | chip | P3 |
| 237 | chip | Open |
| 238 | button | Select ticket 4902 |
| 239 | button | P3 Quarterly property review: 5034 N. 35th St. #4903 5034 N. 35th St., Broken Arrow, Oklahoma 74014 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 240 | chip | P3 |
| 241 | chip | Open |
| 242 | button | Select ticket 4903 |
| 243 | button | P3 Quarterly property review: 4308 S 177th Pl E #4904 4308 S 177th Pl E, Tulsa, Oklahoma 74134 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 244 | chip | P3 |
| 245 | chip | Open |
| 246 | button | Select ticket 4904 |
| 247 | button | P3 Quarterly property review: 628 Joy Ct #4905 628 Joy Ct, Burleson, Texas 76028 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 248 | chip | P3 |
| 249 | chip | Open |
| 250 | button | Select ticket 4905 |
| 251 | button | P3 Quarterly property review: 3712 N 39th St. #4906 3712 N 39th St., Broken Arrow, Oklahoma 74014 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 252 | chip | P3 |
| 253 | chip | Open |
| 254 | button | Select ticket 4906 |
| 255 | button | P3 Quarterly property review: 428 Drowsy Water Trl #4907 428 Drowsy Water Trl, Ft. Worth, Texas 76131 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 256 | chip | P3 |
| 257 | chip | Open |
| 258 | button | Select ticket 4907 |
| 259 | button | P3 Quarterly property review: 2332 Los Angeles Ave #4908 2332 Los Angeles Ave, Edmond, Oklahoma 73034 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 260 | chip | P3 |
| 261 | chip | Open |
| 262 | button | Select ticket 4908 |
| 263 | button | P3 Quarterly property review: 2016 NW 172ND #4909 2016 NW 172ND, Edmond, Oklahoma 73012 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 264 | chip | P3 |
| 265 | chip | Open |
| 266 | button | Select ticket 4909 |
| 267 | button | P3 Quarterly property review: 7071 Richardson Ct #4910 7071 Richardson Ct, Warr Acres, Oklahoma 73132 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 268 | chip | P3 |
| 269 | chip | Open |
| 270 | button | Select ticket 4910 |
| 271 | button | P3 Quarterly property review: 7351 Red Rock Rd #4911 7351 Red Rock Rd, Indianapolis, Indiana 46236 Indy Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 272 | chip | P3 |
| 273 | chip | Open |
| 274 | button | Select ticket 4911 |
| 275 | button | P3 Quarterly property review: 341 Thistlewood Dr #4912 341 Thistlewood Dr, Greenfield, Indiana 46140 Indy Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 276 | chip | P3 |
| 277 | chip | Open |
| 278 | button | Select ticket 4912 |
| 279 | button | P3 Quarterly property review: 9235 E 133rd St S #4913 9235 E 133rd St S, Bixby, Oklahoma 74008 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 280 | chip | P3 |
| 281 | chip | Open |
| 282 | button | Select ticket 4913 |
| 283 | button | P3 Quarterly property review: 815 E Fulton St #4914 815 E Fulton St, Broken Arrow, Oklahoma 74012 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 284 | chip | P3 |
| 285 | chip | Open |
| 286 | button | Select ticket 4914 |
| 287 | button | P3 Quarterly property review: 305 W 7th St #4915 305 W 7th St, Edmond, Oklahoma 73003 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 288 | chip | P3 |
| 289 | chip | Open |
| 290 | button | Select ticket 4915 |
| 291 | button | P3 Quarterly property review: 236 N Starnes St #4916 236 N Starnes St, Grapevine, Texas 76051 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 292 | chip | P3 |
| 293 | chip | Open |
| 294 | button | Select ticket 4916 |
| 295 | button | P3 Quarterly property review: 8408 NW 162nd St. #4917 8408 NW 162nd St., Edmond, Oklahoma 73013 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 296 | chip | P3 |
| 297 | chip | Open |
| 298 | button | Select ticket 4917 |
| 299 | button | P3 Quarterly property review: 2012 W. Black Powder Way #4918 2012 W. Black Powder Way, Mustang, Oklahoma 73064 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 300 | chip | P3 |
| 301 | chip | Open |
| 302 | button | Select ticket 4918 |
| 303 | button | P3 Quarterly property review: 8332 Welder Pl #4919 8332 Welder Pl, Indianapolis, Indiana 46237 Indy Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 304 | chip | P3 |
| 305 | chip | Open |
| 306 | button | Select ticket 4919 |
| 307 | button | P3 Quarterly property review: 5020 S 168th East Ave #4920 5020 S 168th East Ave, Tulsa, Oklahoma 74134 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 308 | chip | P3 |
| 309 | chip | Open |
| 310 | button | Select ticket 4920 |
| 311 | button | P3 Quarterly property review: 7422 S. Granite Ave #4921 7422 S. Granite Ave, Tulsa, Oklahoma 74136 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 312 | chip | P3 |
| 313 | chip | Open |
| 314 | button | Select ticket 4921 |
| 315 | button | P3 Quarterly property review: 401 E 10th St #4922 401 E 10th St, Edmond, Oklahoma 73034 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 316 | chip | P3 |
| 317 | chip | Open |
| 318 | button | Select ticket 4922 |
| 319 | button | P3 Quarterly property review: 33 Center Ln S #4923 33 Center Ln S, Carlton Landing, Oklahoma 74332 Carlton Landing Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 320 | chip | P3 |
| 321 | chip | Open |
| 322 | button | Select ticket 4923 |
| 323 | button | P3 Quarterly property review: 1636 NE 32nd St #4924 1636 NE 32nd St, Moore, Oklahoma 73160 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 324 | chip | P3 |
| 325 | chip | Open |
| 326 | button | Select ticket 4924 |
| 327 | button | P3 Quarterly property review: 3201 Belmont Circle #4925 3201 Belmont Circle, Edmond, Oklahoma 73034 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 328 | chip | P3 |
| 329 | chip | Open |
| 330 | button | Select ticket 4925 |
| 331 | button | P3 Quarterly property review: 2414 W. Kingsport Ct. S #4926 2414 W. Kingsport Ct. S, Broken Arrow, Oklahoma 74011 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 332 | chip | P3 |
| 333 | chip | Open |
| 334 | button | Select ticket 4926 |
| 335 | button | P3 Quarterly property review: 5923 Hollyhock Ln #4927 5923 Hollyhock Ln, Montgomery, Texas 77316 Houston Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 336 | chip | P3 |
| 337 | chip | Open |
| 338 | button | Select ticket 4927 |
| 339 | button | P3 Quarterly property review: 852 Inland Dr #4928 852 Inland Dr, Avon, Indiana 46123 Indy Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 340 | chip | P3 |
| 341 | chip | Open |
| 342 | button | Select ticket 4928 |
| 343 | button | P3 Back patio/furniture #4961 136 Magnolia Estates St., Crowley, Texas 76036 Fort Worth Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 344 | chip | P3 |
| 345 | chip | Unassigned |
| 346 | chip | Open |
| 347 | button | Select ticket 4961 |
| 348 | button | P3 Ruined linens #4962 136 Magnolia Estates St., Crowley, Texas 76036 Fort Worth Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 349 | chip | P3 |
| 350 | chip | Unassigned |
| 351 | chip | Open |
| 352 | button | Select ticket 4962 |
| 353 | button | P3 Carpet/ rug shampooing. #4963 136 Magnolia Estates St., Crowley, Texas 76036 Fort Worth Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 354 | chip | P3 |
| 355 | chip | Unassigned |
| 356 | chip | Open |
| 357 | button | Select ticket 4963 |
| 358 | button | P3 Yard work #4964 136 Magnolia Estates St., Crowley, Texas 76036 Fort Worth Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 359 | chip | P3 |
| 360 | chip | Unassigned |
| 361 | chip | Open |
| 362 | button | Select ticket 4964 |
| 363 | button | P3 Driveway stains. #4965 136 Magnolia Estates St., Crowley, Texas 76036 Fort Worth Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 364 | chip | P3 |
| 365 | chip | Unassigned |
| 366 | chip | Open |
| 367 | button | Select ticket 4965 |
| 368 | button | P3 Guest items. #4966 136 Magnolia Estates St., Crowley, Texas 76036 Fort Worth Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 369 | chip | P3 |
| 370 | chip | Unassigned |
| 371 | chip | Open |
| 372 | button | Select ticket 4966 |
| 373 | button | P3 Guest bathroom #4975 904 NE 34th Ter, Moore, Oklahoma 73160 OKC Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 374 | chip | P3 |
| 375 | chip | Unassigned |
| 376 | chip | Open |
| 377 | button | Select ticket 4975 |
| 378 | button | P3 Quarterly property review: 11249 Pegasus Dr #4944 11249 Pegasus Dr, Noblesville, Indiana 46060 Indy Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 379 | chip | P3 |
| 380 | chip | Open |
| 381 | button | Select ticket 4944 |
| 382 | button | P3 Quarterly property review: 64 Turtle Loop #4945 64 Turtle Loop, Eufaula, Oklahoma 74432 Carlton Landing Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 383 | chip | P3 |
| 384 | chip | Open |
| 385 | button | Select ticket 4945 |
| 386 | button | P3 Quarterly property review: 7317 NW 159th Ter #4946 7317 NW 159th Ter, Edmond, Oklahoma 73013 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 387 | chip | P3 |
| 388 | chip | Open |
| 389 | button | Select ticket 4946 |
| 390 | button | P3 Quarterly property review: 2901 E 75th St #4947 2901 E 75th St, Tulsa, Oklahoma 74136 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 391 | chip | P3 |
| 392 | chip | Open |
| 393 | button | Select ticket 4947 |
| 394 | button | P3 Quarterly property review: 85 Lower Green Way #4948 85 Lower Green Way, Eufaula, Oklahoma 74432 Carlton Landing Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 395 | chip | P3 |
| 396 | chip | Open |
| 397 | button | Select ticket 4948 |
| 398 | button | P3 Quarterly property review: 13325 E 43rd Pl S #4949 13325 E 43rd Pl S, Tulsa, Oklahoma 74134 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 399 | chip | P3 |
| 400 | chip | Open |
| 401 | button | Select ticket 4949 |
| 402 | button | P3 Quarterly property review: 1722 Westchester Dr #4950 1722 Westchester Dr, The Village, Oklahoma 73120 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 403 | chip | P3 |
| 404 | chip | Open |
| 405 | button | Select ticket 4950 |
| 406 | button | P3 Quarterly property review: 4513 Black Mesa Lane #4951 4513 Black Mesa Lane, Yukon, Oklahoma 73099 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 407 | chip | P3 |
| 408 | chip | Open |
| 409 | button | Select ticket 4951 |
| 410 | button | P3 Quarterly property review: 1056 Wildwood Dr. #4952 1056 Wildwood Dr., Joshua, Texas 76058 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 411 | chip | P3 |
| 412 | chip | Open |
| 413 | button | Select ticket 4952 |
| 414 | button | P3 Quarterly property review: 9008 Scarlet Blvd #4953 9008 Scarlet Blvd, Yukon, Oklahoma 73099 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 415 | chip | P3 |
| 416 | chip | Open |
| 417 | button | Select ticket 4953 |
| 418 | button | P3 Quarterly property review: 10320 Lightning Creek Dr #4954 10320 Lightning Creek Dr, Yukon, Oklahoma 73099 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 419 | chip | P3 |
| 420 | chip | Open |
| 421 | button | Select ticket 4954 |
| 422 | button | P3 Quarterly property review: 1152 Western Yarrow Ave #4955 1152 Western Yarrow Ave, Justin, Texas 76247 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 423 | chip | P3 |
| 424 | chip | Open |
| 425 | button | Select ticket 4955 |
| 426 | button | P3 Quarterly property review: 721 Vaquero St. #4956 721 Vaquero St., White Settlement, Texas 76108 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 427 | chip | P3 |
| 428 | chip | Open |
| 429 | button | Select ticket 4956 |
| 430 | button | P3 Quarterly property review: 1600 E Quantico St #4957 1600 E Quantico St, Broken Arrow, Oklahoma 74011 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 431 | chip | P3 |
| 432 | chip | Open |
| 433 | button | Select ticket 4957 |
| 434 | button | P3 Quarterly property review: 11514 S. Locust Ave #4958 11514 S. Locust Ave, Jenks, Oklahoma 74037 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 435 | chip | P3 |
| 436 | chip | Open |
| 437 | button | Select ticket 4958 |
| 438 | button | P3 Worn dreeeser #4997 5512 Hidden Trail lane, Warr Acres, Oklahoma 73132 OKC Other Unassigned Open Reply now Overdue by 6d Nov 18 |
| 439 | chip | P3 |
| 440 | chip | Unassigned |
| 441 | chip | Open |
| 442 | button | Select ticket 4997 |
| 443 | button | P3 Yard #4998 1169 Blue Sky Lane, Burleson, Texas 76028 Fort Worth Other Unassigned Open Reply now Overdue by 6d Nov 18 |
| 444 | chip | P3 |
| 445 | chip | Unassigned |
| 446 | chip | Open |
| 447 | button | Select ticket 4998 |
| 448 | button | P3 walls #4999 7006 E 154th St S, Bixby, Oklahoma 74008 Tulsa Other Unassigned Open Reply now Overdue by 6d Nov 18 |
| 449 | chip | P3 |
| 450 | chip | Unassigned |
| 451 | chip | Open |
| 452 | button | Select ticket 4999 |
| 453 | button | P3 Trash #5025 4003 Bendale Rd, Benbrook, Texas 76116 Fort Worth Other Unassigned Open Reply now Overdue by 5d Nov 19 |
| 454 | chip | P3 |
| 455 | chip | Unassigned |
| 456 | chip | Open |
| 457 | button | Select ticket 5025 |
| 458 | button | P3 Bedroom near bathroom smells like dog urine #5027 10320 Lightning Creek Dr, Yukon, Oklahoma 73099 OKC Other Unassigned Open Reply now Overdue by 5d Nov 19 |
| 459 | chip | P3 |
| 460 | chip | Unassigned |
| 461 | chip | Open |
| 462 | button | Select ticket 5027 |
| 463 | button | P3 Carpet stain #5028 10320 Lightning Creek Dr, Yukon, Oklahoma 73099 OKC Other Unassigned Open Reply now Overdue by 5d Nov 19 |
| 464 | chip | P3 |
| 465 | chip | Unassigned |
| 466 | chip | Open |
| 467 | button | Select ticket 5028 |
| 468 | button | P3 Quarterly property review: 5253 Tracey Jo Rd #5023 5253 Tracey Jo Rd, Greenwood, Indiana 46142 Indy Quarterly inspection review James Almario Leadership Open Start work Overdue by 5d Nov 19 |
| 469 | chip | P3 |
| 470 | chip | Open |
| 471 | button | Select ticket 5023 |
| 472 | button | P3 Landscaping #5049 11508 E 94th Pl N, Owasso, Oklahoma 74055 Tulsa Other Unassigned Open Reply now Overdue by 4d Nov 20 |
| 473 | chip | P3 |
| 474 | chip | Unassigned |
| 475 | chip | Open |
| 476 | button | Select ticket 5049 |
| 477 | button | P3 Touch up paint #5065 10121 E 131st Pl S, Bixby, Oklahoma 74008 Tulsa Other Unassigned Open Reply now Overdue by 3d Nov 21 |
| 478 | chip | P3 |
| 479 | chip | Unassigned |
| 480 | chip | Open |
| 481 | button | Select ticket 5065 |
| 482 | button | P3 Landscaping #5066 10121 E 131st Pl S, Bixby, Oklahoma 74008 Tulsa Other Unassigned Open Reply now Overdue by 3d Nov 21 |
| 483 | chip | P3 |
| 484 | chip | Unassigned |
| 485 | chip | Open |
| 486 | button | Select ticket 5066 |
| 487 | button | P3 Light fixtures require replacing #5076 4718 E Shadowbrook Dr, Camby, Indiana 46113 Indy Other Unassigned Open Reply now Overdue by 2d Nov 22 |
| 488 | chip | P3 |
| 489 | chip | Unassigned |
| 490 | chip | Open |
| 491 | button | Select ticket 5076 |
| 492 | button | P3 Broken kitchen chair #5078 817 Halley Dr., Moore, Oklahoma 73160 OKC Other Unassigned Open Reply now Overdue by 2d Nov 22 |
| 493 | chip | P3 |
| 494 | chip | Unassigned |
| 495 | chip | Open |
| 496 | button | Select ticket 5078 |
| 497 | button | P3 Dog poop #5079 1152 Western Yarrow Ave, Justin, Texas 76247 Fort Worth Other Unassigned Open Reply now Overdue by 2d Nov 22 |
| 498 | chip | P3 |
| 499 | chip | Unassigned |
| 500 | chip | Open |
| 501 | button | Select ticket 5079 |
| 502 | button | P3 Package #5080 4003 Bendale Rd, Benbrook, Texas 76116 Fort Worth Other Unassigned Open Reply now Overdue by 2d Nov 22 |
| 503 | chip | P3 |
| 504 | chip | Unassigned |
| 505 | chip | Open |
| 506 | button | Select ticket 5080 |
| 507 | button | P3 Broken towel rack #5081 628 Joy Ct, Burleson, Texas 76028 Fort Worth Other Unassigned Open Reply now Overdue by 2d Nov 22 |
| 508 | chip | P3 |
| 509 | chip | Unassigned |
| 510 | chip | Open |
| 511 | button | Select ticket 5081 |
| 512 | button | P3 Reservation #107555754 #5095 2522 S. Irvington Ave, Tulsa, Oklahoma 74114 Tulsa Other Unassigned Open Reply now Overdue by 34h Nov 23 |
| 513 | chip | P3 |
| 514 | chip | Unassigned |
| 515 | chip | Open |
| 516 | button | Select ticket 5095 |
| 517 | button | P3 Damage to kitchen table top #5096 3333 Welling Rd, Edmond, Oklahoma 73012 OKC Other Unassigned Open Reply now Overdue by 34h Nov 23 |
| 518 | chip | P3 |
| 519 | chip | Unassigned |
| 520 | chip | Open |
| 521 | button | Select ticket 5096 |
| 522 | button | P3 Needs a smoke alarm #5097 9120 Yassir Blvd, Yukon, Oklahoma 73099 OKC Other Unassigned Open Reply now Overdue by 34h Nov 23 |
| 523 | chip | P3 |
| 524 | chip | Unassigned |
| 525 | chip | Open |
| 526 | button | Select ticket 5097 |
| 527 | button | P3 Smoke alarm #5098 9120 Yassir Blvd, Yukon, Oklahoma 73099 OKC Other Unassigned Open Reply now Overdue by 34h Nov 23 |
| 528 | chip | P3 |
| 529 | chip | Unassigned |
| 530 | chip | Open |
| 531 | button | Select ticket 5098 |
| 532 | button | P3 3 broken coasters #5101 3333 Welling Rd, Edmond, Oklahoma 73012 OKC Other Unassigned Open Reply now Overdue by 30h Nov 23 |
| 533 | chip | P3 |
| 534 | chip | Unassigned |
| 535 | chip | Open |
| 536 | button | Select ticket 5101 |
| 537 | button | P3 Quarterly property review: 19104 Meadows Crossing Dr. #4891 19104 Meadows Crossing Dr., Edmond, Oklahoma 73012 OKC Quarterly inspection review Micah Sinor In progress Nov 23 Overdue by 1 day Nov 16 |
| 538 | chip | P3 |
| 539 | chip | In progress |
| 540 | button | Select ticket 4891 |
| 541 | button | P3 Reservation #107883011 #5124 33 Center Ln S, Carlton Landing, Oklahoma 74332 Carlton Landing Other Unassigned Open Reply now Overdue by 14h Today 7:20 AM |
| 542 | chip | P3 |
| 543 | chip | Unassigned |
| 544 | chip | Open |
| 545 | button | Select ticket 5124 |
| 546 | button | P3 Couch has small tear #5125 2004 Cedar Ridge Rd, Edmond, Oklahoma 73013 OKC Other Unassigned Open Reply now Overdue by 11h Today 10:17 AM |
| 547 | chip | P3 |
| 548 | chip | Unassigned |
| 549 | chip | Open |
| 550 | button | Select ticket 5125 |
| 551 | button | P3 Broken chair #5126 207 High Point Way, Justin, Texas 76247 Fort Worth Other Unassigned Open Reply now Overdue by 10h Today 10:28 AM |
| 552 | chip | P3 |
| 553 | chip | Unassigned |
| 554 | chip | Open |
| 555 | button | Select ticket 5126 |
| 556 | button | P3 Linens ruined. #5127 207 High Point Way, Justin, Texas 76247 Fort Worth Other Unassigned Open Reply now Overdue by 10h Today 10:31 AM |
| 557 | chip | P3 |
| 558 | chip | Unassigned |
| 559 | chip | Open |
| 560 | button | Select ticket 5127 |
| 561 | button | P3 Excessive trash. #5128 207 High Point Way, Justin, Texas 76247 Fort Worth Other Unassigned Open Reply now Overdue by 10h Today 10:32 AM |
| 562 | chip | P3 |
| 563 | chip | Unassigned |
| 564 | chip | Open |
| 565 | button | Select ticket 5128 |
| 566 | button | P3 Broken lamp #5129 2004 Cedar Ridge Rd, Edmond, Oklahoma 73013 OKC Other Unassigned Open Reply now Overdue by 10h Today 11:03 AM |
| 567 | chip | P3 |
| 568 | chip | Unassigned |
| 569 | chip | Open |
| 570 | button | Select ticket 5129 |
| 571 | button | P3 downstairs bathroom #5130 7422 S. Granite Ave, Tulsa, Oklahoma 74136 Tulsa Other Unassigned Open Reply now Overdue by 9h Today 12:02 PM |
| 572 | chip | P3 |
| 573 | chip | Unassigned |
| 574 | chip | Open |
| 575 | button | Select ticket 5130 |
| 576 | button | P3 Trash outside by front door #5131 3201 Belmont Circle, Edmond, Oklahoma 73034 OKC Other Unassigned Open Reply now Overdue by 5h Today 3:54 PM |
| 577 | chip | P3 |
| 578 | chip | Unassigned |
| 579 | chip | Open |
| 580 | button | Select ticket 5131 |
| 581 | button | Kanban |
| 582 | button | Calendar |
| 583 | heading | Pick up work |
| 584 | button, filter | Team A 0 |
| 585 | button, filter | Team B 40 |
| 586 | button, filter | All teams 40 |
| 587 | button, filter | All unclaimed 40 |
| 588 | heading | From Breezeway |
| 589 | button | Take it |
| 590 | chip | Breezeway |
| 591 | chip | P3 |
| 592 | button | Open in Breezeway |
| 593 | button | Take it |
| 594 | chip | Breezeway |
| 595 | chip | P3 |
| 596 | button | Open in Breezeway |
| 597 | button | Take it |
| 598 | chip | Breezeway |
| 599 | chip | P3 |
| 600 | button | Open in Breezeway |
| 601 | button | Take it |
| 602 | chip | Breezeway |
| 603 | chip | P3 |
| 604 | button | Open in Breezeway |
| 605 | button | Take it |
| 606 | chip | Breezeway |
| 607 | chip | P3 |
| 608 | button | Open in Breezeway |
| 609 | button | Take it |
| 610 | chip | Breezeway |
| 611 | chip | P3 |
| 612 | button | Open in Breezeway |
| 613 | button | Take it |
| 614 | chip | Breezeway |
| 615 | chip | P3 |
| 616 | button | Open in Breezeway |
| 617 | button | Take it |
| 618 | chip | Breezeway |
| 619 | chip | P3 |
| 620 | button | Open in Breezeway |
| 621 | button | Take it |
| 622 | chip | Breezeway |
| 623 | chip | P3 |
| 624 | button | Open in Breezeway |
| 625 | button | Take it |
| 626 | chip | Breezeway |
| 627 | chip | P3 |
| 628 | button | Open in Breezeway |
| 629 | button | Take it |
| 630 | chip | Breezeway |
| 631 | chip | P3 |
| 632 | button | Open in Breezeway |
| 633 | button | Take it |
| 634 | chip | Breezeway |
| 635 | chip | P3 |
| 636 | button | Open in Breezeway |
| 637 | button | Take it |
| 638 | chip | Breezeway |
| 639 | chip | P3 |
| 640 | button | Open in Breezeway |
| 641 | button | Take it |
| 642 | chip | Breezeway |
| 643 | chip | P3 |
| 644 | button | Open in Breezeway |
| 645 | button | Take it |
| 646 | chip | Breezeway |
| 647 | chip | P3 |
| 648 | button | Open in Breezeway |
| 649 | button | Take it |
| 650 | chip | Breezeway |
| 651 | chip | P3 |
| 652 | button | Open in Breezeway |
| 653 | button | Take it |
| 654 | chip | Breezeway |
| 655 | chip | P3 |
| 656 | button | Open in Breezeway |
| 657 | button | Take it |
| 658 | chip | Breezeway |
| 659 | chip | P3 |
| 660 | button | Open in Breezeway |
| 661 | button | Take it |
| 662 | chip | Breezeway |
| 663 | chip | P3 |
| 664 | button | Open in Breezeway |
| 665 | button | Take it |
| 666 | chip | Breezeway |
| 667 | chip | P3 |
| 668 | button | Open in Breezeway |
| 669 | button | Take it |
| 670 | chip | Breezeway |
| 671 | chip | P3 |
| 672 | button | Open in Breezeway |
| 673 | button | Take it |
| 674 | chip | Breezeway |
| 675 | chip | P3 |
| 676 | button | Open in Breezeway |
| 677 | button | Take it |
| 678 | chip | Breezeway |
| 679 | chip | P3 |
| 680 | button | Open in Breezeway |
| 681 | button | Take it |
| 682 | chip | Breezeway |
| 683 | chip | P3 |
| 684 | button | Open in Breezeway |
| 685 | button | Take it |
| 686 | chip | Breezeway |
| 687 | chip | P3 |
| 688 | button | Open in Breezeway |
| 689 | button | Take it |
| 690 | chip | Breezeway |
| 691 | chip | P3 |
| 692 | button | Open in Breezeway |
| 693 | button | Take it |
| 694 | chip | Breezeway |
| 695 | chip | P3 |
| 696 | button | Open in Breezeway |
| 697 | button | Take it |
| 698 | chip | Breezeway |
| 699 | chip | P3 |
| 700 | button | Open in Breezeway |
| 701 | button | Take it |
| 702 | chip | Breezeway |
| 703 | chip | P3 |
| 704 | button | Open in Breezeway |
| 705 | button | Take it |
| 706 | chip | Breezeway |
| 707 | chip | P3 |
| 708 | button | Open in Breezeway |
| 709 | button | Take it |
| 710 | chip | Breezeway |
| 711 | chip | P3 |
| 712 | button | Open in Breezeway |
| 713 | button | Take it |
| 714 | chip | Breezeway |
| 715 | chip | P3 |
| 716 | button | Open in Breezeway |
| 717 | button | Take it |
| 718 | chip | Breezeway |
| 719 | chip | P3 |
| 720 | button | Open in Breezeway |
| 721 | button | Take it |
| 722 | chip | Breezeway |
| 723 | chip | P3 |
| 724 | button | Open in Breezeway |
| 725 | button | Take it |
| 726 | chip | Breezeway |
| 727 | chip | P3 |
| 728 | button | Open in Breezeway |
| 729 | button | Take it |
| 730 | chip | Breezeway |
| 731 | chip | P3 |
| 732 | button | Open in Breezeway |
| 733 | button | Take it |
| 734 | chip | Breezeway |
| 735 | chip | P3 |
| 736 | button | Open in Breezeway |
| 737 | button | Take it |
| 738 | chip | Breezeway |
| 739 | chip | P3 |
| 740 | button | Open in Breezeway |
| 741 | button | Take it |
| 742 | chip | Breezeway |
| 743 | chip | P3 |
| 744 | button | Open in Breezeway |
| 745 | button | Take it |
| 746 | chip | Breezeway |
| 747 | chip | P3 |
| 748 | button | Open in Breezeway |
| 749 | button | Show |
| 750 | heading | Imported from Notion |
| 751 | card | Last 24 hours (115) |
| 752 | heading | Last 24 hours (115) |
| 753 | card | Overdue (91) |
| 754 | heading | Overdue (91) |
| 755 | card | Unassigned (129) |
| 756 | heading | Unassigned (129) |
| 757 | card | Refunds waiting on approval (0) |
| 758 | heading | Refunds waiting on approval (0) |
| 759 | card | Repeat problems this week (2) |
| 760 | heading | Repeat problems this week (2) |
| 761 | button | 4003 Bendale Rd Arrival check: 3 times in 90 days at this home. |
| 762 | button | 10121 E 131st Pl S Arrival check: 3 times in 90 days at this home. |
| 763 | card | Guest rating channels |
| 764 | heading | Guest rating channels |
| 765 | button | Airbnb |
| 766 | button | Vrbo |
| 767 | button | Booking.com |
| 768 | button | Direct |
| 769 | button | Google |
| 770 | button | Save (disabled) |

**Appears more than once:** button: Toggle Sidebar × 2; chip: 1 × 2; button: Unassigned 40 × 2; chip: P2 × 24; chip: In progress × 8; chip: Open × 107; chip: P3 × 135; chip: Unassigned × 40; button: Take it × 40; chip: Breezeway × 40; button: Open in Breezeway × 40.

### desktop-prepare-handoffs.png

Screen: Prepare handoffs. Viewer: Emily. PNG: 1440 × 1800.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Toggle Sidebar |
| 2 | button | Resolve EXECUTIVE ADMINISTRATION |
| 3 | button | Search Resolve ⌘K |
| 4 | button | Record work |
| 5 | button | Record routine work |
| 6 | button | Take the tour |
| 7 | button | Alerts and escalations |
| 8 | button | Chats, 1 unread |
| 9 | button | Notifications |
| 10 | button | Switch to dark mode |
| 11 | chip | 1 |
| 12 | button | Toggle Sidebar |
| 13 | button | Portals |
| 14 | button | Sign out (Admin) |
| 15 | heading | MY DAY |
| 16 | button | Home |
| 17 | heading | Prepare handoffs |
| 18 | button | Team Queue |
| 19 | button | Hand off all (disabled) |
| 20 | button | Direct Bookings |
| 21 | card | Due today (1) |
| 22 | heading | Due today (1) |
| 23 | button | Work Orders |
| 24 | button | Databases |
| 25 | filter | Done so far |
| 26 | filter | Next step |
| 27 | button | Hand off to James Almario (disabled) |
| 28 | button | Oversight 4 |
| 29 | chip | 1 handoff waiting to be accepted, 3 missed shift ends today |
| 30 | button | Guest Claims & Refunds |
| 31 | heading | TEAM |
| 32 | button | Team and Coverage |
| 33 | button | Playbooks |
| 34 | button | Guest-ready standards |
| 35 | heading | HOMES AND OWNERS |
| 36 | button | Properties |
| 37 | button | Onboarding |
| 38 | button | Active Owner |
| 39 | button | Quarterly Reviews |
| 40 | heading | INSIGHT |
| 41 | button | Analytics |
| 42 | heading | ADMIN |
| 43 | button | Admin tools |
| 44 | button | View as |
| 45 | button | My account |
| 46 | button | Help & Feedback |

**Appears more than once:** button: Toggle Sidebar × 2.

### desktop-guest-ready-standards.png

Screen: Guest-ready standards. Viewer: Emily. PNG: 1440 × 1800.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Toggle Sidebar |
| 2 | button | Resolve EXECUTIVE ADMINISTRATION |
| 3 | button | Search Resolve ⌘K |
| 4 | button | Record work |
| 5 | button | Record routine work |
| 6 | button | Take the tour |
| 7 | button | Alerts and escalations |
| 8 | button | Chats, 1 unread |
| 9 | button | Notifications |
| 10 | button | Switch to dark mode |
| 11 | chip | 1 |
| 12 | button | Toggle Sidebar |
| 13 | button | Portals |
| 14 | button | Sign out (Admin) |
| 15 | heading | MY DAY |
| 16 | button | Home |
| 17 | heading | Guest-ready standards |
| 18 | button | Team Queue |
| 19 | button | Add ticket type |
| 20 | button | Direct Bookings |
| 21 | table | Table |
| 22 | button | Work Orders |
| 23 | button | Edit |
| 24 | button | Databases |
| 25 | button | Edit |
| 26 | button | Oversight 4 |
| 27 | chip | 1 handoff waiting to be accepted, 3 missed shift ends today |
| 28 | button | Guest Claims & Refunds |
| 29 | button | Edit |
| 30 | button | Edit |
| 31 | heading | TEAM |
| 32 | button | Team and Coverage |
| 33 | button | Edit |
| 34 | button | Playbooks |
| 35 | button | Edit |
| 36 | button | Guest-ready standards |
| 37 | button | Edit |
| 38 | heading | HOMES AND OWNERS |
| 39 | button | Properties |
| 40 | button | Onboarding |
| 41 | button | Active Owner |
| 42 | button | Quarterly Reviews |
| 43 | heading | INSIGHT |
| 44 | button | Analytics |
| 45 | heading | ADMIN |
| 46 | button | Admin tools |
| 47 | button | View as |
| 48 | button | My account |
| 49 | button | Help & Feedback |

**Appears more than once:** button: Toggle Sidebar × 2; button: Edit × 7.

### desktop-coordinator-team-b-home.png

Screen: Home with Needs you now. Viewer: Property Coordinator Team B view. PNG: 1440 × 1800.

Role preview note: Existing View as supports Property Coordinator only, not a Team A or Team B identity. Emily remains signed in. Home and menu are the same generic coordinator preview; the queue chip selects the named team. These are not separate coordinator accounts or team-specific Home previews.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Toggle Sidebar |
| 2 | button | Resolve OPERATIONS |
| 3 | button | Toggle Sidebar |
| 4 | button | Search Resolve ⌘K |
| 5 | button | Take the tour |
| 6 | button | Chats, 1 unread |
| 7 | button | Notifications |
| 8 | button | Switch to dark mode |
| 9 | button | Portals |
| 10 | button | Sign out (Property Coordinator) |
| 11 | chip | 1 |
| 12 | banner | Viewing as Property Coordinator. You can look around, but nothing can be changed. Stop viewing as |
| 13 | heading | MY DAY |
| 14 | button | Stop viewing as |
| 15 | button | Home |
| 16 | button | Team Queue |
| 17 | button | Direct Bookings |
| 18 | heading | Good morning, Emily. |
| 19 | button | Work Orders |
| 20 | button | Databases |
| 21 | button | Guest Claims & Refunds |
| 22 | card | Needs you now |
| 23 | heading | Needs you now |
| 24 | heading | TEAM |
| 25 | button | Team and Coverage |
| 26 | button | ALE Direct booking you started. Reply within 3 minutes. |
| 27 | button | Playbooks |
| 28 | button | Guest-ready standards |
| 29 | button | Owlmarketplace Direct booking you started. Reply within 3 minutes. |
| 30 | heading | HOMES AND OWNERS |
| 31 | button | Crsth Direct booking you started. Reply within 3 minutes. |
| 32 | button | Properties |
| 33 | button | ale Direct booking you started. Reply within 3 minutes. |
| 34 | button | Direct booking request Direct booking you started. Reply within 3 minutes. |
| 35 | card | My work |
| 36 | heading | My work |
| 37 | button | Team queue (0 unclaimed) |
| 38 | button, tab | Active1 |
| 39 | button, tab | Waiting0 |
| 40 | button, tab | Done recently0 |
| 41 | button, tab | All |
| 42 | button, tab | P1 |
| 43 | button, tab | P2 |
| 44 | button, tab | P3 |
| 45 | button, tab | List |
| 46 | button, tab | Board |
| 47 | filter | Search my work |
| 48 | button | 3915 W 104th St S, Jenks, Oklahoma 74037 Scheduled Pest Control Keep the work moving Due Nov 23 P2 |
| 49 | card | Routine work due today |
| 50 | heading | Routine work due today |
| 51 | button | Record routine work |
| 52 | card | My shift |
| 53 | heading | My shift |
| 54 | button | Request time off |
| 55 | button | End my shift |
| 56 | card | Recent activity (1) |
| 57 | heading | Recent activity (1) |
| 58 | button | Show |
| 59 | button | My account |
| 60 | button | Help & Feedback |

**Appears more than once:** button: Toggle Sidebar × 2.

### desktop-coordinator-team-b-left-menu-open.png

Screen: Left menu fully open. Viewer: Property Coordinator Team B view. PNG: 1440 × 1800.

Role preview note: Existing View as supports Property Coordinator only, not a Team A or Team B identity. Emily remains signed in. Home and menu are the same generic coordinator preview; the queue chip selects the named team. These are not separate coordinator accounts or team-specific Home previews.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Toggle Sidebar |
| 2 | button | Resolve OPERATIONS |
| 3 | button | Toggle Sidebar |
| 4 | button | Search Resolve ⌘K |
| 5 | button | Take the tour |
| 6 | button | Chats, 1 unread |
| 7 | button | Notifications |
| 8 | button | Switch to dark mode |
| 9 | button | Portals |
| 10 | button | Sign out (Property Coordinator) |
| 11 | chip | 1 |
| 12 | banner | Viewing as Property Coordinator. You can look around, but nothing can be changed. Stop viewing as |
| 13 | heading | MY DAY |
| 14 | button | Stop viewing as |
| 15 | button | Home |
| 16 | button | Team Queue |
| 17 | button | Direct Bookings |
| 18 | heading | Good morning, Emily. |
| 19 | button | Work Orders |
| 20 | button | Databases |
| 21 | button | Guest Claims & Refunds |
| 22 | card | Needs you now |
| 23 | heading | Needs you now |
| 24 | heading | TEAM |
| 25 | button | Team and Coverage |
| 26 | button | ALE Direct booking you started. Reply within 3 minutes. |
| 27 | button | Playbooks |
| 28 | button | Guest-ready standards |
| 29 | button | Owlmarketplace Direct booking you started. Reply within 3 minutes. |
| 30 | heading | HOMES AND OWNERS |
| 31 | button | Crsth Direct booking you started. Reply within 3 minutes. |
| 32 | button | Properties |
| 33 | button | ale Direct booking you started. Reply within 3 minutes. |
| 34 | button | Direct booking request Direct booking you started. Reply within 3 minutes. |
| 35 | card | My work |
| 36 | heading | My work |
| 37 | button | Team queue (0 unclaimed) |
| 38 | button, tab | Active1 |
| 39 | button, tab | Waiting0 |
| 40 | button, tab | Done recently0 |
| 41 | button, tab | All |
| 42 | button, tab | P1 |
| 43 | button, tab | P2 |
| 44 | button, tab | P3 |
| 45 | button, tab | List |
| 46 | button, tab | Board |
| 47 | filter | Search my work |
| 48 | button | 3915 W 104th St S, Jenks, Oklahoma 74037 Scheduled Pest Control Keep the work moving Due Nov 23 P2 |
| 49 | card | Routine work due today |
| 50 | heading | Routine work due today |
| 51 | button | Record routine work |
| 52 | card | My shift |
| 53 | heading | My shift |
| 54 | button | Request time off |
| 55 | button | End my shift |
| 56 | card | Recent activity (1) |
| 57 | heading | Recent activity (1) |
| 58 | button | Show |
| 59 | button | My account |
| 60 | button | Help & Feedback |

**Appears more than once:** button: Toggle Sidebar × 2.

### desktop-coordinator-team-b-team-queue.png

Screen: Team Queue. Viewer: Property Coordinator Team B view. PNG: 1440 × 11673.

Role preview note: Existing View as supports Property Coordinator only, not a Team A or Team B identity. Emily remains signed in. Home and menu are the same generic coordinator preview; the queue chip selects the named team. These are not separate coordinator accounts or team-specific Home previews.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Toggle Sidebar |
| 2 | button | Resolve OPERATIONS |
| 3 | button | Toggle Sidebar |
| 4 | button | Search Resolve ⌘K |
| 5 | button | Take the tour |
| 6 | button | Chats, 1 unread |
| 7 | button | Notifications |
| 8 | button | Switch to dark mode |
| 9 | button | Portals |
| 10 | button | Sign out (Property Coordinator) |
| 11 | chip | 1 |
| 12 | banner | Viewing as Property Coordinator. You can look around, but nothing can be changed. Stop viewing as |
| 13 | heading | MY DAY |
| 14 | button | Stop viewing as |
| 15 | button | Home |
| 16 | heading | Team Queue |
| 17 | filter | Search by title or home |
| 18 | button | Filter 1 |
| 19 | button | Clear 1 filter |
| 20 | button | Team Queue |
| 21 | button | Direct Bookings |
| 22 | button, filter | Priority |
| 23 | button, filter | Status |
| 24 | button, filter | Person |
| 25 | button | Work Orders |
| 26 | button, tab | All team 117 |
| 27 | button, tab | Team A 3 |
| 28 | button, tab | Team B 140 |
| 29 | button, tab | Only mine 1 |
| 30 | button, tab | Unassigned 40 |
| 31 | chip | 117 |
| 32 | chip | 3 |
| 33 | chip | 140 |
| 34 | chip | 1 |
| 35 | chip | 40 |
| 36 | button | Databases |
| 37 | button, tab | Maintenance 73 |
| 38 | button, tab | Reported issues 13 |
| 39 | button, tab | Cleaning reviews 0 |
| 40 | button, tab | Inspection reviews 0 |
| 41 | button, tab | Lawn care reviews 54 |
| 42 | chip | 73 |
| 43 | chip | 13 |
| 44 | chip | 0 |
| 45 | chip | 0 |
| 46 | chip | 54 |
| 47 | button | Guest Claims & Refunds |
| 48 | button, filter | Due today 73 |
| 49 | button, filter | This week 91 |
| 50 | button, filter | Next week 0 |
| 51 | button, filter | Closed 14 |
| 52 | heading | TEAM |
| 53 | table | Table |
| 54 | button | Team and Coverage |
| 55 | button | New House Setup - Stage Decor |
| 56 | button | Playbooks |
| 57 | button | Stock Supply Box |
| 58 | button | Guest-ready standards |
| 59 | button | Change Smoke Detector Batteries |
| 60 | heading | HOMES AND OWNERS |
| 61 | button | Properties |
| 62 | button | New House Setup - Press Curtains |
| 63 | button | Island is missing a piece of wood and it needs paint touch up |
| 64 | button | Install Air Filters |
| 65 | button | New House Setup - Setting Up ROKU TVs & Storing Remotes |
| 66 | button | Spare Front Door Key |
| 67 | button | Carpet Cleaning + Curtain Replacement |
| 68 | button | Hall bath tub - stopper |
| 69 | button | Fireplace not working + clogged toilet |
| 70 | button | Onsite Inspection & Quote Collection – 401 E. 10th St. |
| 71 | button | Haulaway Bins |
| 72 | button | Repair Loose Front Door Handle & Toilet Paper Holder – 9211 |
| 73 | button | Repair Broken Dining Chair – 817 Halley Dr. |
| 74 | button | Amazon Return: Ironing Board |
| 75 | button | carpet cleaning |
| 76 | button | Inspect and Repair AC Unit – 2617 W Madison St |
| 77 | button | New House Setup - Prep Property / Meet Photographer |
| 78 | button | Delivering the TV remote |
| 79 | button | Front Door Lock - Low Battery |
| 80 | button | My account |
| 81 | button | Trash Removal and Disposal – 3333 Welling Rd |
| 82 | button | Help & Feedback |
| 83 | button | Remove and Dispose of Excess Trash – 19013 Meadows Crossing |
| 84 | button | Bathroom Vanity Lights Flickering – Inspection and Repair |
| 85 | button | Front Door Lock - Low Battery |
| 86 | button | Carpet stain |
| 87 | button | Carpet/ rug shampooing. |
| 88 | button | Back patio/furniture |
| 89 | button | Driveway stains. |
| 90 | button | trash haulaway |
| 91 | button | Front Door Lock - Low Battery |
| 92 | button | Purchase and Install Garage Door Opener – 9120 Yassir |
| 93 | button | Check Low Water Pressure in Bathroom – 3000 |
| 94 | button | Trash Removal Before Guest Check-In |
| 95 | button | Dead Animal Removal – 10320 |
| 96 | button | fix drywall hole |
| 97 | button | Recharge Ring Doorbell Camera |
| 98 | button | Front Door Lock - Low Battery |
| 99 | button | TEST - Work Order Instructions for Breezeway |
| 100 | button | Front Door Lock - Low Battery |
| 101 | button | Walmart Return Items |
| 102 | button | Bedroom Carpet Cleaning – Dog Urine Odor |
| 103 | button | Light fixtures require replacing |
| 104 | button | Haulaway |
| 105 | button | Front Door Lock - Low Battery |
| 106 | button | Front Door Lock - Low Battery |
| 107 | button | Front Door Lock - Low Battery |
| 108 | button | Kitchen Disposal Replacement |
| 109 | button | Reservation #64895038 |
| 110 | button | Shower Curtain Replacement |
| 111 | button | Haulaway Bins |
| 112 | button | Haul the trash + Broken Bed Board |
| 113 | button | loose toilet |
| 114 | button | The Master Bather Shower is Faulty |
| 115 | button | Inspect and Repair Master Bathroom Shower Head |
| 116 | button | Front Door Lock - Low Battery |
| 117 | button | Garage Door is Broken. |
| 118 | table | Open tickets |
| 119 | button | P2, hide rows |
| 120 | chip | P2 |
| 121 | button | Guest review: Reported issue: Shower head is not working properly. Needs fixing. Manual 2016 NW 172ND, Edmond, Oklahoma 73012 OKC P2 Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 7d Nov 17 |
| 122 | button | Add an update to ticket 4976 |
| 123 | chip | P2 |
| 124 | chip | Open |
| 125 | button | The washer at 7422 has a reported broken timer and may require repair or replacement. Please review the previous updates, confirm the washer Manual 7422 S. Granite Ave, Tulsa, Oklahoma 74136 Tulsa P2 Immediate maintenance Qym Fuenteblanca Team B Open Start work Overdue by 7d Nov 17 |
| 126 | button | Add an update to ticket 4978 |
| 127 | chip | P2 |
| 128 | chip | Open |
| 129 | button | The garage door is broken. It came off the track Manual 5020 S 168th East Ave, Tulsa, Oklahoma 74134 Tulsa P2 Maintenance and landscaping work-order review Qym Fuenteblanca Team B In progress Nov 17 Overdue by 7 days Nov 17 |
| 130 | button | Add an update to ticket 4974 |
| 131 | chip | P2 |
| 132 | chip | In progress |
| 133 | button | 2014 - get carpet quote to replace Manual 2014 E 52nd St, Tulsa, Oklahoma 74105 Tulsa P2 Other Romeo Canales Team B Waiting on owner Nov 20 · 8:00 AM Overdue by 5d Nov 3 |
| 134 | button | Add an update to ticket 1509 |
| 135 | chip | P2 |
| 136 | chip | Waiting on owner |
| 137 | button | to reach out to owner on considering to replace the carpet Manual 3712 N 39th St., Broken Arrow, Oklahoma 74014 Tulsa P2 Ongoing maintenance Romeo Canales Team B Open Start work Overdue by 4d Nov 20 |
| 138 | button | Add an update to ticket 5048 |
| 139 | chip | P2 |
| 140 | chip | Open |
| 141 | button | 16401 - dryer not working Manual 16401 Villa Valeria Way, Edmond, Oklahoma 73013 OKC P2 Other Romeo Canales Team B Open Reply now Overdue by 4d Oct 27 |
| 142 | button | Add an update to ticket 1476 |
| 143 | chip | P2 |
| 144 | chip | Open |
| 145 | button | 5923 - yale lock disconnected Manual 5923 Hollyhock Ln, Montgomery, Texas 77316 Houston P2 Other Romeo Canales Team B Waiting on vendor Nov 23 · 8:00 AM Overdue by 39h Oct 29 |
| 146 | button | Add an update to ticket 1487 |
| 147 | chip | P2 |
| 148 | chip | Waiting on vendor |
| 149 | button | one of dining chairs was broken Manual 4607 W Union St, Broken Arrow, Oklahoma 74011 Tulsa P2 Immediate maintenance Qym Fuenteblanca Team B Open Start work Overdue by 29h Nov 23 |
| 150 | button | Add an update to ticket 5104 |
| 151 | chip | P2 |
| 152 | chip | Open |
| 153 | button | 7006 project. This home is missing quite a few standard items that we need ordered and then a few things need replaced. Manual 7006 E 154th St S, Bixby, Oklahoma 74008 Tulsa P2 Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 29h Nov 23 |
| 154 | button | Add an update to ticket 5102 |
| 155 | chip | P2 |
| 156 | chip | Open |
| 157 | button | bathroom mirror broken Manual 18200 Bodegon Rd., Edmond, Oklahoma 73012 OKC P2 Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 29h Nov 23 |
| 158 | button | Add an update to ticket 5103 |
| 159 | chip | P2 |
| 160 | chip | Open |
| 161 | button | small tear/rip in couch Manual 2004 Cedar Ridge Rd, Edmond, Oklahoma 73013 OKC P2 Ongoing maintenance Romeo Canales Team B Open Start work Overdue by 6h Today 4:43 PM |
| 162 | button | Add an update to ticket 5132 |
| 163 | chip | P2 |
| 164 | chip | Open |
| 165 | button | broken coasters Manual 3333 Welling Rd, Edmond, Oklahoma 73012 OKC P2 Ongoing maintenance Romeo Canales Team B Open Start work Overdue by 6h Today 4:46 PM |
| 166 | button | Add an update to ticket 5133 |
| 167 | chip | P2 |
| 168 | chip | Open |
| 169 | button | towel rack repair Manual 628 Joy Ct, Burleson, Texas 76028 Fort Worth P2 Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:04 PM |
| 170 | button | Add an update to ticket 5134 |
| 171 | chip | P2 |
| 172 | chip | Open |
| 173 | button | repair dining chair Manual 817 Halley Dr., Moore, Oklahoma 73160 OKC P2 Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:06 PM |
| 174 | button | Add an update to ticket 5135 |
| 175 | chip | P2 |
| 176 | chip | Open |
| 177 | button | backyard needs mowed Manual 1169 Blue Sky Lane, Burleson, Texas 76028 Fort Worth P2 Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:23 PM |
| 178 | button | Add an update to ticket 5136 |
| 179 | chip | P2 |
| 180 | chip | Open |
| 181 | button | toilet paper holder Manual 845 Alexandria Ln, Joshua, Texas 76058-6216 Fort Worth P2 Immediate maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:52 PM |
| 182 | button | Add an update to ticket 5137 |
| 183 | chip | P2 |
| 184 | chip | Open |
| 185 | button | Kanban |
| 186 | button | Calendar |
| 187 | heading | Pick up work |
| 188 | button, filter | Team A 0 |
| 189 | button, filter | Team B 40 |
| 190 | button, filter | All teams 40 |
| 191 | button, filter | All unclaimed 40 |
| 192 | heading | From Breezeway |
| 193 | chip | Breezeway |
| 194 | chip | P3 |
| 195 | button | Open in Breezeway |
| 196 | chip | Breezeway |
| 197 | chip | P3 |
| 198 | button | Open in Breezeway |
| 199 | chip | Breezeway |
| 200 | chip | P3 |
| 201 | button | Open in Breezeway |
| 202 | chip | Breezeway |
| 203 | chip | P3 |
| 204 | button | Open in Breezeway |
| 205 | chip | Breezeway |
| 206 | chip | P3 |
| 207 | button | Open in Breezeway |
| 208 | chip | Breezeway |
| 209 | chip | P3 |
| 210 | button | Open in Breezeway |
| 211 | chip | Breezeway |
| 212 | chip | P3 |
| 213 | button | Open in Breezeway |
| 214 | chip | Breezeway |
| 215 | chip | P3 |
| 216 | button | Open in Breezeway |
| 217 | chip | Breezeway |
| 218 | chip | P3 |
| 219 | button | Open in Breezeway |
| 220 | chip | Breezeway |
| 221 | chip | P3 |
| 222 | button | Open in Breezeway |
| 223 | chip | Breezeway |
| 224 | chip | P3 |
| 225 | button | Open in Breezeway |
| 226 | chip | Breezeway |
| 227 | chip | P3 |
| 228 | button | Open in Breezeway |
| 229 | chip | Breezeway |
| 230 | chip | P3 |
| 231 | button | Open in Breezeway |
| 232 | chip | Breezeway |
| 233 | chip | P3 |
| 234 | button | Open in Breezeway |
| 235 | chip | Breezeway |
| 236 | chip | P3 |
| 237 | button | Open in Breezeway |
| 238 | chip | Breezeway |
| 239 | chip | P3 |
| 240 | button | Open in Breezeway |
| 241 | chip | Breezeway |
| 242 | chip | P3 |
| 243 | button | Open in Breezeway |
| 244 | chip | Breezeway |
| 245 | chip | P3 |
| 246 | button | Open in Breezeway |
| 247 | chip | Breezeway |
| 248 | chip | P3 |
| 249 | button | Open in Breezeway |
| 250 | chip | Breezeway |
| 251 | chip | P3 |
| 252 | button | Open in Breezeway |
| 253 | chip | Breezeway |
| 254 | chip | P3 |
| 255 | button | Open in Breezeway |
| 256 | chip | Breezeway |
| 257 | chip | P3 |
| 258 | button | Open in Breezeway |
| 259 | chip | Breezeway |
| 260 | chip | P3 |
| 261 | button | Open in Breezeway |
| 262 | chip | Breezeway |
| 263 | chip | P3 |
| 264 | button | Open in Breezeway |
| 265 | chip | Breezeway |
| 266 | chip | P3 |
| 267 | button | Open in Breezeway |
| 268 | chip | Breezeway |
| 269 | chip | P3 |
| 270 | button | Open in Breezeway |
| 271 | chip | Breezeway |
| 272 | chip | P3 |
| 273 | button | Open in Breezeway |
| 274 | chip | Breezeway |
| 275 | chip | P3 |
| 276 | button | Open in Breezeway |
| 277 | chip | Breezeway |
| 278 | chip | P3 |
| 279 | button | Open in Breezeway |
| 280 | chip | Breezeway |
| 281 | chip | P3 |
| 282 | button | Open in Breezeway |
| 283 | chip | Breezeway |
| 284 | chip | P3 |
| 285 | button | Open in Breezeway |
| 286 | chip | Breezeway |
| 287 | chip | P3 |
| 288 | button | Open in Breezeway |
| 289 | chip | Breezeway |
| 290 | chip | P3 |
| 291 | button | Open in Breezeway |
| 292 | chip | Breezeway |
| 293 | chip | P3 |
| 294 | button | Open in Breezeway |
| 295 | chip | Breezeway |
| 296 | chip | P3 |
| 297 | button | Open in Breezeway |
| 298 | chip | Breezeway |
| 299 | chip | P3 |
| 300 | button | Open in Breezeway |
| 301 | chip | Breezeway |
| 302 | chip | P3 |
| 303 | button | Open in Breezeway |
| 304 | chip | Breezeway |
| 305 | chip | P3 |
| 306 | button | Open in Breezeway |
| 307 | chip | Breezeway |
| 308 | chip | P3 |
| 309 | button | Open in Breezeway |
| 310 | chip | Breezeway |
| 311 | chip | P3 |
| 312 | button | Open in Breezeway |
| 313 | button | Show |
| 314 | heading | Imported from Notion |

**Appears more than once:** button: Toggle Sidebar × 2; chip: 1 × 2; chip: 0 × 2; button: Haulaway Bins × 2; button: Front Door Lock - Low Battery × 9; chip: P2 × 17; chip: Open × 13; chip: Breezeway × 40; chip: P3 × 40; button: Open in Breezeway × 40.

### desktop-coordinator-team-b-open-ticket-panel.png

Screen: Open ticket panel. Viewer: Property Coordinator Team B view. PNG: 1440 × 1800.

Role preview note: Existing View as supports Property Coordinator only, not a Team A or Team B identity. Emily remains signed in. Home and menu are the same generic coordinator preview; the queue chip selects the named team. These are not separate coordinator accounts or team-specific Home previews.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Open full page |
| 2 | button | Close Ticket |
| 3 | heading | Ticket |
| 4 | heading | Guest review: Reported issue: Shower head is not working properly. Needs fixing. |
| 5 | button | More |
| 6 | heading | Corrective commitment |
| 7 | button | Add a commitment |
| 8 | chip | Logged |
| 9 | chip | Fix it |
| 10 | chip | Done |
| 11 | heading | Do this now |
| 12 | heading | Start work |
| 13 | button | Waiting on someone? |
| 14 | card | Make it right |
| 15 | button | lucide-chevron-down |
| 16 | heading | Make it right |
| 17 | heading | DETAILS |
| 18 | filter | Add an update: who you called, what the vendor found, what the guest said… |
| 19 | button | lucide-building-2 |
| 20 | button | lucide-send (disabled) |
| 21 | button | lucide-send (disabled) |
| 22 | heading | Unnamed heading |
| 23 | button, filter | Active-stay impact (disabled) |
| 24 | button, filter | Guest communication required (disabled) |

**Appears more than once:** button: lucide-send × 2.

### desktop-coordinator-team-a-home.png

Screen: Home with Needs you now. Viewer: Property Coordinator Team A view. PNG: 1440 × 1800.

Role preview note: Existing View as supports Property Coordinator only, not a Team A or Team B identity. Emily remains signed in. Home and menu are the same generic coordinator preview; the queue chip selects the named team. These are not separate coordinator accounts or team-specific Home previews.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Toggle Sidebar |
| 2 | button | Resolve OPERATIONS |
| 3 | button | Toggle Sidebar |
| 4 | button | Search Resolve ⌘K |
| 5 | button | Take the tour |
| 6 | button | Chats, 1 unread |
| 7 | button | Notifications |
| 8 | button | Switch to dark mode |
| 9 | button | Portals |
| 10 | button | Sign out (Property Coordinator) |
| 11 | chip | 1 |
| 12 | banner | Viewing as Property Coordinator. You can look around, but nothing can be changed. Stop viewing as |
| 13 | heading | MY DAY |
| 14 | button | Stop viewing as |
| 15 | button | Home |
| 16 | button | Team Queue |
| 17 | button | Direct Bookings |
| 18 | heading | Good morning, Emily. |
| 19 | button | Work Orders |
| 20 | button | Databases |
| 21 | button | Guest Claims & Refunds |
| 22 | card | Needs you now |
| 23 | heading | Needs you now |
| 24 | heading | TEAM |
| 25 | button | Team and Coverage |
| 26 | button | ALE Direct booking you started. Reply within 3 minutes. |
| 27 | button | Playbooks |
| 28 | button | Guest-ready standards |
| 29 | button | Owlmarketplace Direct booking you started. Reply within 3 minutes. |
| 30 | heading | HOMES AND OWNERS |
| 31 | button | Crsth Direct booking you started. Reply within 3 minutes. |
| 32 | button | Properties |
| 33 | button | ale Direct booking you started. Reply within 3 minutes. |
| 34 | button | Direct booking request Direct booking you started. Reply within 3 minutes. |
| 35 | card | My work |
| 36 | heading | My work |
| 37 | button | Team queue (0 unclaimed) |
| 38 | button, tab | Active1 |
| 39 | button, tab | Waiting0 |
| 40 | button, tab | Done recently0 |
| 41 | button, tab | All |
| 42 | button, tab | P1 |
| 43 | button, tab | P2 |
| 44 | button, tab | P3 |
| 45 | button, tab | List |
| 46 | button, tab | Board |
| 47 | filter | Search my work |
| 48 | button | 3915 W 104th St S, Jenks, Oklahoma 74037 Scheduled Pest Control Keep the work moving Due Nov 23 P2 |
| 49 | card | Routine work due today |
| 50 | heading | Routine work due today |
| 51 | button | Record routine work |
| 52 | card | My shift |
| 53 | heading | My shift |
| 54 | button | Request time off |
| 55 | button | End my shift |
| 56 | card | Recent activity (1) |
| 57 | heading | Recent activity (1) |
| 58 | button | Show |
| 59 | button | My account |
| 60 | button | Help & Feedback |

**Appears more than once:** button: Toggle Sidebar × 2.

### desktop-coordinator-team-a-left-menu-open.png

Screen: Left menu fully open. Viewer: Property Coordinator Team A view. PNG: 1440 × 1800.

Role preview note: Existing View as supports Property Coordinator only, not a Team A or Team B identity. Emily remains signed in. Home and menu are the same generic coordinator preview; the queue chip selects the named team. These are not separate coordinator accounts or team-specific Home previews.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Toggle Sidebar |
| 2 | button | Resolve OPERATIONS |
| 3 | button | Toggle Sidebar |
| 4 | button | Search Resolve ⌘K |
| 5 | button | Take the tour |
| 6 | button | Chats, 1 unread |
| 7 | button | Notifications |
| 8 | button | Switch to dark mode |
| 9 | button | Portals |
| 10 | button | Sign out (Property Coordinator) |
| 11 | chip | 1 |
| 12 | banner | Viewing as Property Coordinator. You can look around, but nothing can be changed. Stop viewing as |
| 13 | heading | MY DAY |
| 14 | button | Stop viewing as |
| 15 | button | Home |
| 16 | button | Team Queue |
| 17 | button | Direct Bookings |
| 18 | heading | Good morning, Emily. |
| 19 | button | Work Orders |
| 20 | button | Databases |
| 21 | button | Guest Claims & Refunds |
| 22 | card | Needs you now |
| 23 | heading | Needs you now |
| 24 | heading | TEAM |
| 25 | button | Team and Coverage |
| 26 | button | ALE Direct booking you started. Reply within 3 minutes. |
| 27 | button | Playbooks |
| 28 | button | Guest-ready standards |
| 29 | button | Owlmarketplace Direct booking you started. Reply within 3 minutes. |
| 30 | heading | HOMES AND OWNERS |
| 31 | button | Crsth Direct booking you started. Reply within 3 minutes. |
| 32 | button | Properties |
| 33 | button | ale Direct booking you started. Reply within 3 minutes. |
| 34 | button | Direct booking request Direct booking you started. Reply within 3 minutes. |
| 35 | card | My work |
| 36 | heading | My work |
| 37 | button | Team queue (0 unclaimed) |
| 38 | button, tab | Active1 |
| 39 | button, tab | Waiting0 |
| 40 | button, tab | Done recently0 |
| 41 | button, tab | All |
| 42 | button, tab | P1 |
| 43 | button, tab | P2 |
| 44 | button, tab | P3 |
| 45 | button, tab | List |
| 46 | button, tab | Board |
| 47 | filter | Search my work |
| 48 | button | 3915 W 104th St S, Jenks, Oklahoma 74037 Scheduled Pest Control Keep the work moving Due Nov 23 P2 |
| 49 | card | Routine work due today |
| 50 | heading | Routine work due today |
| 51 | button | Record routine work |
| 52 | card | My shift |
| 53 | heading | My shift |
| 54 | button | Request time off |
| 55 | button | End my shift |
| 56 | card | Recent activity (1) |
| 57 | heading | Recent activity (1) |
| 58 | button | Show |
| 59 | button | My account |
| 60 | button | Help & Feedback |

**Appears more than once:** button: Toggle Sidebar × 2.

### desktop-coordinator-team-a-team-queue.png

Screen: Team Queue. Viewer: Property Coordinator Team A view. PNG: 1440 × 7360.

Role preview note: Existing View as supports Property Coordinator only, not a Team A or Team B identity. Emily remains signed in. Home and menu are the same generic coordinator preview; the queue chip selects the named team. These are not separate coordinator accounts or team-specific Home previews.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Toggle Sidebar |
| 2 | button | Resolve OPERATIONS |
| 3 | button | Toggle Sidebar |
| 4 | button | Search Resolve ⌘K |
| 5 | button | Take the tour |
| 6 | button | Chats, 1 unread |
| 7 | button | Notifications |
| 8 | button | Switch to dark mode |
| 9 | button | Portals |
| 10 | button | Sign out (Property Coordinator) |
| 11 | chip | 1 |
| 12 | banner | Viewing as Property Coordinator. You can look around, but nothing can be changed. Stop viewing as |
| 13 | heading | MY DAY |
| 14 | button | Stop viewing as |
| 15 | button | Home |
| 16 | heading | Team Queue |
| 17 | filter | Search by title or home |
| 18 | button | Filter 1 |
| 19 | button | Clear 1 filter |
| 20 | button | Team Queue |
| 21 | button | Direct Bookings |
| 22 | button, filter | Priority |
| 23 | button, filter | Status |
| 24 | button, filter | Person |
| 25 | button | Work Orders |
| 26 | button, tab | All team 117 |
| 27 | button, tab | Team A 3 |
| 28 | button, tab | Team B 140 |
| 29 | button, tab | Only mine 1 |
| 30 | button, tab | Unassigned 40 |
| 31 | chip | 117 |
| 32 | chip | 3 |
| 33 | chip | 140 |
| 34 | chip | 1 |
| 35 | chip | 40 |
| 36 | button | Databases |
| 37 | button, filter | Unassigned 40 |
| 38 | button, filter | Waiting 2 |
| 39 | button, filter | Blocked 3 |
| 40 | button, filter | Escalated 117 |
| 41 | button, filter | Overdue 112 |
| 42 | button | Guest Claims & Refunds |
| 43 | table | Open tickets |
| 44 | button | P2, hide rows |
| 45 | heading | TEAM |
| 46 | chip | P2 |
| 47 | button | Team and Coverage |
| 48 | button | P2 The Door in the bedroom fell down. The carpet is dirty #4941 207 High Point Way, Justin, Texas 76247 Fort Worth Immediate cleaning need Mike Cacatian Team A In progress Nov 16 Overdue by 8 days Nov 16 |
| 49 | chip | P2 |
| 50 | chip | In progress |
| 51 | button | Select ticket 4941 |
| 52 | button | Playbooks |
| 53 | button | P2 Guest touch base: Pending: Finding her the new house she will extend in from Dec 20 onwards. #4972 724 Abilene Way, Yukon, Oklahoma 73099 OKC Current or past guest request Mike Cacatian Team A In progress Nov 17 Overdue by 7 days Nov 17 |
| 54 | chip | P2 |
| 55 | chip | In progress |
| 56 | button | Select ticket 4972 |
| 57 | button | Guest-ready standards |
| 58 | button | P2 Guest touch base: 11/18 - MC #5000 207 High Point Way, Justin, Texas 76247 Fort Worth Current or past guest request Mike Cacatian Team A In progress Nov 18 Overdue by 6 days Nov 18 |
| 59 | chip | P2 |
| 60 | chip | In progress |
| 61 | button | Select ticket 5000 |
| 62 | heading | HOMES AND OWNERS |
| 63 | button | Kanban |
| 64 | button | Calendar |
| 65 | button | Properties |
| 66 | heading | Pick up work |
| 67 | button, filter | Team A 0 |
| 68 | button, filter | Team B 40 |
| 69 | button, filter | All teams 40 |
| 70 | button, filter | All unclaimed 40 |
| 71 | heading | From Breezeway |
| 72 | chip | Breezeway |
| 73 | chip | P3 |
| 74 | button | Open in Breezeway |
| 75 | chip | Breezeway |
| 76 | chip | P3 |
| 77 | button | Open in Breezeway |
| 78 | chip | Breezeway |
| 79 | chip | P3 |
| 80 | button | Open in Breezeway |
| 81 | chip | Breezeway |
| 82 | chip | P3 |
| 83 | button | Open in Breezeway |
| 84 | chip | Breezeway |
| 85 | chip | P3 |
| 86 | button | Open in Breezeway |
| 87 | chip | Breezeway |
| 88 | chip | P3 |
| 89 | button | Open in Breezeway |
| 90 | button | My account |
| 91 | button | Help & Feedback |
| 92 | chip | Breezeway |
| 93 | chip | P3 |
| 94 | button | Open in Breezeway |
| 95 | chip | Breezeway |
| 96 | chip | P3 |
| 97 | button | Open in Breezeway |
| 98 | chip | Breezeway |
| 99 | chip | P3 |
| 100 | button | Open in Breezeway |
| 101 | chip | Breezeway |
| 102 | chip | P3 |
| 103 | button | Open in Breezeway |
| 104 | chip | Breezeway |
| 105 | chip | P3 |
| 106 | button | Open in Breezeway |
| 107 | chip | Breezeway |
| 108 | chip | P3 |
| 109 | button | Open in Breezeway |
| 110 | chip | Breezeway |
| 111 | chip | P3 |
| 112 | button | Open in Breezeway |
| 113 | chip | Breezeway |
| 114 | chip | P3 |
| 115 | button | Open in Breezeway |
| 116 | chip | Breezeway |
| 117 | chip | P3 |
| 118 | button | Open in Breezeway |
| 119 | chip | Breezeway |
| 120 | chip | P3 |
| 121 | button | Open in Breezeway |
| 122 | chip | Breezeway |
| 123 | chip | P3 |
| 124 | button | Open in Breezeway |
| 125 | chip | Breezeway |
| 126 | chip | P3 |
| 127 | button | Open in Breezeway |
| 128 | chip | Breezeway |
| 129 | chip | P3 |
| 130 | button | Open in Breezeway |
| 131 | chip | Breezeway |
| 132 | chip | P3 |
| 133 | button | Open in Breezeway |
| 134 | chip | Breezeway |
| 135 | chip | P3 |
| 136 | button | Open in Breezeway |
| 137 | chip | Breezeway |
| 138 | chip | P3 |
| 139 | button | Open in Breezeway |
| 140 | chip | Breezeway |
| 141 | chip | P3 |
| 142 | button | Open in Breezeway |
| 143 | chip | Breezeway |
| 144 | chip | P3 |
| 145 | button | Open in Breezeway |
| 146 | chip | Breezeway |
| 147 | chip | P3 |
| 148 | button | Open in Breezeway |
| 149 | chip | Breezeway |
| 150 | chip | P3 |
| 151 | button | Open in Breezeway |
| 152 | chip | Breezeway |
| 153 | chip | P3 |
| 154 | button | Open in Breezeway |
| 155 | chip | Breezeway |
| 156 | chip | P3 |
| 157 | button | Open in Breezeway |
| 158 | chip | Breezeway |
| 159 | chip | P3 |
| 160 | button | Open in Breezeway |
| 161 | chip | Breezeway |
| 162 | chip | P3 |
| 163 | button | Open in Breezeway |
| 164 | chip | Breezeway |
| 165 | chip | P3 |
| 166 | button | Open in Breezeway |
| 167 | chip | Breezeway |
| 168 | chip | P3 |
| 169 | button | Open in Breezeway |
| 170 | chip | Breezeway |
| 171 | chip | P3 |
| 172 | button | Open in Breezeway |
| 173 | chip | Breezeway |
| 174 | chip | P3 |
| 175 | button | Open in Breezeway |
| 176 | chip | Breezeway |
| 177 | chip | P3 |
| 178 | button | Open in Breezeway |
| 179 | chip | Breezeway |
| 180 | chip | P3 |
| 181 | button | Open in Breezeway |
| 182 | chip | Breezeway |
| 183 | chip | P3 |
| 184 | button | Open in Breezeway |
| 185 | chip | Breezeway |
| 186 | chip | P3 |
| 187 | button | Open in Breezeway |
| 188 | chip | Breezeway |
| 189 | chip | P3 |
| 190 | button | Open in Breezeway |
| 191 | chip | Breezeway |
| 192 | chip | P3 |
| 193 | button | Open in Breezeway |
| 194 | button | Show |
| 195 | heading | Imported from Notion |

**Appears more than once:** button: Toggle Sidebar × 2; chip: 1 × 2; button: Unassigned 40 × 2; chip: P2 × 4; chip: In progress × 3; chip: Breezeway × 40; chip: P3 × 40; button: Open in Breezeway × 40.

### desktop-coordinator-team-a-open-ticket-panel.png

Screen: Open ticket panel. Viewer: Property Coordinator Team A view. PNG: 1440 × 2463.

Role preview note: Existing View as supports Property Coordinator only, not a Team A or Team B identity. Emily remains signed in. Home and menu are the same generic coordinator preview; the queue chip selects the named team. These are not separate coordinator accounts or team-specific Home previews.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Open full page |
| 2 | button | Close Ticket |
| 3 | heading | Ticket |
| 4 | heading | The Door in the bedroom fell down. The carpet is dirty |
| 5 | button | More |
| 6 | chip | Logged |
| 7 | chip | Fix it |
| 8 | chip | Done |
| 9 | heading | Do this now |
| 10 | heading | CLEANING COMPLAINT · STEP 2 |
| 11 | heading | Get photos or video from the guest. |
| 12 | button | Show vendor and work order tools |
| 13 | heading | Does this need a field repair? |
| 14 | button | No repair needed: finish this ticket |
| 15 | button | Waiting on someone? |
| 16 | card | Make it right |
| 17 | button | lucide-chevron-down |
| 18 | heading | Make it right |
| 19 | heading | DETAILS |
| 20 | filter | Add an update: who you called, what the vendor found, what the guest said… |
| 21 | button | lucide-building-2 |
| 22 | button | lucide-send (disabled) |
| 23 | button | lucide-send (disabled) |
| 24 | heading | Unnamed heading |
| 25 | button | lucide-external-link |
| 26 | button | View 8fa496d3-4613-4ddb-8cba-da8602df77bd.jpeg |
| 27 | button | Download 8fa496d3-4613-4ddb-8cba-da8602df77bd.jpeg |
| 28 | button | Remove 8fa496d3-4613-4ddb-8cba-da8602df77bd.jpeg |
| 29 | button, filter | Active-stay impact (disabled) |
| 30 | button, filter | Guest communication required (disabled) |
| 31 | button | lucide-external-link |
| 32 | button | lucide-external-link |

**Appears more than once:** button: lucide-send × 2; button: lucide-external-link × 3.

### phone-home.png

Screen: Home with Needs you now. Viewer: Emily. PNG: 390 × 3235.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Search Resolve |
| 2 | button | Record work |
| 3 | button | Record routine work |
| 4 | button | Toggle Sidebar |
| 5 | button | Take the tour |
| 6 | button | Alerts and escalations |
| 7 | button | Chats, 1 unread |
| 8 | button | Notifications |
| 9 | button | Switch to dark mode |
| 10 | chip | 1 |
| 11 | button | lucide-layout-grid |
| 12 | button | Sign out (Admin) |
| 13 | heading | Good morning, Emily. |
| 14 | card | NEEDS MY DECISION |
| 15 | button | Open Oversight |
| 16 | heading | 338 things need your decision. |
| 17 | button | Escalations to me 0 Someone asked for a decision and is waiting on you. |
| 18 | button | Approval requests 9 Spend and owner decisions that cannot move until you answer. |
| 19 | button | Needs review before closing 10 Finished work waiting on your decision to close. |
| 20 | button | Help & Feedback |
| 21 | button | Unassigned work 125 Nobody has picked these up yet. |
| 22 | button | Team blockers 0 Handoffs nobody accepted, and waiting work with no live follow-up. |
| 23 | button | Overdue / high risk 194 Past a clock, or aging well beyond where this priority should land. |
| 24 | button | Recently escalated / cleared 0 Raised or resolved in the last three days. |
| 25 | card | Needs you now |
| 26 | heading | Needs you now |
| 27 | button | 3 missed shift ends today Shift handoffs |
| 28 | button | 1 handoff waiting to be accepted Shift handoffs |
| 29 | button | ALE Direct booking you started. Reply within 3 minutes. |
| 30 | button | Owlmarketplace Direct booking you started. Reply within 3 minutes. |
| 31 | button | Crsth Direct booking you started. Reply within 3 minutes. |
| 32 | button | ale Direct booking you started. Reply within 3 minutes. |
| 33 | button | Direct booking request Direct booking you started. Reply within 3 minutes. |
| 34 | button | See all in Oversight |
| 35 | card | My work |
| 36 | heading | My work |
| 37 | button | Team queue (0 unclaimed) |
| 38 | button, tab | Active1 |
| 39 | button, tab | Waiting0 |
| 40 | button, tab | Done recently0 |
| 41 | button, tab | All |
| 42 | button, tab | P1 |
| 43 | button, tab | P2 |
| 44 | button, tab | P3 |
| 45 | button, tab | List |
| 46 | button, tab | Board |
| 47 | filter | Search my work |
| 48 | button | 3915 W 104th St S, Jenks, Oklahoma 74037 Scheduled Pest Control Keep the work moving Due Nov 23 P2 |
| 49 | card | Routine work due today |
| 50 | heading | Routine work due today |
| 51 | button | Record routine work |
| 52 | card | My shift |
| 53 | heading | My shift |
| 54 | button | Request time off |
| 55 | button | End my shift |
| 56 | card | Recent activity (1) |
| 57 | heading | Recent activity (1) |
| 58 | button | Show |

**Appears more than once:** button: Record routine work × 2.

### phone-left-menu-open.png

Screen: Left menu fully open. Viewer: Emily. PNG: 390 × 1342.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Resolve EXECUTIVE ADMINISTRATION |
| 2 | heading | MY DAY |
| 3 | button | Home |
| 4 | button | Team Queue |
| 5 | button | Direct Bookings |
| 6 | button | Work Orders |
| 7 | button | Databases |
| 8 | button | Oversight 4 |
| 9 | chip | 1 handoff waiting to be accepted, 3 missed shift ends today |
| 10 | button | Guest Claims & Refunds |
| 11 | heading | TEAM |
| 12 | button | Team and Coverage |
| 13 | button | Playbooks |
| 14 | button | Guest-ready standards |
| 15 | heading | HOMES AND OWNERS |
| 16 | button | Properties |
| 17 | button | Onboarding |
| 18 | button | Active Owner |
| 19 | button | Quarterly Reviews |
| 20 | heading | INSIGHT |
| 21 | button | Analytics |
| 22 | heading | ADMIN |
| 23 | button | Admin tools |
| 24 | button | View as |
| 25 | button | My account |

**Appears more than once:** No exact repeated label detected in the counted foreground surface..

### phone-team-queue-default.png

Screen: Team Queue default. Viewer: Emily. PNG: 390 × 16758.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Search Resolve |
| 2 | button | Record work |
| 3 | button | Record routine work |
| 4 | button | Toggle Sidebar |
| 5 | button | Take the tour |
| 6 | button | Alerts and escalations |
| 7 | button | Chats, 1 unread |
| 8 | button | Notifications |
| 9 | button | Switch to dark mode |
| 10 | chip | 1 |
| 11 | button | lucide-layout-grid |
| 12 | button | Sign out (Admin) |
| 13 | heading | Team Queue |
| 14 | filter | Search by title or home |
| 15 | button, filter | Filter |
| 16 | button, tab | All team 117 |
| 17 | button, tab | Team A 3 |
| 18 | button, tab | Team B 140 |
| 19 | button, tab | Only mine 1 |
| 20 | chip | 117 |
| 21 | chip | 3 |
| 22 | chip | 140 |
| 23 | button, filter | Priority |
| 24 | button, filter | Status |
| 25 | button, filter | Person |
| 26 | button, filter | Unassigned 40 |
| 27 | button, filter | Waiting 2 |
| 28 | button, filter | Blocked 3 |
| 29 | button, filter | Escalated 117 |
| 30 | button, filter | Overdue 112 |
| 31 | table | Open tickets |
| 32 | button | P2, hide rows |
| 33 | chip | P2 |
| 34 | button | P2 The Door in the bedroom fell down. The carpet is dirty #4941 207 High Point Way, Justin, Texas 76247 Fort Worth Immediate cleaning need Mike Cacatian Team A In progress Nov 16 Overdue by 8 days Nov 16 |
| 35 | chip | P2 |
| 36 | button | Select ticket 4941 |
| 37 | button | Help & Feedback |
| 38 | button | P2 Guest review: Reported issue: Shower head is not working properly. Needs fixing. #4976 2016 NW 172ND, Edmond, Oklahoma 73012 OKC Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 7d Nov 17 |
| 39 | chip | P2 |
| 40 | button | Select ticket 4976 |
| 41 | button | P2 The washer at 7422 has a reported broken timer and may require repair or replacement. Please review the previous updates, confirm the washer #4978 7422 S. Granite Ave, Tulsa, Oklahoma 74136 Tulsa Immediate maintenance Qym Fuenteblanca Team B Open Start work Overdue by 7d Nov 17 |
| 42 | chip | P2 |
| 43 | button | Select ticket 4978 |
| 44 | button | P2 Guest touch base: Pending: Finding her the new house she will extend in from Dec 20 onwards. #4972 724 Abilene Way, Yukon, Oklahoma 73099 OKC Current or past guest request Mike Cacatian Team A In progress Nov 17 Overdue by 7 days Nov 17 |
| 45 | chip | P2 |
| 46 | button | Select ticket 4972 |
| 47 | button | P2 The garage door is broken. It came off the track #4974 5020 S 168th East Ave, Tulsa, Oklahoma 74134 Tulsa Maintenance and landscaping work-order review Qym Fuenteblanca Team B In progress Nov 17 Overdue by 7 days Nov 17 |
| 48 | chip | P2 |
| 49 | button | Select ticket 4974 |
| 50 | button | P2 Guest touch base: 11/18 - MC #5000 207 High Point Way, Justin, Texas 76247 Fort Worth Current or past guest request Mike Cacatian Team A In progress Nov 18 Overdue by 6 days Nov 18 |
| 51 | chip | P2 |
| 52 | button | Select ticket 5000 |
| 53 | button | P2 2014 - get carpet quote to replace #1509 2014 E 52nd St, Tulsa, Oklahoma 74105 Tulsa Other Romeo Canales Team B Waiting on owner Nov 20 · 8:00 AM Overdue by 5d Nov 3 |
| 54 | chip | P2 |
| 55 | button | Select ticket 1509 |
| 56 | button | P2 to reach out to owner on considering to replace the carpet #5048 3712 N 39th St., Broken Arrow, Oklahoma 74014 Tulsa Ongoing maintenance Romeo Canales Team B Open Start work Overdue by 4d Nov 20 |
| 57 | chip | P2 |
| 58 | button | Select ticket 5048 |
| 59 | button | P2 slow shower drain #5046 1068 Berrywood Dr, Greenwood, Indiana 46143 Indy Other James Almario Leadership Open Start work Overdue by 4d Nov 20 |
| 60 | chip | P2 |
| 61 | button | Select ticket 5046 |
| 62 | button | P2 16401 - dryer not working #1476 16401 Villa Valeria Way, Edmond, Oklahoma 73013 OKC Other Romeo Canales Team B Open Reply now Overdue by 4d Oct 27 |
| 63 | chip | P2 |
| 64 | button | Select ticket 1476 |
| 65 | button | P2 Guest touch base: Guest said no Kleenex, very few kitchen items, and can’t find the volume cont... #5077 305 W 7th St, Edmond, Oklahoma 73003 OKC Current or past guest request Avy Vergara In progress Nov 22 Overdue by 2 days Nov 22 |
| 66 | chip | P2 |
| 67 | button | Select ticket 5077 |
| 68 | button | P2 5923 - yale lock disconnected #1487 5923 Hollyhock Ln, Montgomery, Texas 77316 Houston Other Romeo Canales Team B Waiting on vendor Nov 23 · 8:00 AM Overdue by 39h Oct 29 |
| 69 | chip | P2 |
| 70 | button | Select ticket 1487 |
| 71 | button | P2 one of dining chairs was broken #5104 4607 W Union St, Broken Arrow, Oklahoma 74011 Tulsa Immediate maintenance Qym Fuenteblanca Team B Open Start work Overdue by 29h Nov 23 |
| 72 | chip | P2 |
| 73 | button | Select ticket 5104 |
| 74 | button | P2 7006 project. This home is missing quite a few standard items that we need ordered and then a few things need replaced. #5102 7006 E 154th St S, Bixby, Oklahoma 74008 Tulsa Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 29h Nov 23 |
| 75 | chip | P2 |
| 76 | button | Select ticket 5102 |
| 77 | button | P2 bathroom mirror broken #5103 18200 Bodegon Rd., Edmond, Oklahoma 73012 OKC Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 29h Nov 23 |
| 78 | chip | P2 |
| 79 | button | Select ticket 5103 |
| 80 | button | P2 Scheduled Pest Control #5099 3915 W 104th St S, Jenks, Oklahoma 74037 Tulsa Ongoing maintenance Emily Jimenez Leadership In progress Nov 23 Overdue by 1 day Nov 23 |
| 81 | chip | P2 |
| 82 | button | Select ticket 5099 |
| 83 | button | P2 Guest touch base: The guest reported that the bed sheets were dirty: hair all over them, visibl... #5100 815 E Fulton St, Broken Arrow, Oklahoma 74012 Tulsa Current or past guest request Avy Vergara In progress Nov 23 Overdue by 1 day Nov 23 |
| 84 | chip | P2 |
| 85 | button | Select ticket 5100 |
| 86 | button | P2 small tear/rip in couch #5132 2004 Cedar Ridge Rd, Edmond, Oklahoma 73013 OKC Ongoing maintenance Romeo Canales Team B Open Start work Overdue by 6h Today 4:43 PM |
| 87 | chip | P2 |
| 88 | button | Select ticket 5132 |
| 89 | button | P2 broken coasters #5133 3333 Welling Rd, Edmond, Oklahoma 73012 OKC Ongoing maintenance Romeo Canales Team B Open Start work Overdue by 6h Today 4:46 PM |
| 90 | chip | P2 |
| 91 | button | Select ticket 5133 |
| 92 | button | P2 towel rack repair #5134 628 Joy Ct, Burleson, Texas 76028 Fort Worth Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:04 PM |
| 93 | chip | P2 |
| 94 | button | Select ticket 5134 |
| 95 | button | P2 repair dining chair #5135 817 Halley Dr., Moore, Oklahoma 73160 OKC Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:06 PM |
| 96 | chip | P2 |
| 97 | button | Select ticket 5135 |
| 98 | button | P2 backyard needs mowed #5136 1169 Blue Sky Lane, Burleson, Texas 76028 Fort Worth Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:23 PM |
| 99 | chip | P2 |
| 100 | button | Select ticket 5136 |
| 101 | button | P2 toilet paper holder #5137 845 Alexandria Ln, Joshua, Texas 76058-6216 Fort Worth Immediate maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:52 PM |
| 102 | chip | P2 |
| 103 | button | Select ticket 5137 |
| 104 | button | P3, hide rows |
| 105 | chip | P3 |
| 106 | button | P3 FROM PREVIOUS TURNS- NOT ADDRESSED #4931 845 Alexandria Ln, Joshua, Texas 76058-6216 Fort Worth Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 107 | chip | P3 |
| 108 | button | Select ticket 4931 |
| 109 | button | P3 Landscaping #4932 3000 W Charlotte St, Broken Arrow, Oklahoma 74011 Tulsa Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 110 | chip | P3 |
| 111 | button | Select ticket 4932 |
| 112 | button | P3 Air filter needs to be changed #4933 3000 W Charlotte St, Broken Arrow, Oklahoma 74011 Tulsa Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 113 | chip | P3 |
| 114 | button | Select ticket 4933 |
| 115 | button | P3 Broken kitchen table chair #4934 817 Halley Dr., Moore, Oklahoma 73160 OKC Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 116 | chip | P3 |
| 117 | button | Select ticket 4934 |
| 118 | button | P3 Broken lamp #4939 14553 Serrano Ridge Dr, Ft. Worth, Texas 76052 Fort Worth Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 119 | chip | P3 |
| 120 | button | Select ticket 4939 |
| 121 | button | P3 Trash #4940 4003 Bendale Rd, Benbrook, Texas 76116 Fort Worth Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 122 | chip | P3 |
| 123 | button | Select ticket 4940 |
| 124 | button | P3 Quarterly property review: 13117 NE 9th St #4892 13117 NE 9th St, Choctaw, Oklahoma 73020 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 125 | chip | P3 |
| 126 | button | Select ticket 4892 |
| 127 | button | P3 Quarterly property review: 19021 Meadows Crossing Dr #4893 19021 Meadows Crossing Dr, Edmond, Oklahoma 73012 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 128 | chip | P3 |
| 129 | button | Select ticket 4893 |
| 130 | button | P3 Quarterly property review: 15226 High Timber Ln #4894 15226 High Timber Ln, Noblesville, Indiana 46060 Indy Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 131 | chip | P3 |
| 132 | button | Select ticket 4894 |
| 133 | button | P3 Quarterly property review: 1640 Glade Meadows Dr #4895 1640 Glade Meadows Dr, Joshua, Texas 76058 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 134 | chip | P3 |
| 135 | button | Select ticket 4895 |
| 136 | button | P3 Quarterly property review: 309 Prince John Dr #4896 309 Prince John Dr, Saginaw, Texas 76179 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 137 | chip | P3 |
| 138 | button | Select ticket 4896 |
| 139 | button | P3 Quarterly property review: 207 High Point Way #4897 207 High Point Way, Justin, Texas 76247 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 140 | chip | P3 |
| 141 | button | Select ticket 4897 |
| 142 | button | P3 Quarterly property review: 4607 S. Lakewood Ave #4898 4607 S. Lakewood Ave, Tulsa, Oklahoma 74135 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 143 | chip | P3 |
| 144 | button | Select ticket 4898 |
| 145 | button | P3 Quarterly property review: 2617 W Madison St. #4899 2617 W Madison St., Broken Arrow, Oklahoma 74012 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 146 | chip | P3 |
| 147 | button | Select ticket 4899 |
| 148 | button | P3 Quarterly property review: 4308 NW 158th St. #4900 4308 NW 158th St., Edmond, Oklahoma 73013 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 149 | chip | P3 |
| 150 | button | Select ticket 4900 |
| 151 | button | P3 Quarterly property review: 1908 E Urbana St #4901 1908 E Urbana St, Broken Arrow, Oklahoma 74012 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 152 | chip | P3 |
| 153 | button | Select ticket 4901 |
| 154 | button | P3 Quarterly property review: 10845 Sara Ct #4902 10845 Sara Ct, Midwest City, Oklahoma 73130 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 155 | chip | P3 |
| 156 | button | Select ticket 4902 |
| 157 | button | P3 Quarterly property review: 5034 N. 35th St. #4903 5034 N. 35th St., Broken Arrow, Oklahoma 74014 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 158 | chip | P3 |
| 159 | button | Select ticket 4903 |
| 160 | button | P3 Quarterly property review: 4308 S 177th Pl E #4904 4308 S 177th Pl E, Tulsa, Oklahoma 74134 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 161 | chip | P3 |
| 162 | button | Select ticket 4904 |
| 163 | button | P3 Quarterly property review: 628 Joy Ct #4905 628 Joy Ct, Burleson, Texas 76028 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 164 | chip | P3 |
| 165 | button | Select ticket 4905 |
| 166 | button | P3 Quarterly property review: 3712 N 39th St. #4906 3712 N 39th St., Broken Arrow, Oklahoma 74014 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 167 | chip | P3 |
| 168 | button | Select ticket 4906 |
| 169 | button | P3 Quarterly property review: 428 Drowsy Water Trl #4907 428 Drowsy Water Trl, Ft. Worth, Texas 76131 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 170 | chip | P3 |
| 171 | button | Select ticket 4907 |
| 172 | button | P3 Quarterly property review: 2332 Los Angeles Ave #4908 2332 Los Angeles Ave, Edmond, Oklahoma 73034 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 173 | chip | P3 |
| 174 | button | Select ticket 4908 |
| 175 | button | P3 Quarterly property review: 2016 NW 172ND #4909 2016 NW 172ND, Edmond, Oklahoma 73012 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 176 | chip | P3 |
| 177 | button | Select ticket 4909 |
| 178 | button | P3 Quarterly property review: 7071 Richardson Ct #4910 7071 Richardson Ct, Warr Acres, Oklahoma 73132 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 179 | chip | P3 |
| 180 | button | Select ticket 4910 |
| 181 | button | P3 Quarterly property review: 7351 Red Rock Rd #4911 7351 Red Rock Rd, Indianapolis, Indiana 46236 Indy Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 182 | chip | P3 |
| 183 | button | Select ticket 4911 |
| 184 | button | P3 Quarterly property review: 341 Thistlewood Dr #4912 341 Thistlewood Dr, Greenfield, Indiana 46140 Indy Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 185 | chip | P3 |
| 186 | button | Select ticket 4912 |
| 187 | button | P3 Quarterly property review: 9235 E 133rd St S #4913 9235 E 133rd St S, Bixby, Oklahoma 74008 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 188 | chip | P3 |
| 189 | button | Select ticket 4913 |
| 190 | button | P3 Quarterly property review: 815 E Fulton St #4914 815 E Fulton St, Broken Arrow, Oklahoma 74012 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 191 | chip | P3 |
| 192 | button | Select ticket 4914 |
| 193 | button | P3 Quarterly property review: 305 W 7th St #4915 305 W 7th St, Edmond, Oklahoma 73003 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 194 | chip | P3 |
| 195 | button | Select ticket 4915 |
| 196 | button | P3 Quarterly property review: 236 N Starnes St #4916 236 N Starnes St, Grapevine, Texas 76051 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 197 | chip | P3 |
| 198 | button | Select ticket 4916 |
| 199 | button | P3 Quarterly property review: 8408 NW 162nd St. #4917 8408 NW 162nd St., Edmond, Oklahoma 73013 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 200 | chip | P3 |
| 201 | button | Select ticket 4917 |
| 202 | button | P3 Quarterly property review: 2012 W. Black Powder Way #4918 2012 W. Black Powder Way, Mustang, Oklahoma 73064 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 203 | chip | P3 |
| 204 | button | Select ticket 4918 |
| 205 | button | P3 Quarterly property review: 8332 Welder Pl #4919 8332 Welder Pl, Indianapolis, Indiana 46237 Indy Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 206 | chip | P3 |
| 207 | button | Select ticket 4919 |
| 208 | button | P3 Quarterly property review: 5020 S 168th East Ave #4920 5020 S 168th East Ave, Tulsa, Oklahoma 74134 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 209 | chip | P3 |
| 210 | button | Select ticket 4920 |
| 211 | button | P3 Quarterly property review: 7422 S. Granite Ave #4921 7422 S. Granite Ave, Tulsa, Oklahoma 74136 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 212 | chip | P3 |
| 213 | button | Select ticket 4921 |
| 214 | button | P3 Quarterly property review: 401 E 10th St #4922 401 E 10th St, Edmond, Oklahoma 73034 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 215 | chip | P3 |
| 216 | button | Select ticket 4922 |
| 217 | button | P3 Quarterly property review: 33 Center Ln S #4923 33 Center Ln S, Carlton Landing, Oklahoma 74332 Carlton Landing Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 218 | chip | P3 |
| 219 | button | Select ticket 4923 |
| 220 | button | P3 Quarterly property review: 1636 NE 32nd St #4924 1636 NE 32nd St, Moore, Oklahoma 73160 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 221 | chip | P3 |
| 222 | button | Select ticket 4924 |
| 223 | button | P3 Quarterly property review: 3201 Belmont Circle #4925 3201 Belmont Circle, Edmond, Oklahoma 73034 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 224 | chip | P3 |
| 225 | button | Select ticket 4925 |
| 226 | button | P3 Quarterly property review: 2414 W. Kingsport Ct. S #4926 2414 W. Kingsport Ct. S, Broken Arrow, Oklahoma 74011 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 227 | chip | P3 |
| 228 | button | Select ticket 4926 |
| 229 | button | P3 Quarterly property review: 5923 Hollyhock Ln #4927 5923 Hollyhock Ln, Montgomery, Texas 77316 Houston Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 230 | chip | P3 |
| 231 | button | Select ticket 4927 |
| 232 | button | P3 Quarterly property review: 852 Inland Dr #4928 852 Inland Dr, Avon, Indiana 46123 Indy Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 233 | chip | P3 |
| 234 | button | Select ticket 4928 |
| 235 | button | P3 Back patio/furniture #4961 136 Magnolia Estates St., Crowley, Texas 76036 Fort Worth Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 236 | chip | P3 |
| 237 | button | Select ticket 4961 |
| 238 | button | P3 Ruined linens #4962 136 Magnolia Estates St., Crowley, Texas 76036 Fort Worth Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 239 | chip | P3 |
| 240 | button | Select ticket 4962 |
| 241 | button | P3 Carpet/ rug shampooing. #4963 136 Magnolia Estates St., Crowley, Texas 76036 Fort Worth Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 242 | chip | P3 |
| 243 | button | Select ticket 4963 |
| 244 | button | P3 Yard work #4964 136 Magnolia Estates St., Crowley, Texas 76036 Fort Worth Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 245 | chip | P3 |
| 246 | button | Select ticket 4964 |
| 247 | button | P3 Driveway stains. #4965 136 Magnolia Estates St., Crowley, Texas 76036 Fort Worth Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 248 | chip | P3 |
| 249 | button | Select ticket 4965 |
| 250 | button | P3 Guest items. #4966 136 Magnolia Estates St., Crowley, Texas 76036 Fort Worth Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 251 | chip | P3 |
| 252 | button | Select ticket 4966 |
| 253 | button | P3 Guest bathroom #4975 904 NE 34th Ter, Moore, Oklahoma 73160 OKC Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 254 | chip | P3 |
| 255 | button | Select ticket 4975 |
| 256 | button | P3 Quarterly property review: 11249 Pegasus Dr #4944 11249 Pegasus Dr, Noblesville, Indiana 46060 Indy Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 257 | chip | P3 |
| 258 | button | Select ticket 4944 |
| 259 | button | P3 Quarterly property review: 64 Turtle Loop #4945 64 Turtle Loop, Eufaula, Oklahoma 74432 Carlton Landing Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 260 | chip | P3 |
| 261 | button | Select ticket 4945 |
| 262 | button | P3 Quarterly property review: 7317 NW 159th Ter #4946 7317 NW 159th Ter, Edmond, Oklahoma 73013 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 263 | chip | P3 |
| 264 | button | Select ticket 4946 |
| 265 | button | P3 Quarterly property review: 2901 E 75th St #4947 2901 E 75th St, Tulsa, Oklahoma 74136 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 266 | chip | P3 |
| 267 | button | Select ticket 4947 |
| 268 | button | P3 Quarterly property review: 85 Lower Green Way #4948 85 Lower Green Way, Eufaula, Oklahoma 74432 Carlton Landing Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 269 | chip | P3 |
| 270 | button | Select ticket 4948 |
| 271 | button | P3 Quarterly property review: 13325 E 43rd Pl S #4949 13325 E 43rd Pl S, Tulsa, Oklahoma 74134 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 272 | chip | P3 |
| 273 | button | Select ticket 4949 |
| 274 | button | P3 Quarterly property review: 1722 Westchester Dr #4950 1722 Westchester Dr, The Village, Oklahoma 73120 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 275 | chip | P3 |
| 276 | button | Select ticket 4950 |
| 277 | button | P3 Quarterly property review: 4513 Black Mesa Lane #4951 4513 Black Mesa Lane, Yukon, Oklahoma 73099 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 278 | chip | P3 |
| 279 | button | Select ticket 4951 |
| 280 | button | P3 Quarterly property review: 1056 Wildwood Dr. #4952 1056 Wildwood Dr., Joshua, Texas 76058 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 281 | chip | P3 |
| 282 | button | Select ticket 4952 |
| 283 | button | P3 Quarterly property review: 9008 Scarlet Blvd #4953 9008 Scarlet Blvd, Yukon, Oklahoma 73099 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 284 | chip | P3 |
| 285 | button | Select ticket 4953 |
| 286 | button | P3 Quarterly property review: 10320 Lightning Creek Dr #4954 10320 Lightning Creek Dr, Yukon, Oklahoma 73099 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 287 | chip | P3 |
| 288 | button | Select ticket 4954 |
| 289 | button | P3 Quarterly property review: 1152 Western Yarrow Ave #4955 1152 Western Yarrow Ave, Justin, Texas 76247 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 290 | chip | P3 |
| 291 | button | Select ticket 4955 |
| 292 | button | P3 Quarterly property review: 721 Vaquero St. #4956 721 Vaquero St., White Settlement, Texas 76108 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 293 | chip | P3 |
| 294 | button | Select ticket 4956 |
| 295 | button | P3 Quarterly property review: 1600 E Quantico St #4957 1600 E Quantico St, Broken Arrow, Oklahoma 74011 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 296 | chip | P3 |
| 297 | button | Select ticket 4957 |
| 298 | button | P3 Quarterly property review: 11514 S. Locust Ave #4958 11514 S. Locust Ave, Jenks, Oklahoma 74037 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 299 | chip | P3 |
| 300 | button | Select ticket 4958 |
| 301 | button | P3 Worn dreeeser #4997 5512 Hidden Trail lane, Warr Acres, Oklahoma 73132 OKC Other Unassigned Open Reply now Overdue by 6d Nov 18 |
| 302 | chip | P3 |
| 303 | button | Select ticket 4997 |
| 304 | button | P3 Yard #4998 1169 Blue Sky Lane, Burleson, Texas 76028 Fort Worth Other Unassigned Open Reply now Overdue by 6d Nov 18 |
| 305 | chip | P3 |
| 306 | button | Select ticket 4998 |
| 307 | button | P3 walls #4999 7006 E 154th St S, Bixby, Oklahoma 74008 Tulsa Other Unassigned Open Reply now Overdue by 6d Nov 18 |
| 308 | chip | P3 |
| 309 | button | Select ticket 4999 |
| 310 | button | P3 Trash #5025 4003 Bendale Rd, Benbrook, Texas 76116 Fort Worth Other Unassigned Open Reply now Overdue by 5d Nov 19 |
| 311 | chip | P3 |
| 312 | button | Select ticket 5025 |
| 313 | button | P3 Bedroom near bathroom smells like dog urine #5027 10320 Lightning Creek Dr, Yukon, Oklahoma 73099 OKC Other Unassigned Open Reply now Overdue by 5d Nov 19 |
| 314 | chip | P3 |
| 315 | button | Select ticket 5027 |
| 316 | button | P3 Carpet stain #5028 10320 Lightning Creek Dr, Yukon, Oklahoma 73099 OKC Other Unassigned Open Reply now Overdue by 5d Nov 19 |
| 317 | chip | P3 |
| 318 | button | Select ticket 5028 |
| 319 | button | P3 Quarterly property review: 5253 Tracey Jo Rd #5023 5253 Tracey Jo Rd, Greenwood, Indiana 46142 Indy Quarterly inspection review James Almario Leadership Open Start work Overdue by 5d Nov 19 |
| 320 | chip | P3 |
| 321 | button | Select ticket 5023 |
| 322 | button | P3 Landscaping #5049 11508 E 94th Pl N, Owasso, Oklahoma 74055 Tulsa Other Unassigned Open Reply now Overdue by 4d Nov 20 |
| 323 | chip | P3 |
| 324 | button | Select ticket 5049 |
| 325 | button | P3 Touch up paint #5065 10121 E 131st Pl S, Bixby, Oklahoma 74008 Tulsa Other Unassigned Open Reply now Overdue by 3d Nov 21 |
| 326 | chip | P3 |
| 327 | button | Select ticket 5065 |
| 328 | button | P3 Landscaping #5066 10121 E 131st Pl S, Bixby, Oklahoma 74008 Tulsa Other Unassigned Open Reply now Overdue by 3d Nov 21 |
| 329 | chip | P3 |
| 330 | button | Select ticket 5066 |
| 331 | button | P3 Light fixtures require replacing #5076 4718 E Shadowbrook Dr, Camby, Indiana 46113 Indy Other Unassigned Open Reply now Overdue by 2d Nov 22 |
| 332 | chip | P3 |
| 333 | button | Select ticket 5076 |
| 334 | button | P3 Broken kitchen chair #5078 817 Halley Dr., Moore, Oklahoma 73160 OKC Other Unassigned Open Reply now Overdue by 2d Nov 22 |
| 335 | chip | P3 |
| 336 | button | Select ticket 5078 |
| 337 | button | P3 Dog poop #5079 1152 Western Yarrow Ave, Justin, Texas 76247 Fort Worth Other Unassigned Open Reply now Overdue by 2d Nov 22 |
| 338 | chip | P3 |
| 339 | button | Select ticket 5079 |
| 340 | button | P3 Package #5080 4003 Bendale Rd, Benbrook, Texas 76116 Fort Worth Other Unassigned Open Reply now Overdue by 2d Nov 22 |
| 341 | chip | P3 |
| 342 | button | Select ticket 5080 |
| 343 | button | P3 Broken towel rack #5081 628 Joy Ct, Burleson, Texas 76028 Fort Worth Other Unassigned Open Reply now Overdue by 2d Nov 22 |
| 344 | chip | P3 |
| 345 | button | Select ticket 5081 |
| 346 | button | P3 Reservation #107555754 #5095 2522 S. Irvington Ave, Tulsa, Oklahoma 74114 Tulsa Other Unassigned Open Reply now Overdue by 35h Nov 23 |
| 347 | chip | P3 |
| 348 | button | Select ticket 5095 |
| 349 | button | P3 Damage to kitchen table top #5096 3333 Welling Rd, Edmond, Oklahoma 73012 OKC Other Unassigned Open Reply now Overdue by 34h Nov 23 |
| 350 | chip | P3 |
| 351 | button | Select ticket 5096 |
| 352 | button | P3 Needs a smoke alarm #5097 9120 Yassir Blvd, Yukon, Oklahoma 73099 OKC Other Unassigned Open Reply now Overdue by 34h Nov 23 |
| 353 | chip | P3 |
| 354 | button | Select ticket 5097 |
| 355 | button | P3 Smoke alarm #5098 9120 Yassir Blvd, Yukon, Oklahoma 73099 OKC Other Unassigned Open Reply now Overdue by 34h Nov 23 |
| 356 | chip | P3 |
| 357 | button | Select ticket 5098 |
| 358 | button | P3 3 broken coasters #5101 3333 Welling Rd, Edmond, Oklahoma 73012 OKC Other Unassigned Open Reply now Overdue by 30h Nov 23 |
| 359 | chip | P3 |
| 360 | button | Select ticket 5101 |
| 361 | button | P3 Quarterly property review: 19104 Meadows Crossing Dr. #4891 19104 Meadows Crossing Dr., Edmond, Oklahoma 73012 OKC Quarterly inspection review Micah Sinor In progress Nov 23 Overdue by 1 day Nov 16 |
| 362 | chip | P3 |
| 363 | button | Select ticket 4891 |
| 364 | button | P3 Reservation #107883011 #5124 33 Center Ln S, Carlton Landing, Oklahoma 74332 Carlton Landing Other Unassigned Open Reply now Overdue by 14h Today 7:20 AM |
| 365 | chip | P3 |
| 366 | button | Select ticket 5124 |
| 367 | button | P3 Couch has small tear #5125 2004 Cedar Ridge Rd, Edmond, Oklahoma 73013 OKC Other Unassigned Open Reply now Overdue by 11h Today 10:17 AM |
| 368 | chip | P3 |
| 369 | button | Select ticket 5125 |
| 370 | button | P3 Broken chair #5126 207 High Point Way, Justin, Texas 76247 Fort Worth Other Unassigned Open Reply now Overdue by 10h Today 10:28 AM |
| 371 | chip | P3 |
| 372 | button | Select ticket 5126 |
| 373 | button | P3 Linens ruined. #5127 207 High Point Way, Justin, Texas 76247 Fort Worth Other Unassigned Open Reply now Overdue by 10h Today 10:31 AM |
| 374 | chip | P3 |
| 375 | button | Select ticket 5127 |
| 376 | button | P3 Excessive trash. #5128 207 High Point Way, Justin, Texas 76247 Fort Worth Other Unassigned Open Reply now Overdue by 10h Today 10:32 AM |
| 377 | chip | P3 |
| 378 | button | Select ticket 5128 |
| 379 | button | P3 Broken lamp #5129 2004 Cedar Ridge Rd, Edmond, Oklahoma 73013 OKC Other Unassigned Open Reply now Overdue by 10h Today 11:03 AM |
| 380 | chip | P3 |
| 381 | button | Select ticket 5129 |
| 382 | button | P3 downstairs bathroom #5130 7422 S. Granite Ave, Tulsa, Oklahoma 74136 Tulsa Other Unassigned Open Reply now Overdue by 9h Today 12:02 PM |
| 383 | chip | P3 |
| 384 | button | Select ticket 5130 |
| 385 | button | P3 Trash outside by front door #5131 3201 Belmont Circle, Edmond, Oklahoma 73034 OKC Other Unassigned Open Reply now Overdue by 5h Today 3:54 PM |
| 386 | chip | P3 |
| 387 | button | Select ticket 5131 |
| 388 | button | Kanban |
| 389 | button | Calendar |
| 390 | heading | Pick up work |
| 391 | button, filter | Team A 0 |
| 392 | button, filter | Team B 40 |
| 393 | button, filter | All teams 40 |
| 394 | button, filter | All unclaimed 40 |
| 395 | heading | From Breezeway |
| 396 | chip | Breezeway |
| 397 | chip | P3 |
| 398 | button | Open in Breezeway |
| 399 | button | Take it |
| 400 | chip | Breezeway |
| 401 | chip | P3 |
| 402 | button | Open in Breezeway |
| 403 | button | Take it |
| 404 | chip | Breezeway |
| 405 | chip | P3 |
| 406 | button | Open in Breezeway |
| 407 | button | Take it |
| 408 | chip | Breezeway |
| 409 | chip | P3 |
| 410 | button | Open in Breezeway |
| 411 | button | Take it |
| 412 | chip | Breezeway |
| 413 | chip | P3 |
| 414 | button | Open in Breezeway |
| 415 | button | Take it |
| 416 | chip | Breezeway |
| 417 | chip | P3 |
| 418 | button | Open in Breezeway |
| 419 | button | Take it |
| 420 | chip | Breezeway |
| 421 | chip | P3 |
| 422 | button | Open in Breezeway |
| 423 | button | Take it |
| 424 | chip | Breezeway |
| 425 | chip | P3 |
| 426 | button | Open in Breezeway |
| 427 | button | Take it |
| 428 | chip | Breezeway |
| 429 | chip | P3 |
| 430 | button | Open in Breezeway |
| 431 | button | Take it |
| 432 | chip | Breezeway |
| 433 | chip | P3 |
| 434 | button | Open in Breezeway |
| 435 | button | Take it |
| 436 | chip | Breezeway |
| 437 | chip | P3 |
| 438 | button | Open in Breezeway |
| 439 | button | Take it |
| 440 | chip | Breezeway |
| 441 | chip | P3 |
| 442 | button | Open in Breezeway |
| 443 | button | Take it |
| 444 | chip | Breezeway |
| 445 | chip | P3 |
| 446 | button | Open in Breezeway |
| 447 | button | Take it |
| 448 | chip | Breezeway |
| 449 | chip | P3 |
| 450 | button | Open in Breezeway |
| 451 | button | Take it |
| 452 | chip | Breezeway |
| 453 | chip | P3 |
| 454 | button | Open in Breezeway |
| 455 | button | Take it |
| 456 | chip | Breezeway |
| 457 | chip | P3 |
| 458 | button | Open in Breezeway |
| 459 | button | Take it |
| 460 | chip | Breezeway |
| 461 | chip | P3 |
| 462 | button | Open in Breezeway |
| 463 | button | Take it |
| 464 | chip | Breezeway |
| 465 | chip | P3 |
| 466 | button | Open in Breezeway |
| 467 | button | Take it |
| 468 | chip | Breezeway |
| 469 | chip | P3 |
| 470 | button | Open in Breezeway |
| 471 | button | Take it |
| 472 | chip | Breezeway |
| 473 | chip | P3 |
| 474 | button | Open in Breezeway |
| 475 | button | Take it |
| 476 | chip | Breezeway |
| 477 | chip | P3 |
| 478 | button | Open in Breezeway |
| 479 | button | Take it |
| 480 | chip | Breezeway |
| 481 | chip | P3 |
| 482 | button | Open in Breezeway |
| 483 | button | Take it |
| 484 | chip | Breezeway |
| 485 | chip | P3 |
| 486 | button | Open in Breezeway |
| 487 | button | Take it |
| 488 | chip | Breezeway |
| 489 | chip | P3 |
| 490 | button | Open in Breezeway |
| 491 | button | Take it |
| 492 | chip | Breezeway |
| 493 | chip | P3 |
| 494 | button | Open in Breezeway |
| 495 | button | Take it |
| 496 | chip | Breezeway |
| 497 | chip | P3 |
| 498 | button | Open in Breezeway |
| 499 | button | Take it |
| 500 | chip | Breezeway |
| 501 | chip | P3 |
| 502 | button | Open in Breezeway |
| 503 | button | Take it |
| 504 | chip | Breezeway |
| 505 | chip | P3 |
| 506 | button | Open in Breezeway |
| 507 | button | Take it |
| 508 | chip | Breezeway |
| 509 | chip | P3 |
| 510 | button | Open in Breezeway |
| 511 | button | Take it |
| 512 | chip | Breezeway |
| 513 | chip | P3 |
| 514 | button | Open in Breezeway |
| 515 | button | Take it |
| 516 | chip | Breezeway |
| 517 | chip | P3 |
| 518 | button | Open in Breezeway |
| 519 | button | Take it |
| 520 | chip | Breezeway |
| 521 | chip | P3 |
| 522 | button | Open in Breezeway |
| 523 | button | Take it |
| 524 | chip | Breezeway |
| 525 | chip | P3 |
| 526 | button | Open in Breezeway |
| 527 | button | Take it |
| 528 | chip | Breezeway |
| 529 | chip | P3 |
| 530 | button | Open in Breezeway |
| 531 | button | Take it |
| 532 | chip | Breezeway |
| 533 | chip | P3 |
| 534 | button | Open in Breezeway |
| 535 | button | Take it |
| 536 | chip | Breezeway |
| 537 | chip | P3 |
| 538 | button | Open in Breezeway |
| 539 | button | Take it |
| 540 | chip | Breezeway |
| 541 | chip | P3 |
| 542 | button | Open in Breezeway |
| 543 | button | Take it |
| 544 | chip | Breezeway |
| 545 | chip | P3 |
| 546 | button | Open in Breezeway |
| 547 | button | Take it |
| 548 | chip | Breezeway |
| 549 | chip | P3 |
| 550 | button | Open in Breezeway |
| 551 | button | Take it |
| 552 | chip | Breezeway |
| 553 | chip | P3 |
| 554 | button | Open in Breezeway |
| 555 | button | Take it |
| 556 | heading | Imported from Notion |
| 557 | button | Show |

**Appears more than once:** chip: P2 × 24; chip: P3 × 135; chip: Breezeway × 40; button: Open in Breezeway × 40; button: Take it × 40.

### phone-open-ticket-panel.png

Screen: Open ticket panel. Viewer: Emily. PNG: 390 × 1835.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Open full page |
| 2 | button | Close Ticket |
| 3 | heading | Ticket |
| 4 | heading | The Door in the bedroom fell down. The carpet is dirty |
| 5 | button | More |
| 6 | button | Due date Nov 16. Change the due date |
| 7 | button | Close ticket |
| 8 | button | Reopen ticket (disabled) |
| 9 | chip | Logged |
| 10 | chip | Fix it |
| 11 | chip | Done |
| 12 | heading | Do this now |
| 13 | button | Change next step |
| 14 | heading | CLEANING COMPLAINT · STEP 2 |
| 15 | heading | Get photos or video from the guest. |
| 16 | button | Attached |
| 17 | button | Guest won't send |
| 18 | button | Choose an answer. (disabled) |
| 19 | button | This doesn't apply |
| 20 | button | Edit step 1 |
| 21 | button | Show vendor and work order tools |
| 22 | button | Waiting on someone? |
| 23 | card | Make it right |
| 24 | button | lucide-chevron-down |
| 25 | heading | Make it right |
| 26 | button | Yes |
| 27 | button | No |
| 28 | button | Yes, open a claim |
| 29 | heading | DETAILS |
| 30 | filter | Add an update: who you called, what the vendor found, what the guest said… |
| 31 | button | lucide-building-2 |
| 32 | button | lucide-send |
| 33 | button | lucide-send |
| 34 | heading | Unnamed heading |
| 35 | button | lucide-external-link |
| 36 | button | View 8fa496d3-4613-4ddb-8cba-da8602df77bd.jpeg |
| 37 | button | Download 8fa496d3-4613-4ddb-8cba-da8602df77bd.jpeg |
| 38 | button | Remove 8fa496d3-4613-4ddb-8cba-da8602df77bd.jpeg |
| 39 | button, filter | Issue is tied to |
| 40 | button, filter | Active-stay impact |
| 41 | button, filter | Guest communication required |
| 42 | button | lucide-external-link |
| 43 | button | lucide-external-link |

**Appears more than once:** button: lucide-send × 2; button: lucide-external-link × 3.

### phone-team-queue-team-b-maintenance.png

Screen: Team Queue Team B Maintenance. Viewer: Emily. PNG: 390 × 15680.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Search Resolve |
| 2 | button | Record work |
| 3 | button | Record routine work |
| 4 | button | Toggle Sidebar |
| 5 | button | Take the tour |
| 6 | button | Alerts and escalations |
| 7 | button | Chats, 1 unread |
| 8 | button | Notifications |
| 9 | button | Switch to dark mode |
| 10 | chip | 1 |
| 11 | button | lucide-layout-grid |
| 12 | button | Sign out (Admin) |
| 13 | heading | Team Queue |
| 14 | filter | Search by title or home |
| 15 | button | Filter 1 |
| 16 | button | Clear 1 filter |
| 17 | button, tab | All team 117 |
| 18 | button, tab | Team A 3 |
| 19 | button, tab | Team B 140 |
| 20 | button, tab | Only mine 1 |
| 21 | chip | 117 |
| 22 | chip | 3 |
| 23 | chip | 140 |
| 24 | button, filter | Priority |
| 25 | button, filter | Status |
| 26 | button, filter | Person |
| 27 | button, tab | Maintenance 73 |
| 28 | button, tab | Reported issues 13 |
| 29 | button, tab | Cleaning reviews 0 |
| 30 | chip | 73 |
| 31 | chip | 13 |
| 32 | button, filter | Due today 73 |
| 33 | button, filter | This week 91 |
| 34 | button, filter | Next week 0 |
| 35 | button, filter | Closed 14 |
| 36 | table | Table |
| 37 | button | New House Setup - Stage Decor |
| 38 | button | Help & Feedback |
| 39 | button | Stock Supply Box |
| 40 | button | Change Smoke Detector Batteries |
| 41 | button | New House Setup - Press Curtains |
| 42 | button | Island is missing a piece of wood and it needs paint touch up |
| 43 | button | Install Air Filters |
| 44 | button | New House Setup - Setting Up ROKU TVs & Storing Remotes |
| 45 | button | Spare Front Door Key |
| 46 | button | Carpet Cleaning + Curtain Replacement |
| 47 | button | Hall bath tub - stopper |
| 48 | button | Fireplace not working + clogged toilet |
| 49 | button | Onsite Inspection & Quote Collection – 401 E. 10th St. |
| 50 | button | Haulaway Bins |
| 51 | button | Repair Loose Front Door Handle & Toilet Paper Holder – 9211 |
| 52 | button | Repair Broken Dining Chair – 817 Halley Dr. |
| 53 | button | Amazon Return: Ironing Board |
| 54 | button | carpet cleaning |
| 55 | button | Inspect and Repair AC Unit – 2617 W Madison St |
| 56 | button | New House Setup - Prep Property / Meet Photographer |
| 57 | button | Delivering the TV remote |
| 58 | button | Front Door Lock - Low Battery |
| 59 | button | Trash Removal and Disposal – 3333 Welling Rd |
| 60 | button | Remove and Dispose of Excess Trash – 19013 Meadows Crossing |
| 61 | button | Bathroom Vanity Lights Flickering – Inspection and Repair |
| 62 | button | Front Door Lock - Low Battery |
| 63 | button | Carpet stain |
| 64 | button | Carpet/ rug shampooing. |
| 65 | button | Back patio/furniture |
| 66 | button | Driveway stains. |
| 67 | button | trash haulaway |
| 68 | button | Front Door Lock - Low Battery |
| 69 | button | Purchase and Install Garage Door Opener – 9120 Yassir |
| 70 | button | Check Low Water Pressure in Bathroom – 3000 |
| 71 | button | Trash Removal Before Guest Check-In |
| 72 | button | Dead Animal Removal – 10320 |
| 73 | button | fix drywall hole |
| 74 | button | Recharge Ring Doorbell Camera |
| 75 | button | Front Door Lock - Low Battery |
| 76 | button | TEST - Work Order Instructions for Breezeway |
| 77 | button | Front Door Lock - Low Battery |
| 78 | button | Walmart Return Items |
| 79 | button | Bedroom Carpet Cleaning – Dog Urine Odor |
| 80 | button | Light fixtures require replacing |
| 81 | button | Haulaway |
| 82 | button | Front Door Lock - Low Battery |
| 83 | button | Front Door Lock - Low Battery |
| 84 | button | Front Door Lock - Low Battery |
| 85 | button | Kitchen Disposal Replacement |
| 86 | button | Reservation #64895038 |
| 87 | button | Shower Curtain Replacement |
| 88 | button | Haulaway Bins |
| 89 | button | Haul the trash + Broken Bed Board |
| 90 | button | loose toilet |
| 91 | button | The Master Bather Shower is Faulty |
| 92 | button | Inspect and Repair Master Bathroom Shower Head |
| 93 | button | Front Door Lock - Low Battery |
| 94 | button | Garage Door is Broken. |
| 95 | table | Open tickets |
| 96 | button | P2, hide rows |
| 97 | chip | P2 |
| 98 | button | Guest review: Reported issue: Shower head is not working properly. Needs fixing. Manual 2016 NW 172ND, Edmond, Oklahoma 73012 OKC P2 Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 7d Nov 17 |
| 99 | button | Add an update to ticket 4976 |
| 100 | button | The washer at 7422 has a reported broken timer and may require repair or replacement. Please review the previous updates, confirm the washer Manual 7422 S. Granite Ave, Tulsa, Oklahoma 74136 Tulsa P2 Immediate maintenance Qym Fuenteblanca Team B Open Start work Overdue by 7d Nov 17 |
| 101 | button | Add an update to ticket 4978 |
| 102 | button | The garage door is broken. It came off the track Manual 5020 S 168th East Ave, Tulsa, Oklahoma 74134 Tulsa P2 Maintenance and landscaping work-order review Qym Fuenteblanca Team B In progress Nov 17 Overdue by 7 days Nov 17 |
| 103 | button | Add an update to ticket 4974 |
| 104 | button | 2014 - get carpet quote to replace Manual 2014 E 52nd St, Tulsa, Oklahoma 74105 Tulsa P2 Other Romeo Canales Team B Waiting on owner Nov 20 · 8:00 AM Overdue by 5d Nov 3 |
| 105 | button | Add an update to ticket 1509 |
| 106 | button | to reach out to owner on considering to replace the carpet Manual 3712 N 39th St., Broken Arrow, Oklahoma 74014 Tulsa P2 Ongoing maintenance Romeo Canales Team B Open Start work Overdue by 4d Nov 20 |
| 107 | button | Add an update to ticket 5048 |
| 108 | button | 16401 - dryer not working Manual 16401 Villa Valeria Way, Edmond, Oklahoma 73013 OKC P2 Other Romeo Canales Team B Open Reply now Overdue by 4d Oct 27 |
| 109 | button | Add an update to ticket 1476 |
| 110 | button | 5923 - yale lock disconnected Manual 5923 Hollyhock Ln, Montgomery, Texas 77316 Houston P2 Other Romeo Canales Team B Waiting on vendor Nov 23 · 8:00 AM Overdue by 39h Oct 29 |
| 111 | button | Add an update to ticket 1487 |
| 112 | button | one of dining chairs was broken Manual 4607 W Union St, Broken Arrow, Oklahoma 74011 Tulsa P2 Immediate maintenance Qym Fuenteblanca Team B Open Start work Overdue by 29h Nov 23 |
| 113 | button | Add an update to ticket 5104 |
| 114 | button | 7006 project. This home is missing quite a few standard items that we need ordered and then a few things need replaced. Manual 7006 E 154th St S, Bixby, Oklahoma 74008 Tulsa P2 Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 29h Nov 23 |
| 115 | button | Add an update to ticket 5102 |
| 116 | button | bathroom mirror broken Manual 18200 Bodegon Rd., Edmond, Oklahoma 73012 OKC P2 Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 29h Nov 23 |
| 117 | button | Add an update to ticket 5103 |
| 118 | button | small tear/rip in couch Manual 2004 Cedar Ridge Rd, Edmond, Oklahoma 73013 OKC P2 Ongoing maintenance Romeo Canales Team B Open Start work Overdue by 6h Today 4:43 PM |
| 119 | button | Add an update to ticket 5132 |
| 120 | button | broken coasters Manual 3333 Welling Rd, Edmond, Oklahoma 73012 OKC P2 Ongoing maintenance Romeo Canales Team B Open Start work Overdue by 6h Today 4:46 PM |
| 121 | button | Add an update to ticket 5133 |
| 122 | button | towel rack repair Manual 628 Joy Ct, Burleson, Texas 76028 Fort Worth P2 Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:04 PM |
| 123 | button | Add an update to ticket 5134 |
| 124 | button | repair dining chair Manual 817 Halley Dr., Moore, Oklahoma 73160 OKC P2 Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:06 PM |
| 125 | button | Add an update to ticket 5135 |
| 126 | button | backyard needs mowed Manual 1169 Blue Sky Lane, Burleson, Texas 76028 Fort Worth P2 Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:23 PM |
| 127 | button | Add an update to ticket 5136 |
| 128 | button | toilet paper holder Manual 845 Alexandria Ln, Joshua, Texas 76058-6216 Fort Worth P2 Immediate maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:52 PM |
| 129 | button | Add an update to ticket 5137 |
| 130 | button | Kanban |
| 131 | button | Calendar |
| 132 | heading | Pick up work |
| 133 | button, filter | Team A 0 |
| 134 | button, filter | Team B 40 |
| 135 | button, filter | All teams 40 |
| 136 | button, filter | All unclaimed 40 |
| 137 | heading | From Breezeway |
| 138 | chip | Breezeway |
| 139 | chip | P3 |
| 140 | button | Open in Breezeway |
| 141 | button | Take it |
| 142 | chip | Breezeway |
| 143 | chip | P3 |
| 144 | button | Open in Breezeway |
| 145 | button | Take it |
| 146 | chip | Breezeway |
| 147 | chip | P3 |
| 148 | button | Open in Breezeway |
| 149 | button | Take it |
| 150 | chip | Breezeway |
| 151 | chip | P3 |
| 152 | button | Open in Breezeway |
| 153 | button | Take it |
| 154 | chip | Breezeway |
| 155 | chip | P3 |
| 156 | button | Open in Breezeway |
| 157 | button | Take it |
| 158 | chip | Breezeway |
| 159 | chip | P3 |
| 160 | button | Open in Breezeway |
| 161 | button | Take it |
| 162 | chip | Breezeway |
| 163 | chip | P3 |
| 164 | button | Open in Breezeway |
| 165 | button | Take it |
| 166 | chip | Breezeway |
| 167 | chip | P3 |
| 168 | button | Open in Breezeway |
| 169 | button | Take it |
| 170 | chip | Breezeway |
| 171 | chip | P3 |
| 172 | button | Open in Breezeway |
| 173 | button | Take it |
| 174 | chip | Breezeway |
| 175 | chip | P3 |
| 176 | button | Open in Breezeway |
| 177 | button | Take it |
| 178 | chip | Breezeway |
| 179 | chip | P3 |
| 180 | button | Open in Breezeway |
| 181 | button | Take it |
| 182 | chip | Breezeway |
| 183 | chip | P3 |
| 184 | button | Open in Breezeway |
| 185 | button | Take it |
| 186 | chip | Breezeway |
| 187 | chip | P3 |
| 188 | button | Open in Breezeway |
| 189 | button | Take it |
| 190 | chip | Breezeway |
| 191 | chip | P3 |
| 192 | button | Open in Breezeway |
| 193 | button | Take it |
| 194 | chip | Breezeway |
| 195 | chip | P3 |
| 196 | button | Open in Breezeway |
| 197 | button | Take it |
| 198 | chip | Breezeway |
| 199 | chip | P3 |
| 200 | button | Open in Breezeway |
| 201 | button | Take it |
| 202 | chip | Breezeway |
| 203 | chip | P3 |
| 204 | button | Open in Breezeway |
| 205 | button | Take it |
| 206 | chip | Breezeway |
| 207 | chip | P3 |
| 208 | button | Open in Breezeway |
| 209 | button | Take it |
| 210 | chip | Breezeway |
| 211 | chip | P3 |
| 212 | button | Open in Breezeway |
| 213 | button | Take it |
| 214 | chip | Breezeway |
| 215 | chip | P3 |
| 216 | button | Open in Breezeway |
| 217 | button | Take it |
| 218 | chip | Breezeway |
| 219 | chip | P3 |
| 220 | button | Open in Breezeway |
| 221 | button | Take it |
| 222 | chip | Breezeway |
| 223 | chip | P3 |
| 224 | button | Open in Breezeway |
| 225 | button | Take it |
| 226 | chip | Breezeway |
| 227 | chip | P3 |
| 228 | button | Open in Breezeway |
| 229 | button | Take it |
| 230 | chip | Breezeway |
| 231 | chip | P3 |
| 232 | button | Open in Breezeway |
| 233 | button | Take it |
| 234 | chip | Breezeway |
| 235 | chip | P3 |
| 236 | button | Open in Breezeway |
| 237 | button | Take it |
| 238 | chip | Breezeway |
| 239 | chip | P3 |
| 240 | button | Open in Breezeway |
| 241 | button | Take it |
| 242 | chip | Breezeway |
| 243 | chip | P3 |
| 244 | button | Open in Breezeway |
| 245 | button | Take it |
| 246 | chip | Breezeway |
| 247 | chip | P3 |
| 248 | button | Open in Breezeway |
| 249 | button | Take it |
| 250 | chip | Breezeway |
| 251 | chip | P3 |
| 252 | button | Open in Breezeway |
| 253 | button | Take it |
| 254 | chip | Breezeway |
| 255 | chip | P3 |
| 256 | button | Open in Breezeway |
| 257 | button | Take it |
| 258 | chip | Breezeway |
| 259 | chip | P3 |
| 260 | button | Open in Breezeway |
| 261 | button | Take it |
| 262 | chip | Breezeway |
| 263 | chip | P3 |
| 264 | button | Open in Breezeway |
| 265 | button | Take it |
| 266 | chip | Breezeway |
| 267 | chip | P3 |
| 268 | button | Open in Breezeway |
| 269 | button | Take it |
| 270 | chip | Breezeway |
| 271 | chip | P3 |
| 272 | button | Open in Breezeway |
| 273 | button | Take it |
| 274 | chip | Breezeway |
| 275 | chip | P3 |
| 276 | button | Open in Breezeway |
| 277 | button | Take it |
| 278 | chip | Breezeway |
| 279 | chip | P3 |
| 280 | button | Open in Breezeway |
| 281 | button | Take it |
| 282 | chip | Breezeway |
| 283 | chip | P3 |
| 284 | button | Open in Breezeway |
| 285 | button | Take it |
| 286 | chip | Breezeway |
| 287 | chip | P3 |
| 288 | button | Open in Breezeway |
| 289 | button | Take it |
| 290 | chip | Breezeway |
| 291 | chip | P3 |
| 292 | button | Open in Breezeway |
| 293 | button | Take it |
| 294 | chip | Breezeway |
| 295 | chip | P3 |
| 296 | button | Open in Breezeway |
| 297 | button | Take it |
| 298 | heading | Imported from Notion |
| 299 | button | Show |

**Appears more than once:** button: Haulaway Bins × 2; button: Front Door Lock - Low Battery × 9; chip: Breezeway × 40; chip: P3 × 40; button: Open in Breezeway × 40; button: Take it × 40.

### phone-team-queue-team-b-reported-issues.png

Screen: Team Queue Team B Reported issues. Viewer: Emily. PNG: 390 × 10584.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Search Resolve |
| 2 | button | Record work |
| 3 | button | Record routine work |
| 4 | button | Toggle Sidebar |
| 5 | button | Take the tour |
| 6 | button | Alerts and escalations |
| 7 | button | Chats, 1 unread |
| 8 | button | Notifications |
| 9 | button | Switch to dark mode |
| 10 | chip | 1 |
| 11 | button | lucide-layout-grid |
| 12 | button | Sign out (Admin) |
| 13 | heading | Team Queue |
| 14 | filter | Search by title or home |
| 15 | button | Filter 1 |
| 16 | button | Clear 1 filter |
| 17 | button, tab | All team 117 |
| 18 | button, tab | Team A 3 |
| 19 | button, tab | Team B 140 |
| 20 | button, tab | Only mine 1 |
| 21 | chip | 117 |
| 22 | chip | 3 |
| 23 | chip | 140 |
| 24 | button, filter | Priority |
| 25 | button, filter | Status |
| 26 | button, filter | Person |
| 27 | button, tab | Maintenance 73 |
| 28 | button, tab | Reported issues 13 |
| 29 | button, tab | Cleaning reviews 0 |
| 30 | chip | 73 |
| 31 | chip | 13 |
| 32 | button, filter | Due today 13 |
| 33 | button, filter | This week 27 |
| 34 | button, filter | Next week 13 |
| 35 | button, filter | Closed 0 |
| 36 | table | Open tickets |
| 37 | button | P3, hide rows |
| 38 | chip | P3 |
| 39 | button | Help & Feedback |
| 40 | button | FROM PREVIOUS TURNS- NOT ADDRESSED Breezeway reported issue 845 Alexandria Ln, Joshua, Texas 76058-6216 Fort Worth P3 Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 41 | button | Add an update to ticket 4931 |
| 42 | button | 2 reported issues Breezeway reported issue Show issues 3000 W Charlotte St, Broken Arrow, Oklahoma 74011 Tulsa P3 Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 43 | button | Add an update to ticket 4933 |
| 44 | button | Show issues |
| 45 | button | Broken kitchen table chair Breezeway reported issue 817 Halley Dr., Moore, Oklahoma 73160 OKC P3 Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 46 | button | Add an update to ticket 4934 |
| 47 | button | Broken lamp Breezeway reported issue 14553 Serrano Ridge Dr, Ft. Worth, Texas 76052 Fort Worth P3 Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 48 | button | Add an update to ticket 4939 |
| 49 | button | Trash Breezeway reported issue 4003 Bendale Rd, Benbrook, Texas 76116 Fort Worth P3 Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 50 | button | Add an update to ticket 4940 |
| 51 | button | 6 reported issues Breezeway reported issue Show issues 136 Magnolia Estates St., Crowley, Texas 76036 Fort Worth P3 Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 52 | button | Add an update to ticket 4966 |
| 53 | button | Show issues |
| 54 | button | Guest bathroom Breezeway reported issue 904 NE 34th Ter, Moore, Oklahoma 73160 OKC P3 Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 55 | button | Add an update to ticket 4975 |
| 56 | button | Kanban |
| 57 | button | Calendar |
| 58 | heading | Pick up work |
| 59 | button, filter | Team A 0 |
| 60 | button, filter | Team B 40 |
| 61 | button, filter | All teams 40 |
| 62 | button, filter | All unclaimed 40 |
| 63 | heading | From Breezeway |
| 64 | chip | Breezeway |
| 65 | chip | P3 |
| 66 | button | Open in Breezeway |
| 67 | button | Take it |
| 68 | chip | Breezeway |
| 69 | chip | P3 |
| 70 | button | Open in Breezeway |
| 71 | button | Take it |
| 72 | chip | Breezeway |
| 73 | chip | P3 |
| 74 | button | Open in Breezeway |
| 75 | button | Take it |
| 76 | chip | Breezeway |
| 77 | chip | P3 |
| 78 | button | Open in Breezeway |
| 79 | button | Take it |
| 80 | chip | Breezeway |
| 81 | chip | P3 |
| 82 | button | Open in Breezeway |
| 83 | button | Take it |
| 84 | chip | Breezeway |
| 85 | chip | P3 |
| 86 | button | Open in Breezeway |
| 87 | button | Take it |
| 88 | chip | Breezeway |
| 89 | chip | P3 |
| 90 | button | Open in Breezeway |
| 91 | button | Take it |
| 92 | chip | Breezeway |
| 93 | chip | P3 |
| 94 | button | Open in Breezeway |
| 95 | button | Take it |
| 96 | chip | Breezeway |
| 97 | chip | P3 |
| 98 | button | Open in Breezeway |
| 99 | button | Take it |
| 100 | chip | Breezeway |
| 101 | chip | P3 |
| 102 | button | Open in Breezeway |
| 103 | button | Take it |
| 104 | chip | Breezeway |
| 105 | chip | P3 |
| 106 | button | Open in Breezeway |
| 107 | button | Take it |
| 108 | chip | Breezeway |
| 109 | chip | P3 |
| 110 | button | Open in Breezeway |
| 111 | button | Take it |
| 112 | chip | Breezeway |
| 113 | chip | P3 |
| 114 | button | Open in Breezeway |
| 115 | button | Take it |
| 116 | chip | Breezeway |
| 117 | chip | P3 |
| 118 | button | Open in Breezeway |
| 119 | button | Take it |
| 120 | chip | Breezeway |
| 121 | chip | P3 |
| 122 | button | Open in Breezeway |
| 123 | button | Take it |
| 124 | chip | Breezeway |
| 125 | chip | P3 |
| 126 | button | Open in Breezeway |
| 127 | button | Take it |
| 128 | chip | Breezeway |
| 129 | chip | P3 |
| 130 | button | Open in Breezeway |
| 131 | button | Take it |
| 132 | chip | Breezeway |
| 133 | chip | P3 |
| 134 | button | Open in Breezeway |
| 135 | button | Take it |
| 136 | chip | Breezeway |
| 137 | chip | P3 |
| 138 | button | Open in Breezeway |
| 139 | button | Take it |
| 140 | chip | Breezeway |
| 141 | chip | P3 |
| 142 | button | Open in Breezeway |
| 143 | button | Take it |
| 144 | chip | Breezeway |
| 145 | chip | P3 |
| 146 | button | Open in Breezeway |
| 147 | button | Take it |
| 148 | chip | Breezeway |
| 149 | chip | P3 |
| 150 | button | Open in Breezeway |
| 151 | button | Take it |
| 152 | chip | Breezeway |
| 153 | chip | P3 |
| 154 | button | Open in Breezeway |
| 155 | button | Take it |
| 156 | chip | Breezeway |
| 157 | chip | P3 |
| 158 | button | Open in Breezeway |
| 159 | button | Take it |
| 160 | chip | Breezeway |
| 161 | chip | P3 |
| 162 | button | Open in Breezeway |
| 163 | button | Take it |
| 164 | chip | Breezeway |
| 165 | chip | P3 |
| 166 | button | Open in Breezeway |
| 167 | button | Take it |
| 168 | chip | Breezeway |
| 169 | chip | P3 |
| 170 | button | Open in Breezeway |
| 171 | button | Take it |
| 172 | chip | Breezeway |
| 173 | chip | P3 |
| 174 | button | Open in Breezeway |
| 175 | button | Take it |
| 176 | chip | Breezeway |
| 177 | chip | P3 |
| 178 | button | Open in Breezeway |
| 179 | button | Take it |
| 180 | chip | Breezeway |
| 181 | chip | P3 |
| 182 | button | Open in Breezeway |
| 183 | button | Take it |
| 184 | chip | Breezeway |
| 185 | chip | P3 |
| 186 | button | Open in Breezeway |
| 187 | button | Take it |
| 188 | chip | Breezeway |
| 189 | chip | P3 |
| 190 | button | Open in Breezeway |
| 191 | button | Take it |
| 192 | chip | Breezeway |
| 193 | chip | P3 |
| 194 | button | Open in Breezeway |
| 195 | button | Take it |
| 196 | chip | Breezeway |
| 197 | chip | P3 |
| 198 | button | Open in Breezeway |
| 199 | button | Take it |
| 200 | chip | Breezeway |
| 201 | chip | P3 |
| 202 | button | Open in Breezeway |
| 203 | button | Take it |
| 204 | chip | Breezeway |
| 205 | chip | P3 |
| 206 | button | Open in Breezeway |
| 207 | button | Take it |
| 208 | chip | Breezeway |
| 209 | chip | P3 |
| 210 | button | Open in Breezeway |
| 211 | button | Take it |
| 212 | chip | Breezeway |
| 213 | chip | P3 |
| 214 | button | Open in Breezeway |
| 215 | button | Take it |
| 216 | chip | Breezeway |
| 217 | chip | P3 |
| 218 | button | Open in Breezeway |
| 219 | button | Take it |
| 220 | chip | Breezeway |
| 221 | chip | P3 |
| 222 | button | Open in Breezeway |
| 223 | button | Take it |
| 224 | heading | Imported from Notion |
| 225 | button | Show |

**Appears more than once:** chip: P3 × 41; button: Show issues × 2; chip: Breezeway × 40; button: Open in Breezeway × 40; button: Take it × 40.

### phone-new-ticket.png

Screen: New ticket. Viewer: Emily. PNG: 390 × 1210.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Close |
| 2 | heading | Record work |
| 3 | button | Ask the Coach |
| 4 | button, filter | Which home? |
| 5 | button, filter | Ticket type |
| 6 | button | Add photo |
| 7 | button, filter | Speak |
| 8 | filter | What did you do? |
| 9 | button | Send Breezeway work order now |
| 10 | button | Create ticket (disabled) |
| 11 | button | One touch: nothing more to do. Save to home history. (disabled) |

**Appears more than once:** No exact repeated label detected in the counted foreground surface..

### phone-routine-work.png

Screen: Routine Work. Viewer: Emily. PNG: 390 × 21231.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Search Resolve |
| 2 | button | Record work |
| 3 | button | Record routine work |
| 4 | button | Toggle Sidebar |
| 5 | button | Take the tour |
| 6 | button | Alerts and escalations |
| 7 | button | Chats, 1 unread |
| 8 | button | Notifications |
| 9 | button | Switch to dark mode |
| 10 | chip | 1 |
| 11 | button | lucide-layout-grid |
| 12 | button | Sign out (Admin) |
| 13 | heading | 105 routine checks are late |
| 14 | button | Record routine work |
| 15 | button | My team |
| 16 | button | Everything |
| 17 | card | Arrival checks · 90 |
| 18 | heading | Arrival checks · 90 |
| 19 | table | arrival-checks |
| 20 | button | Help & Feedback |
| 21 | card | Late · 105 |
| 22 | heading | Late · 105 |
| 23 | button | 1P New House Setup - Stage Decor Maintenance Review · 11249 Pegasus Dr Due now |
| 24 | button | 3P Lawn Care Maintenance Review · 3012 Piper St Due now |
| 25 | button | 1B Lawn Care Maintenance Review · 1068 Berrywood Dr Due now |
| 26 | button | 9F Lawn Care Maintenance Review · 9211 Fitzgerald Dr Due now |
| 27 | button | 8E Stock Supply Box Maintenance Review · 8602 E. Galveston St. Due now |
| 28 | button | 8E Change Smoke Detector Batteries Maintenance Review · 8602 E. Galveston St. Due now |
| 29 | button | 8E New House Setup - Press Curtains Maintenance Review · 8602 E. Galveston St. Due now |
| 30 | button | 1N Island is missing a piece of wood and it needs paint touch up Maintenance Review · 1636 NE 32nd St Due now |
| 31 | button | 8E Install Air Filters Maintenance Review · 8602 E. Galveston St. Due now |
| 32 | button | 8E New House Setup - Setting Up ROKU TVs & Storing Remotes Maintenance Review · 8602 E. Galveston St. Due now |
| 33 | button | 8E Spare Front Door Key Maintenance Review · 8602 E. Galveston St. Due now |
| 34 | button | 1E Carpet Cleaning + Curtain Replacement Maintenance Review · 1908 E Urbana St Due now |
| 35 | button | 8E Hall bath tub - stopper Maintenance Review · 815 E Fulton St Due now |
| 36 | button | 1N Fireplace not working + clogged toilet Maintenance Review · 1016 NW 191st St Due now |
| 37 | button | 4E Onsite Inspection & Quote Collection – 401 E. 10th St. Maintenance Review · 401 E 10th St Due now |
| 38 | button | 3W Haulaway Bins Maintenance Review · 3915 W 104th St S Due now |
| 39 | button | 9F Repair Loose Front Door Handle & Toilet Paper Holder – 9211 Maintenance Review · 9211 Fitzgerald Dr Due now |
| 40 | button | 8H Repair Broken Dining Chair – 817 Halley Dr. Maintenance Review · 817 Halley Dr. Due now |
| 41 | button | 4E Amazon Return: Ironing Board Maintenance Review · 401 E 10th St Due now |
| 42 | button | 3B carpet cleaning Maintenance Review · 3201 Belmont Circle Due now |
| 43 | button | 5T Lawn Care Maintenance Review · 5253 Tracey Jo Rd Due now |
| 44 | button | 1S Lawn Care Maintenance Review · 11109 SW 34th Ter Due now |
| 45 | button | 3U Lawn Care Maintenance Review · 3613 Upland Ridge Dr. Due now |
| 46 | button | 5T Lawn Care Maintenance Review · 5671 Teak Ln Due now |
| 47 | button | 3S Lawn Care Maintenance Review · 3117 Scissortail Way Due now |
| 48 | button | 2L Lawn Care Maintenance Review · 2100 Liberty Way Dr Due now |
| 49 | button | 2S Lawn Care Maintenance Review · 2259 Summer Shore Dr Due now |
| 50 | button | 2W Inspect and Repair AC Unit – 2617 W Madison St Maintenance Review · 2617 W Madison St. Due now |
| 51 | button | 2W Lawn Care Maintenance Review · 2017 W. Flintlock Way Due now |
| 52 | button | 2W Lawn Care Maintenance Review · 2012 W. Black Powder Way Due now |
| 53 | button | 7D Lawn Care Maintenance Review · 721 Dusty Trail Due now |
| 54 | button | 7A Lawn Care Maintenance Review · 724 Abilene Way Due now |
| 55 | button | 8E New House Setup - Prep Property / Meet Photographer Maintenance Review · 8602 E. Galveston St. Due now |
| 56 | button | 1S Lawn Care Maintenance Review · 11736 SW 15th Terr Due now |
| 57 | button | 3W Delivering the TV remote Maintenance Review · 3000 W Charlotte St Due now |
| 58 | button | 1B Front Door Lock - Low Battery Maintenance Review · 1169 Blue Sky Lane Due now |
| 59 | button | 3W Trash Removal and Disposal – 3333 Welling Rd Maintenance Review · 3333 Welling Rd Due now |
| 60 | button | 1M Remove and Dispose of Excess Trash – 19013 Meadows Crossing Maintenance Review · 19013 Meadows Crossing Dr. Due now |
| 61 | button | 9S Lawn Care Maintenance Review · 9008 Scarlet Blvd Due now |
| 62 | button | 9N Bathroom Vanity Lights Flickering – Inspection and Repair Maintenance Review · 904 NE 34th Ter Due now |
| 63 | button | 1L Lawn Care Maintenance Review · 10320 Lightning Creek Dr Due now |
| 64 | button | 5N Lawn Care Maintenance Review · 5217 NW 109th St Due now |
| 65 | button | 5H Lawn Care Maintenance Review · 5512 Hidden Trail lane Due now |
| 66 | button | 1E Front Door Lock - Low Battery Maintenance Review · 10121 E 131st Pl S Due now |
| 67 | button | 7R Lawn Care Maintenance Review · 7071 Richardson Ct Due now |
| 68 | button | 4N Lawn Care Maintenance Review · 4317 NW 19th St Due now |
| 69 | button | 1L Carpet stain Maintenance Review · 10320 Lightning Creek Dr Due now |
| 70 | button | 1M Carpet/ rug shampooing. Maintenance Review · 136 Magnolia Estates St. Due now |
| 71 | button | 1M Back patio/furniture Maintenance Review · 136 Magnolia Estates St. Due now |
| 72 | button | 1M Driveway stains. Maintenance Review · 136 Magnolia Estates St. Due now |
| 73 | button | 4B trash haulaway Maintenance Review · 4003 Bendale Rd Due now |
| 74 | button | 6T Lawn Care Maintenance Review · 64 Turtle Loop Due now |
| 75 | button | 6T Lawn Care Maintenance Review · 64 Turtle Loop Due now |
| 76 | button | 6T Lawn Care Maintenance Review · 64 Turtle Loop Due now |
| 77 | button | 6T Lawn Care Maintenance Review · 64 Turtle Loop Due now |
| 78 | button | 8E Lawn Care Maintenance Review · 8602 E. Galveston St. Due now |
| 79 | button | 6C Front Door Lock - Low Battery Maintenance Review · 6847 Cardiff Dr Due now |
| 80 | button | 4S Lawn Care Maintenance Review · 409 S 85th St Due now |
| 81 | button | 9Y Purchase and Install Garage Door Opener – 9120 Yassir Maintenance Review · 9120 Yassir Blvd Due now |
| 82 | button | 3W Check Low Water Pressure in Bathroom – 3000 Maintenance Review · 3000 W Charlotte St Due now |
| 83 | button | 1B Lawn Care Maintenance Review · 18000 Barracho Dr. Due now |
| 84 | button | 2N Lawn Care Maintenance Review · 2016 NW 172ND Due now |
| 85 | button | 1L Trash Removal Before Guest Check-In Maintenance Review · 10320 Lightning Creek Dr Due now |
| 86 | button | 1L Dead Animal Removal – 10320 Maintenance Review · 10320 Lightning Creek Dr Due now |
| 87 | button | 2B fix drywall hole Maintenance Review · 2701 Berkshire Way Due now |
| 88 | button | 3M Recharge Ring Doorbell Camera Maintenance Review · 31445 Moore Rd Due now |
| 89 | button | 3M Front Door Lock - Low Battery Maintenance Review · 31445 Moore Rd Due now |
| 90 | button | 4D TEST - Work Order Instructions for Breezeway Maintenance Review · 428 Drowsy Water Trl Due now |
| 91 | button | 3W Lawn Care Maintenance Review · 3915 W 104th St S Due now |
| 92 | button | 1W Lawn Care Maintenance Review · 1722 Westchester Dr Due now |
| 93 | button | 5S Lawn Care Maintenance Review · 504 S. 47th St. Due now |
| 94 | button | 1S Lawn Care Maintenance Review · 10302 S. 230th East Ave Due now |
| 95 | button | 2T Lawn Care Maintenance Review · 2208 Toledo St Due now |
| 96 | button | 1E Lawn Care Maintenance Review · 1908 E Urbana St Due now |
| 97 | button | 8E Lawn Care Maintenance Review · 815 E Fulton St Due now |
| 98 | button | 3W Lawn Care Maintenance Review · 3000 W Charlotte St Due now |
| 99 | button | 5S Front Door Lock - Low Battery Maintenance Review · 504 S. 47th St. Due now |
| 100 | button | 1S Walmart Return Items Maintenance Review · 10302 S. 230th East Ave Due now |
| 101 | button | 1L Bedroom Carpet Cleaning – Dog Urine Odor Maintenance Review · 10320 Lightning Creek Dr Due now |
| 102 | button | 4E Light fixtures require replacing Maintenance Review · 4718 E Shadowbrook Dr Due now |
| 103 | button | 1P Haulaway Maintenance Review · 11249 Pegasus Dr Due now |
| 104 | button | 1W Front Door Lock - Low Battery Maintenance Review · 1152 Western Yarrow Ave Due now |
| 105 | button | 2S Front Door Lock - Low Battery Maintenance Review · 2522 S. Irvington Ave Due now |
| 106 | button | 5H Front Door Lock - Low Battery Maintenance Review · 5923 Hollyhock Ln Due now |
| 107 | button | 3N Kitchen Disposal Replacement Maintenance Review · 3029 NW 181st Due now |
| 108 | button | 1S Lawn Care Maintenance Review · 10549 SE 23rd St Due now |
| 109 | button | 1S Lawn Care Maintenance Review · 10845 Sara Ct Due now |
| 110 | button | 1N Lawn Care Maintenance Review · 13117 NE 9th St Due now |
| 111 | button | 8S Lawn Care Maintenance Review · 8708 Scirocco Cir Due now |
| 112 | button | 1N Reservation #64895038 Maintenance Review · 1636 NE 32nd St Due now |
| 113 | button | 9N Lawn Care Maintenance Review · 904 NE 34th Ter Due now |
| 114 | button | 1N Lawn Care Maintenance Review · 1636 NE 32nd St Due now |
| 115 | button | 2N Lawn Care Maintenance Review · 2527 NE 15th St Due now |
| 116 | button | 2S Shower Curtain Replacement Maintenance Review · 2522 S. Irvington Ave Due now |
| 117 | button | 2H Lawn Care Maintenance Review · 2817 Hazel Hollow Due now |
| 118 | button | 3P Lawn Care Maintenance Review · 3012 Piper St Due now |
| 119 | button | 8H Lawn Care Maintenance Review · 817 Halley Dr. Due now |
| 120 | button | 2S Lawn Care Maintenance Review · 2608 SE 38th St Due now |
| 121 | button | 1E Haulaway Bins Maintenance Review · 10121 E 131st Pl S Due now |
| 122 | button | 8E Haul the trash + Broken Bed Board Maintenance Review · 815 E Fulton St Due now |
| 123 | button | 52 Lawn Care Maintenance Review · 525 23rd Ave NE Due now |
| 124 | button | 1S Lawn Care Maintenance Review · 105 Summit Bnd Due now |
| 125 | button | 2L Lawn Care Maintenance Review · 2008 Ladera Ln Due now |
| 126 | button | 3B Lawn Care Maintenance Review · 3200 Birmingham Dr. Due now |
| 127 | button | 2S Lawn Care Maintenance Review · 220 SW 167th St Due now |
| 128 | card | Due today · 40 |
| 129 | heading | Due today · 40 |
| 130 | button | 8L Lawn Care Maintenance Review · 816 Lakeview Dr Due Wed 12:18 AM |
| 131 | button | 1S loose toilet Maintenance Review · 10845 Sara Ct Due Wed 12:36 AM |
| 132 | button | 2N The Master Bather Shower is Faulty Maintenance Review · 2016 NW 172ND Due Wed 12:55 AM |
| 133 | button | 2N Inspect and Repair Master Bathroom Shower Head Maintenance Review · 2016 NW 172ND Due Wed 1:02 AM |
| 134 | button | 2E Front Door Lock - Low Battery Maintenance Review · 2014 E 52nd St Due Wed 1:23 AM |
| 135 | button | 2N Garage Door is Broken. Maintenance Review · 2016 NW 172ND Due Wed 4:05 AM |
| 136 | button | 1S Lawn Care Maintenance Review · 15905 Sky Run Dr. Due Wed 2:27 PM |
| 137 | button | 4E Front Door Lock - Low Battery Maintenance Review · 4718 E Shadowbrook Dr Due Wed 2:29 PM |
| 138 | button | 4N Lawn Care Maintenance Review · 4308 NW 158th St. Due Wed 3:04 PM |
| 139 | button | 2N Lawn Care Maintenance Review · 2321 NW 158th St Due Wed 3:43 PM |
| 140 | button | 3N Lawn Care Maintenance Review · 3405 NW 159th Ter Due Wed 3:43 PM |
| 141 | button | 1W Lawn Care Maintenance Review · 16216 Whistle Crk Blvd Due Wed 4:43 PM |
| 142 | button | 1W Lawn Care Maintenance Review · 1700 Whispering Creek Dr Due Wed 5:11 PM |
| 143 | button | 2C Front Door Lock - Low Battery Maintenance Review · 2004 Cedar Ridge Rd Due Wed 5:34 PM |
| 144 | button | 3W Lawn Care Maintenance Review · 305 W 7th St Due Wed 6:25 PM |
| 145 | button | 2E Trash is full - HAUL request Maintenance Review · 2901 E 75th St Due Wed 6:29 PM |
| 146 | button | 2C Lawn Care Maintenance Review · 2004 Cedar Ridge Rd Due Wed 6:51 PM |
| 147 | button | 2H Excessive trash. Maintenance Review · 207 High Point Way Due Wed 7:40 PM |
| 148 | button | 2H Broken chair Maintenance Review · 207 High Point Way Due Wed 7:41 PM |
| 149 | button | 1W Dog poop Maintenance Review · 1152 Western Yarrow Ave Due Wed 7:47 PM |
| 150 | button | 2F Lawn Care Maintenance Review · 2525 Fallview Dr Due Wed 7:50 PM |
| 151 | button | 4D Lawn Care Maintenance Review · 417 Dauphin Ave Due Wed 8:42 PM |
| 152 | button | 4B Lawn Care Maintenance Review · 441 Belmont Dr Due Wed 8:43 PM |
| 153 | button | 3B Lawn Care Maintenance Review · 3201 Belmont Circle Due Wed 8:43 PM |
| 154 | button | 2L Lawn Care Maintenance Review · 2332 Los Angeles Ave Due Wed 9:17 PM |
| 155 | button | 1P Lawn Care Maintenance Review · 1701 Park Lane Dr. Due Wed 9:41 PM |
| 156 | button | 1N Lawn Care Maintenance Review · 1016 NW 191st St Due Wed 10:03 PM |
| 157 | button | 2C Broken lamp Maintenance Review · 2004 Cedar Ridge Rd Due Wed 10:34 PM |
| 158 | button | 2H Linens ruined. Maintenance Review · 207 High Point Way Due Wed 10:40 PM |
| 159 | button | 2C Couch has small tear Maintenance Review · 2004 Cedar Ridge Rd Due Wed 10:41 PM |
| 160 | button | 3W Damage to kitchen table top Maintenance Review · 3333 Welling Rd Due Wed 10:45 PM |
| 161 | button | 3W 3 broken coasters Maintenance Review · 3333 Welling Rd Due Wed 10:46 PM |
| 162 | button | 2S Reservation #107555754 Maintenance Review · 2522 S. Irvington Ave Due Wed 11:03 PM |
| 163 | button | 4B Package Maintenance Review · 4003 Bendale Rd Due Wed 11:05 PM |
| 164 | button | 8H Broken kitchen chair Maintenance Review · 817 Halley Dr. Due Wed 11:06 PM |
| 165 | button | 1E Landscaping Maintenance Review · 10121 E 131st Pl S Due Wed 11:19 PM |
| 166 | button | 1E Touch up paint Maintenance Review · 10121 E 131st Pl S Due Wed 11:19 PM |
| 167 | button | 1B Yard Maintenance Review · 1169 Blue Sky Lane Due Wed 11:22 PM |
| 168 | button | 1M Yard work Maintenance Review · 136 Magnolia Estates St. Due Wed 11:25 PM |
| 169 | button | 8A FROM PREVIOUS TURNS- NOT ADDRESSED Maintenance Review · 845 Alexandria Ln Due Wed 11:40 PM |
| 170 | card | Coming up · 3 |
| 171 | heading | Coming up · 3 |
| 172 | button | 9N Install King-Size Bedsheets Maintenance Review · 904 NE 34th Ter Thu 12:01 AM |
| 173 | button | 3W Lawn Care Maintenance Review · 3333 Welling Rd Thu 12:12 AM |
| 174 | button | 2S Replace Light Bulb – Unit 2608 Maintenance Review · 2608 SE 38th St Thu 2:30 AM |
| 175 | card | Maintenance review |
| 176 | heading | Maintenance review |
| 177 | button | Replace Light Bulb – Unit 2608 2608 SE 38th St · Finished 11/25/2026 |
| 178 | button | Install King-Size Bedsheets 904 NE 34th Ter · Finished 11/25/2026 |
| 179 | button | New House Setup - Unbox Deliveries / Check for Damage 624 Daniel Court · Finished 11/24/2026 |
| 180 | button | New House Setup - Assemble Boxed Furniture 624 Daniel Court · Finished 11/24/2026 |
| 181 | button | New House Setup - Setting out Essentials 624 Daniel Court · Finished 11/24/2026 |
| 182 | button | Trash is full - HAUL request 2901 E 75th St · Finished 11/24/2026 |
| 183 | button | New House Setup - Standard Inspection 624 Daniel Court · Finished 11/24/2026 |
| 184 | button | Install Air Filters 624 Daniel Court · Finished 11/24/2026 |
| 185 | button | Front Door Lock - Low Battery 2004 Cedar Ridge Rd · Finished 11/24/2026 |
| 186 | button | Front Door Lock - Low Battery 4718 E Shadowbrook Dr · Finished 11/24/2026 |
| 187 | button | Garage Door is Broken. 2016 NW 172ND · Finished 11/24/2026 |
| 188 | button | Front Door Lock - Low Battery 2014 E 52nd St · Finished 11/24/2026 |
| 189 | button | Inspect and Repair Master Bathroom Shower Head 2016 NW 172ND · Finished 11/24/2026 |
| 190 | button | The Master Bather Shower is Faulty 2016 NW 172ND · Finished 11/24/2026 |
| 191 | button | loose toilet 10845 Sara Ct · Finished 11/24/2026 |
| 192 | button | Haul the trash + Broken Bed Board 815 E Fulton St · Finished 11/23/2026 |
| 193 | button | Haulaway Bins 10121 E 131st Pl S · Finished 11/23/2026 |
| 194 | button | Shower Curtain Replacement 2522 S. Irvington Ave · Finished 11/23/2026 |
| 195 | button | New House Setup - Painting 624 Daniel Court · Finished 11/23/2026 |
| 196 | button | Kitchen Disposal Replacement 3029 NW 181st · Finished 11/22/2026 |
| 197 | button | Front Door Lock - Low Battery 5923 Hollyhock Ln · Finished 11/22/2026 |
| 198 | button | Front Door Lock - Low Battery 2522 S. Irvington Ave · Finished 11/22/2026 |
| 199 | button | Front Door Lock - Low Battery 1152 Western Yarrow Ave · Finished 11/22/2026 |
| 200 | button | Haulaway 11249 Pegasus Dr · Finished 11/22/2026 |
| 201 | button | Light fixtures require replacing 4718 E Shadowbrook Dr · Finished 11/22/2026 |
| 202 | button | Bedroom Carpet Cleaning – Dog Urine Odor 10320 Lightning Creek Dr · Finished 11/22/2026 |
| 203 | button | Walmart Return Items 10302 S. 230th East Ave · Finished 11/21/2026 |
| 204 | button | Front Door Lock - Low Battery 504 S. 47th St. · Finished 11/21/2026 |
| 205 | button | Front Door Lock - Low Battery 31445 Moore Rd · Finished 11/20/2026 |
| 206 | button | Recharge Ring Doorbell Camera 31445 Moore Rd · Finished 11/20/2026 |
| 207 | button | fix drywall hole 2701 Berkshire Way · Finished 11/20/2026 |
| 208 | button | Dead Animal Removal – 10320 10320 Lightning Creek Dr · Finished 11/20/2026 |
| 209 | button | Trash Removal Before Guest Check-In 10320 Lightning Creek Dr · Finished 11/20/2026 |
| 210 | button | New House Setup - Prep Property / Meet Photographer 250 Springfield Xing · Finished 11/20/2026 |
| 211 | button | New House Setup - Setting Up ROKU TVs & Storing Remotes 250 Springfield Xing · Finished 11/20/2026 |
| 212 | button | New House Setup - Meet Furniture Delivery and Set out Mattresses 624 Daniel Court · Finished 11/20/2026 |
| 213 | button | New House Setup - Pre-Work Inspection 624 Daniel Court · Finished 11/20/2026 |
| 214 | button | New House Setup - Bring Deliveries Inside 624 Daniel Court · Finished 11/20/2026 |
| 215 | button | New House Setup - Bring Deliveries Inside 624 Daniel Court · Finished 11/20/2026 |
| 216 | button | Purchase and Install Garage Door Opener – 9120 Yassir 9120 Yassir Blvd · Finished 11/20/2026 |
| 217 | button | Front Door Lock - Low Battery 6847 Cardiff Dr · Finished 11/20/2026 |
| 218 | button | New House Setup - Place surveillance signs on property 624 Daniel Court · Finished 11/19/2026 |
| 219 | button | trash haulaway 4003 Bendale Rd · Finished 11/19/2026 |
| 220 | button | Front Door Lock - Low Battery 10121 E 131st Pl S · Finished 11/19/2026 |
| 221 | button | Bathroom Vanity Lights Flickering – Inspection and Repair 904 NE 34th Ter · Finished 11/18/2026 |
| 222 | button | Remove and Dispose of Excess Trash – 19013 Meadows Crossing 19013 Meadows Crossing Dr. · Finished 11/18/2026 |
| 223 | button | Trash Removal and Disposal – 3333 Welling Rd 3333 Welling Rd · Finished 11/18/2026 |
| 224 | button | New House Setup - Install Locks / Garage Lockbox and Keypad 624 Daniel Court · Finished 11/18/2026 |
| 225 | button | New House Setup - Bring Deliveries Inside 624 Daniel Court · Finished 11/18/2026 |
| 226 | button | Front Door Lock - Low Battery 1169 Blue Sky Lane · Finished 11/18/2026 |
| 227 | button | Delivering the TV remote 3000 W Charlotte St · Finished 11/18/2026 |
| 228 | button | New House Setup - Prep Property / Meet Photographer 8602 E. Galveston St. · Finished 11/18/2026 |
| 229 | button | New House Setup - Bring Deliveries Inside 624 Daniel Court · Finished 11/18/2026 |
| 230 | button | New House Setup - Create Houzz Pro 3D Floorplans of Each Room 8738 Comstock Ct · Finished 11/18/2026 |
| 231 | button | New House Setup - Install Ring Devices / Connect to ARHA Ring Account 624 Daniel Court · Finished 11/18/2026 |
| 232 | button | carpet cleaning 3201 Belmont Circle · Finished 11/17/2026 |
| 233 | button | New House Setup - Bring Deliveries Inside 624 Daniel Court · Finished 11/17/2026 |
| 234 | button | New House Setup - Wash Linens 250 Springfield Xing · Finished 11/17/2026 |
| 235 | button | New House Setup - Provide Repair/Improvements Estimates 8738 Comstock Ct · Finished 11/17/2026 |
| 236 | button | Amazon Return: Ironing Board 401 E 10th St · Finished 11/17/2026 |
| 237 | card | Recently completed |
| 238 | heading | Recently completed |
| 239 | button | 1S Cleaning Review — Serene Sara Ct (10845) Cleaning Review · 10845 Sara Ct Needs follow-up |
| 240 | button | 1W Guest touch base Guest Touch Base · 1152 Western Yarrow Ave Looks good |
| 241 | button | 2L Guest touch base Guest Touch Base · 2100 Liberty Way Dr Looks good |
| 242 | button | 1S Guest touch base Guest Touch Base · 14553 Serrano Ridge Dr Looks good |
| 243 | button | 4W Guest touch base Guest Touch Base · 4607 W Union St Looks good |
| 244 | button | 7V Guest touch base Guest Touch Base · 721 Vaquero St. Looks good |
| 245 | button | 2W Guest touch base Guest Touch Base · 2012 W. Black Powder Way Looks good |
| 246 | button | 2H Guest touch base Guest Touch Base · 207 High Point Way Looks good |
| 247 | button | 4B Guest touch base Guest Touch Base · 453 Blue Crow Lane Looks good |
| 248 | button | 1W Guest touch base Guest Touch Base · 1056 Wildwood Dr. Looks good |
| 249 | button | 3M Guest touch base Guest Touch Base · 31445 Moore Rd Looks good |
| 250 | button | 1E Guest touch base Guest Touch Base · 13325 E 43rd Pl S Looks good |

**Appears more than once:** button: Record routine work × 2; button: 3P Lawn Care Maintenance Review · 3012 Piper St Due now × 2; button: 6T Lawn Care Maintenance Review · 64 Turtle Loop Due now × 4; button: New House Setup - Bring Deliveries Inside 624 Daniel Court · Finished 11/20/2026 × 2; button: New House Setup - Bring Deliveries Inside 624 Daniel Court · Finished 11/18/2026 × 2.

### phone-open-arrival-check.png

Screen: Open arrival check. Viewer: Emily. PNG: 390 × 3003.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Open full page |
| 2 | button | Close Ticket |
| 3 | heading | Ticket |
| 4 | heading | Arrival check: 1068 Berrywood Dr |
| 5 | button | More |
| 6 | button | Due date Nov 19. Change the due date |
| 7 | button | Close ticket |
| 8 | button | Reopen ticket (disabled) |
| 9 | chip | Logged |
| 10 | chip | Fix it |
| 11 | chip | Done |
| 12 | heading | Do this now |
| 13 | button | Change next step |
| 14 | button | Done |
| 15 | card | Arrival check |
| 16 | heading | Arrival check |
| 17 | button | Open the home |
| 18 | button | Open Breezeway requirements |
| 19 | button | Remind me to recheck |
| 20 | button, filter | Connected |
| 21 | button, filter | Not connected |
| 22 | button | I reviewed the open work orders |
| 23 | button | Check-in details sent |
| 24 | button, filter | Ready for the guest |
| 25 | button, filter | Issue found |
| 26 | button | Complete check (disabled) |
| 27 | heading | Confirm you have it |
| 28 | filter | Anything worth noting (optional) |
| 29 | button | Continue |
| 30 | button | Waiting on someone? |
| 31 | card | Make it right |
| 32 | button | lucide-chevron-down |
| 33 | heading | Make it right |
| 34 | button | Yes |
| 35 | button | No |
| 36 | button | Yes, open a claim |
| 37 | heading | DETAILS |
| 38 | filter | Add an update: who you called, what the vendor found, what the guest said… |
| 39 | button | lucide-building-2 |
| 40 | button | lucide-send |
| 41 | button | lucide-send |
| 42 | heading | Unnamed heading |
| 43 | button, filter | Issue is tied to |
| 44 | button, filter | Active-stay impact |
| 45 | button, filter | Guest communication required |

**Appears more than once:** button: lucide-send × 2.

### phone-oversight.png

Screen: Oversight. Viewer: Emily. PNG: 390 × 30761.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Search Resolve |
| 2 | button | Record work |
| 3 | button | Record routine work |
| 4 | button | Toggle Sidebar |
| 5 | button | Take the tour |
| 6 | button | Alerts and escalations |
| 7 | button | Chats, 1 unread |
| 8 | button | Notifications |
| 9 | button | Switch to dark mode |
| 10 | chip | 1 |
| 11 | button | lucide-layout-grid |
| 12 | button | Sign out (Admin) |
| 13 | button | Oversight |
| 14 | button | Supervisor check |
| 15 | button | Shift handoffs |
| 16 | button | Team records |
| 17 | button | Coaching |
| 18 | button | Weekly scorecard |
| 19 | heading | Operations oversight |
| 20 | card | Overdue arrival checks |
| 21 | heading | Overdue arrival checks |
| 22 | button | Bulk close as completed outside Resolve |
| 23 | card | All open tickets (190) |
| 24 | heading | All open tickets (190) |
| 25 | table | Table |
| 26 | button | Help & Feedback |
| 27 | button | Nightly export check |
| 28 | card | On call · Emily Jimenez After hours now Details |
| 29 | card | Overnight handoff 0 open Details |
| 30 | card | Insurance risk (0) |
| 31 | heading | Insurance risk (0) |
| 32 | button, filter | Decisions needed 129 |
| 33 | button, filter | Escalations 130 |
| 34 | button, filter | Blockers 67 |
| 35 | button, filter | Overdue / high-risk 65 |
| 36 | button, filter | Approvals 9 |
| 37 | button, filter | Review before closing 14 |
| 38 | table | Work that needs a supervisor |
| 39 | button | Decisions needed, hide rows |
| 40 | button | P3 Trash outside by front door #5131 3201 Belmont Circle, Edmond, Oklahoma 73034 OKC Unassigned Open Nobody owns this Reported Today 3:54 PM Assign an owner |
| 41 | chip | P3 |
| 42 | button | P3 downstairs bathroom #5130 7422 S. Granite Ave, Tulsa, Oklahoma 74136 Tulsa Unassigned Open Nobody owns this Reported Today 12:02 PM Assign an owner |
| 43 | chip | P3 |
| 44 | button | P3 Broken lamp #5129 2004 Cedar Ridge Rd, Edmond, Oklahoma 73013 OKC Unassigned Open Nobody owns this Reported Today 11:03 AM Assign an owner |
| 45 | chip | P3 |
| 46 | button | P3 Excessive trash. #5128 207 High Point Way, Justin, Texas 76247 Fort Worth Unassigned Open Nobody owns this Reported Today 10:32 AM Assign an owner |
| 47 | chip | P3 |
| 48 | button | P3 Linens ruined. #5127 207 High Point Way, Justin, Texas 76247 Fort Worth Unassigned Open Nobody owns this Reported Today 10:31 AM Assign an owner |
| 49 | chip | P3 |
| 50 | button | P3 Broken chair #5126 207 High Point Way, Justin, Texas 76247 Fort Worth Unassigned Open Nobody owns this Reported Today 10:28 AM Assign an owner |
| 51 | chip | P3 |
| 52 | button | P3 Couch has small tear #5125 2004 Cedar Ridge Rd, Edmond, Oklahoma 73013 OKC Unassigned Open Nobody owns this Reported Today 10:17 AM Assign an owner |
| 53 | chip | P3 |
| 54 | button | P3 Reservation #107883011 #5124 33 Center Ln S, Carlton Landing, Oklahoma 74332 Carlton Landing Unassigned Open Nobody owns this Reported Today 7:20 AM Assign an owner |
| 55 | chip | P3 |
| 56 | button | P2 Arrival check: 2608 SE 38th St #5113 2608 SE 38th St, Moore, Oklahoma 73160 OKC Unassigned Open Nobody owns this Reported Today 6:00 AM Assign an owner |
| 57 | chip | P2 |
| 58 | button | P2 Arrival check: 4718 E Shadowbrook Dr #5117 4718 E Shadowbrook Dr, Camby, Indiana 46113 Indy Unassigned Open Nobody owns this Reported Today 6:00 AM Assign an owner |
| 59 | chip | P2 |
| 60 | button | P2 Arrival check: 3915 W 104th St S #5120 3915 W 104th St S, Jenks, Oklahoma 74037 Tulsa Unassigned Open Nobody owns this Reported Today 6:00 AM Assign an owner |
| 61 | chip | P2 |
| 62 | button | P2 Arrival check: 2332 Los Angeles Ave #5116 2332 Los Angeles Ave, Edmond, Oklahoma 73034 OKC Unassigned Open Nobody owns this Reported Today 6:00 AM Assign an owner |
| 63 | chip | P2 |
| 64 | button | Escalations, hide rows |
| 65 | button | P3 Trash outside by front door #5131 3201 Belmont Circle, Edmond, Oklahoma 73034 OKC Unassigned Open Response overdue Reported Today 3:54 PM Reply now |
| 66 | chip | P3 |
| 67 | button | P3 downstairs bathroom #5130 7422 S. Granite Ave, Tulsa, Oklahoma 74136 Tulsa Unassigned Open Response overdue Reported Today 12:02 PM Reply now |
| 68 | chip | P3 |
| 69 | button | P3 Broken lamp #5129 2004 Cedar Ridge Rd, Edmond, Oklahoma 73013 OKC Unassigned Open Response overdue Reported Today 11:03 AM Reply now |
| 70 | chip | P3 |
| 71 | button | P3 Excessive trash. #5128 207 High Point Way, Justin, Texas 76247 Fort Worth Unassigned Open Response overdue Reported Today 10:32 AM Reply now |
| 72 | chip | P3 |
| 73 | button | P3 Linens ruined. #5127 207 High Point Way, Justin, Texas 76247 Fort Worth Unassigned Open Response overdue Reported Today 10:31 AM Reply now |
| 74 | chip | P3 |
| 75 | button | P3 Broken chair #5126 207 High Point Way, Justin, Texas 76247 Fort Worth Unassigned Open Response overdue Reported Today 10:28 AM Reply now |
| 76 | chip | P3 |
| 77 | button | P3 Couch has small tear #5125 2004 Cedar Ridge Rd, Edmond, Oklahoma 73013 OKC Unassigned Open Response overdue Reported Today 10:17 AM Reply now |
| 78 | chip | P3 |
| 79 | button | P3 Reservation #107883011 #5124 33 Center Ln S, Carlton Landing, Oklahoma 74332 Carlton Landing Unassigned Open Response overdue Reported Today 7:20 AM Reply now |
| 80 | chip | P3 |
| 81 | button | P2 Arrival check: 2608 SE 38th St #5113 2608 SE 38th St, Moore, Oklahoma 73160 OKC Unassigned Open Response overdue Reported Today 6:00 AM Reply now |
| 82 | chip | P2 |
| 83 | button | P2 Arrival check: 4718 E Shadowbrook Dr #5117 4718 E Shadowbrook Dr, Camby, Indiana 46113 Indy Unassigned Open Response overdue Reported Today 6:00 AM Reply now |
| 84 | chip | P2 |
| 85 | button | P2 Arrival check: 3915 W 104th St S #5120 3915 W 104th St S, Jenks, Oklahoma 74037 Tulsa Unassigned Open Response overdue Reported Today 6:00 AM Reply now |
| 86 | chip | P2 |
| 87 | button | P2 Arrival check: 2332 Los Angeles Ave #5116 2332 Los Angeles Ave, Edmond, Oklahoma 73034 OKC Unassigned Open Response overdue Reported Today 6:00 AM Reply now |
| 88 | chip | P2 |
| 89 | button | Blockers, hide rows |
| 90 | button | P2 toilet paper holder #5137 845 Alexandria Ln, Joshua, Texas 76058-6216 Fort Worth Qym Fuenteblanca Team B Open Acknowledged but not started Reported Today 5:52 PM Start work |
| 91 | chip | P2 |
| 92 | button | P2 backyard needs mowed #5136 1169 Blue Sky Lane, Burleson, Texas 76028 Fort Worth Qym Fuenteblanca Team B Open Acknowledged but not started Reported Today 5:23 PM Start work |
| 93 | chip | P2 |
| 94 | button | P2 repair dining chair #5135 817 Halley Dr., Moore, Oklahoma 73160 OKC Qym Fuenteblanca Team B Open Acknowledged but not started Reported Today 5:06 PM Start work |
| 95 | chip | P2 |
| 96 | button | P2 towel rack repair #5134 628 Joy Ct, Burleson, Texas 76028 Fort Worth Qym Fuenteblanca Team B Open Acknowledged but not started Reported Today 5:04 PM Start work |
| 97 | chip | P2 |
| 98 | button | P2 broken coasters #5133 3333 Welling Rd, Edmond, Oklahoma 73012 OKC Romeo Canales Team B Open Acknowledged but not started Reported Today 4:46 PM Start work |
| 99 | chip | P2 |
| 100 | button | P2 small tear/rip in couch #5132 2004 Cedar Ridge Rd, Edmond, Oklahoma 73013 OKC Romeo Canales Team B Open Acknowledged but not started Reported Today 4:43 PM Start work |
| 101 | chip | P2 |
| 102 | button | P2 one of dining chairs was broken #5104 4607 W Union St, Broken Arrow, Oklahoma 74011 Tulsa Qym Fuenteblanca Team B Open Acknowledged but not started Reported Nov 23 Start work |
| 103 | chip | P2 |
| 104 | button | P2 bathroom mirror broken #5103 18200 Bodegon Rd., Edmond, Oklahoma 73012 OKC Qym Fuenteblanca Team B Open Acknowledged but not started Reported Nov 23 Start work |
| 105 | chip | P2 |
| 106 | button | P2 7006 project. This home is missing quite a few standard items that we need ordered and then a few things need replaced. #5102 7006 E 154th St S, Bixby, Oklahoma 74008 Tulsa Qym Fuenteblanca Team B Open Acknowledged but not started Reported Nov 23 Start work |
| 107 | chip | P2 |
| 108 | button | P2 to reach out to owner on considering to replace the carpet #5048 3712 N 39th St., Broken Arrow, Oklahoma 74014 Tulsa Romeo Canales Team B Open Acknowledged but not started Reported Nov 20 Start work |
| 109 | chip | P2 |
| 110 | button | P2 slow shower drain #5046 1068 Berrywood Dr, Greenwood, Indiana 46143 Indy James Almario Leadership Open Acknowledged but not started Reported Nov 20 Start work |
| 111 | chip | P2 |
| 112 | button | P3 Quarterly property review: 5253 Tracey Jo Rd #5023 5253 Tracey Jo Rd, Greenwood, Indiana 46142 Indy James Almario Leadership Open Acknowledged but not started Reported Nov 19 Start work |
| 113 | chip | P3 |
| 114 | button | P2 The Door in the bedroom fell down. The carpet is dirty #4941 207 High Point Way, Justin, Texas 76247 Fort Worth Mike Cacatian Team A In progress Handoff not accepted Reported Nov 16 Accept the handoff |
| 115 | chip | P2 |
| 116 | button | Overdue / high-risk, hide rows |
| 117 | button | P2 2014 - get carpet quote to replace #1509 2014 E 52nd St, Tulsa, Oklahoma 74105 Tulsa Romeo Canales Team B Waiting on owner Waiting past its review date Overdue by 5d Update the review |
| 118 | chip | P2 |
| 119 | button | P2 5923 - yale lock disconnected #1487 5923 Hollyhock Ln, Montgomery, Texas 77316 Houston Romeo Canales Team B Waiting on vendor Waiting past its review date Overdue by 39h Update the review |
| 120 | chip | P2 |
| 121 | button | P2 Arrival check: 11508 E 94th Pl N #5067 11508 E 94th Pl N, Owasso, Oklahoma 74055 Tulsa Unassigned Open P1 and P2 aging Reported Nov 21 Push this forward |
| 122 | chip | P2 |
| 123 | button | P2 Arrival check: 1169 Blue Sky Lane #5062 1169 Blue Sky Lane, Burleson, Texas 76028 Fort Worth Unassigned Open P1 and P2 aging Reported Nov 21 Push this forward |
| 124 | chip | P2 |
| 125 | button | P2 Arrival check: 4513 Black Mesa Lane #5061 4513 Black Mesa Lane, Yukon, Oklahoma 73099 OKC Unassigned Open P1 and P2 aging Reported Nov 21 Push this forward |
| 126 | chip | P2 |
| 127 | button | P2 Arrival check: 10121 E 131st Pl S #5051 10121 E 131st Pl S, Bixby, Oklahoma 74008 Tulsa Unassigned Open P1 and P2 aging Reported Nov 21 Push this forward |
| 128 | chip | P2 |
| 129 | button | P2 Arrival check: 2100 Liberty Way Dr #5052 2100 Liberty Way Dr, Greenwood, Indiana 46143 Indy Unassigned Open P1 and P2 aging Reported Nov 21 Push this forward |
| 130 | chip | P2 |
| 131 | button | P2 Arrival check: 10320 Lightning Creek Dr #5057 10320 Lightning Creek Dr, Yukon, Oklahoma 73099 OKC Unassigned Open P1 and P2 aging Reported Nov 21 Push this forward |
| 132 | chip | P2 |
| 133 | button | P2 Arrival check: 7071 Richardson Ct #5050 7071 Richardson Ct, Warr Acres, Oklahoma 73132 OKC Unassigned Open P1 and P2 aging Reported Nov 21 Push this forward |
| 134 | chip | P2 |
| 135 | button | P2 Arrival check: 305 W 7th St #5056 305 W 7th St, Edmond, Oklahoma 73003 OKC Unassigned Open P1 and P2 aging Reported Nov 21 Push this forward |
| 136 | chip | P2 |
| 137 | button | P2 Arrival check: 3613 Upland Ridge Dr. #5053 3613 Upland Ridge Dr., Yukon, Oklahoma 73099 OKC Unassigned Open P1 and P2 aging Reported Nov 21 Push this forward |
| 138 | chip | P2 |
| 139 | button | P2 Arrival check: 15226 High Timber Ln #5054 15226 High Timber Ln, Noblesville, Indiana 46060 Indy Unassigned Open P1 and P2 aging Reported Nov 21 Push this forward |
| 140 | chip | P2 |
| 141 | button | P2 Arrival check: 2701 Berkshire Way #5060 2701 Berkshire Way, Oklahoma City, Oklahoma 73120 OKC Unassigned Open P1 and P2 aging Reported Nov 21 Push this forward |
| 142 | chip | P2 |
| 143 | button | P2 Arrival check: 3712 N 39th St. #5055 3712 N 39th St., Broken Arrow, Oklahoma 74014 Tulsa Unassigned Open P1 and P2 aging Reported Nov 21 Push this forward |
| 144 | chip | P2 |
| 145 | button | Approvals, hide rows |
| 146 | button | Send recommended repair & home improvements cost projections to prospective buyer Awaiting a decision Onboarding task Review |
| 147 | button | 10. Obtain owner decisions and approvals Awaiting a decision Onboarding task Due 10/31/2026 Review |
| 148 | button | Send recommended repair & home improvements cost projections to prospective buyer Awaiting a decision Onboarding task Review |
| 149 | button | 10. Obtain owner decisions and approvals Awaiting a decision Onboarding task Review |
| 150 | button | 10. Obtain owner decisions and approvals Awaiting a decision Onboarding task Review |
| 151 | button | Send recommended repair & home improvements cost projections to prospective buyer Awaiting a decision Onboarding task Due 11/05/2026 Review |
| 152 | button | Send A Real Home Away management agreement to prospective buyer for review and signature Awaiting a decision Onboarding task Review |
| 153 | button | Send A Real Home Away management agreement to prospective buyer for review and signature Awaiting a decision Onboarding task Review |
| 154 | button | Send A Real Home Away management agreement to prospective buyer for review and signature Awaiting a decision Onboarding task Due 10/27/2026 Review |
| 155 | button | Review before closing, hide rows |
| 156 | button | P2 toilet seat is loose causing bottom seal to leak water #5047 10845 Sara Ct, Midwest City, Oklahoma 73130 OKC Romeo Canales Team B Resolved Needs review before closing Reported Nov 20 Review and decide |
| 157 | chip | P2 |
| 158 | button | P2 Washer is not working #5030 7422 S. Granite Ave, Tulsa, Oklahoma 74136 Tulsa Romeo Canales Team B Resolved Needs review before closing Reported Nov 19 Review and decide |
| 159 | chip | P2 |
| 160 | button | P2 Living Room Drywall Hole #5026 2701 Berkshire Way, Oklahoma City, Oklahoma 73120 OKC Romeo Canales Team B Resolved Needs review before closing Reported Nov 19 Review and decide |
| 161 | chip | P2 |
| 162 | button | P2 Guest review: Please check the kitchen extractor hood, as it is barely working. #4977 721 Vaquero St., White Settlement, Texas 76108 Fort Worth Qym Fuenteblanca Team B Resolved Needs review before closing Reported Nov 17 Review and decide |
| 163 | chip | P2 |
| 164 | button | P2 Guest touch base: STOVE not working. #4971 1701 Park Lane Dr., Edmond, Oklahoma 73003 OKC Qym Fuenteblanca Team B Resolved Needs review before closing Reported Nov 17 Review and decide |
| 165 | chip | P2 |
| 166 | button | P2 Thermostat switched to heat but still blowing cool air #4960 1039 Swinton Way, Westfield, Indiana 46074 Indy Romeo Canales Team B Resolved Needs review before closing Reported Nov 17 Review and decide |
| 167 | chip | P2 |
| 168 | button | P2 Jennifer Wright at 1215 - Thermostat cannot be set to heat #4930 1215 N Elder Ave, Broken Arrow, Oklahoma 74012 Tulsa Romeo Canales Team B Resolved Needs review before closing Reported Nov 16 Review and decide |
| 169 | chip | P2 |
| 170 | button | P2 14553 - dishwasher is not working again. #1514 14553 Serrano Ridge Dr, Ft. Worth, Texas 76052 Fort Worth Romeo Canales Team B Resolved Needs review before closing Reported Nov 5 Review and decide |
| 171 | chip | P2 |
| 172 | button | P2 5047 - pilot light is out again + microwave door handle + front door handle + screen door #1510 5047 Skipping Stone Dr, Indianapolis, Indiana 46237 Indy Romeo Canales Team B Resolved Needs review before closing Reported Nov 4 Review and decide |
| 173 | chip | P2 |
| 174 | button | P1 508 - potential leak #1511 508 NW 183rd St, Edmond, Oklahoma 73012 OKC Romeo Canales Team B Resolved Needs review before closing Reported Nov 4 Review and decide |
| 175 | chip | P1 |
| 176 | button | P2 2817 - microwave door won’t shut #1502 2817 Hazel Hollow, Moore, Oklahoma 73160 OKC Romeo Canales Team B Resolved Needs review before closing Reported Nov 1 Review and decide |
| 177 | chip | P2 |
| 178 | button | P2 64 Turtle Loop - Resecure Pool Umbrellas #1475 64 Turtle Loop, Eufaula, Oklahoma 74432 Carlton Landing Romeo Canales Team B Resolved Needs review before closing Reported Oct 26 Review and decide |
| 179 | chip | P2 |
| 180 | card | Workload by person |
| 181 | heading | Workload by person |
| 182 | button | Unassigned 129 |
| 183 | button | Micah Sinor 53 |
| 184 | button | Qym Fuenteblanca 10 |
| 185 | button | Romeo Canales 6 |
| 186 | button | Mike Cacatian 3 |
| 187 | button | Avy Vergara 2 |
| 188 | button | James Almario 2 |
| 189 | button | Emily Jimenez 1 |
| 190 | heading | Where the work sits |
| 191 | button | Maintenance / Breezeway 23 25 repair requests sent 23 past the committed date |
| 192 | button | Routine controls 111 111 late · 148 open 99 completed in the last 7 days |
| 193 | button | Approvals 9 9 awaiting a decision |
| 194 | button | Claims 36 open 0 inside a platform deadline window |
| 195 | button | Guest refunds & credits 1 open 0 waiting on approval |
| 196 | button | Leads Pipeline and follow-ups |
| 197 | card | Where issues are coming from |
| 198 | heading | Where issues are coming from |
| 199 | heading | PROPERTY |
| 200 | heading | MARKET |
| 201 | heading | TICKET TYPE |

**Appears more than once:** chip: P3 × 17; chip: P2 × 45; button: Send recommended repair & home improvements cost projections to prospective buyer Awaiting a decision Onboarding task Review × 2; button: 10. Obtain owner decisions and approvals Awaiting a decision Onboarding task Review × 2; button: Send A Real Home Away management agreement to prospective buyer for review and signature Awaiting a decision Onboarding task Review × 2.

### phone-supervisor-check.png

Screen: Supervisor check. Viewer: Emily. PNG: 390 × 36646.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Search Resolve |
| 2 | button | Record work |
| 3 | button | Record routine work |
| 4 | button | Toggle Sidebar |
| 5 | button | Take the tour |
| 6 | button | Alerts and escalations |
| 7 | button | Chats, 1 unread |
| 8 | button | Notifications |
| 9 | button | Switch to dark mode |
| 10 | chip | 1 |
| 11 | button | lucide-layout-grid |
| 12 | button | Sign out (Admin) |
| 13 | button | Oversight |
| 14 | button | Supervisor check |
| 15 | button | Shift handoffs |
| 16 | button | Team records |
| 17 | button | Coaching |
| 18 | button | Weekly scorecard |
| 19 | heading | Supervisor check |
| 20 | heading | Team Queue |
| 21 | filter | Search by title or home |
| 22 | button, filter | Filter |
| 23 | button, tab | All team 117 |
| 24 | button, tab | Team A 3 |
| 25 | button, tab | Team B 140 |
| 26 | button, tab | Only mine 1 |
| 27 | chip | 117 |
| 28 | chip | 3 |
| 29 | chip | 140 |
| 30 | button, filter | Priority |
| 31 | button, filter | Status |
| 32 | button, filter | Person |
| 33 | button, filter | Unassigned 40 |
| 34 | button, filter | Waiting 2 |
| 35 | button, filter | Blocked 3 |
| 36 | button, filter | Escalated 117 |
| 37 | button, filter | Overdue 112 |
| 38 | button | Help & Feedback |
| 39 | table | Open tickets |
| 40 | button | P2, hide rows |
| 41 | chip | P2 |
| 42 | button | P2 The Door in the bedroom fell down. The carpet is dirty #4941 207 High Point Way, Justin, Texas 76247 Fort Worth Immediate cleaning need Mike Cacatian Team A In progress Nov 16 Overdue by 8 days Nov 16 |
| 43 | chip | P2 |
| 44 | button | Select ticket 4941 |
| 45 | button | P2 Guest review: Reported issue: Shower head is not working properly. Needs fixing. #4976 2016 NW 172ND, Edmond, Oklahoma 73012 OKC Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 7d Nov 17 |
| 46 | chip | P2 |
| 47 | button | Select ticket 4976 |
| 48 | button | P2 The washer at 7422 has a reported broken timer and may require repair or replacement. Please review the previous updates, confirm the washer #4978 7422 S. Granite Ave, Tulsa, Oklahoma 74136 Tulsa Immediate maintenance Qym Fuenteblanca Team B Open Start work Overdue by 7d Nov 17 |
| 49 | chip | P2 |
| 50 | button | Select ticket 4978 |
| 51 | button | P2 Guest touch base: Pending: Finding her the new house she will extend in from Dec 20 onwards. #4972 724 Abilene Way, Yukon, Oklahoma 73099 OKC Current or past guest request Mike Cacatian Team A In progress Nov 17 Overdue by 7 days Nov 17 |
| 52 | chip | P2 |
| 53 | button | Select ticket 4972 |
| 54 | button | P2 The garage door is broken. It came off the track #4974 5020 S 168th East Ave, Tulsa, Oklahoma 74134 Tulsa Maintenance and landscaping work-order review Qym Fuenteblanca Team B In progress Nov 17 Overdue by 7 days Nov 17 |
| 55 | chip | P2 |
| 56 | button | Select ticket 4974 |
| 57 | button | P2 Guest touch base: 11/18 - MC #5000 207 High Point Way, Justin, Texas 76247 Fort Worth Current or past guest request Mike Cacatian Team A In progress Nov 18 Overdue by 6 days Nov 18 |
| 58 | chip | P2 |
| 59 | button | Select ticket 5000 |
| 60 | button | P2 2014 - get carpet quote to replace #1509 2014 E 52nd St, Tulsa, Oklahoma 74105 Tulsa Other Romeo Canales Team B Waiting on owner Nov 20 · 8:00 AM Overdue by 5d Nov 3 |
| 61 | chip | P2 |
| 62 | button | Select ticket 1509 |
| 63 | button | P2 to reach out to owner on considering to replace the carpet #5048 3712 N 39th St., Broken Arrow, Oklahoma 74014 Tulsa Ongoing maintenance Romeo Canales Team B Open Start work Overdue by 4d Nov 20 |
| 64 | chip | P2 |
| 65 | button | Select ticket 5048 |
| 66 | button | P2 slow shower drain #5046 1068 Berrywood Dr, Greenwood, Indiana 46143 Indy Other James Almario Leadership Open Start work Overdue by 4d Nov 20 |
| 67 | chip | P2 |
| 68 | button | Select ticket 5046 |
| 69 | button | P2 16401 - dryer not working #1476 16401 Villa Valeria Way, Edmond, Oklahoma 73013 OKC Other Romeo Canales Team B Open Reply now Overdue by 4d Oct 27 |
| 70 | chip | P2 |
| 71 | button | Select ticket 1476 |
| 72 | button | P2 Guest touch base: Guest said no Kleenex, very few kitchen items, and can’t find the volume cont... #5077 305 W 7th St, Edmond, Oklahoma 73003 OKC Current or past guest request Avy Vergara In progress Nov 22 Overdue by 2 days Nov 22 |
| 73 | chip | P2 |
| 74 | button | Select ticket 5077 |
| 75 | button | P2 5923 - yale lock disconnected #1487 5923 Hollyhock Ln, Montgomery, Texas 77316 Houston Other Romeo Canales Team B Waiting on vendor Nov 23 · 8:00 AM Overdue by 39h Oct 29 |
| 76 | chip | P2 |
| 77 | button | Select ticket 1487 |
| 78 | button | P2 one of dining chairs was broken #5104 4607 W Union St, Broken Arrow, Oklahoma 74011 Tulsa Immediate maintenance Qym Fuenteblanca Team B Open Start work Overdue by 29h Nov 23 |
| 79 | chip | P2 |
| 80 | button | Select ticket 5104 |
| 81 | button | P2 7006 project. This home is missing quite a few standard items that we need ordered and then a few things need replaced. #5102 7006 E 154th St S, Bixby, Oklahoma 74008 Tulsa Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 29h Nov 23 |
| 82 | chip | P2 |
| 83 | button | Select ticket 5102 |
| 84 | button | P2 bathroom mirror broken #5103 18200 Bodegon Rd., Edmond, Oklahoma 73012 OKC Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 29h Nov 23 |
| 85 | chip | P2 |
| 86 | button | Select ticket 5103 |
| 87 | button | P2 Scheduled Pest Control #5099 3915 W 104th St S, Jenks, Oklahoma 74037 Tulsa Ongoing maintenance Emily Jimenez Leadership In progress Nov 23 Overdue by 1 day Nov 23 |
| 88 | chip | P2 |
| 89 | button | Select ticket 5099 |
| 90 | button | P2 Guest touch base: The guest reported that the bed sheets were dirty: hair all over them, visibl... #5100 815 E Fulton St, Broken Arrow, Oklahoma 74012 Tulsa Current or past guest request Avy Vergara In progress Nov 23 Overdue by 1 day Nov 23 |
| 91 | chip | P2 |
| 92 | button | Select ticket 5100 |
| 93 | button | P2 small tear/rip in couch #5132 2004 Cedar Ridge Rd, Edmond, Oklahoma 73013 OKC Ongoing maintenance Romeo Canales Team B Open Start work Overdue by 6h Today 4:43 PM |
| 94 | chip | P2 |
| 95 | button | Select ticket 5132 |
| 96 | button | P2 broken coasters #5133 3333 Welling Rd, Edmond, Oklahoma 73012 OKC Ongoing maintenance Romeo Canales Team B Open Start work Overdue by 6h Today 4:46 PM |
| 97 | chip | P2 |
| 98 | button | Select ticket 5133 |
| 99 | button | P2 towel rack repair #5134 628 Joy Ct, Burleson, Texas 76028 Fort Worth Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:04 PM |
| 100 | chip | P2 |
| 101 | button | Select ticket 5134 |
| 102 | button | P2 repair dining chair #5135 817 Halley Dr., Moore, Oklahoma 73160 OKC Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:06 PM |
| 103 | chip | P2 |
| 104 | button | Select ticket 5135 |
| 105 | button | P2 backyard needs mowed #5136 1169 Blue Sky Lane, Burleson, Texas 76028 Fort Worth Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:23 PM |
| 106 | chip | P2 |
| 107 | button | Select ticket 5136 |
| 108 | button | P2 toilet paper holder #5137 845 Alexandria Ln, Joshua, Texas 76058-6216 Fort Worth Immediate maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:52 PM |
| 109 | chip | P2 |
| 110 | button | Select ticket 5137 |
| 111 | button | P3, hide rows |
| 112 | chip | P3 |
| 113 | button | P3 FROM PREVIOUS TURNS- NOT ADDRESSED #4931 845 Alexandria Ln, Joshua, Texas 76058-6216 Fort Worth Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 114 | chip | P3 |
| 115 | button | Select ticket 4931 |
| 116 | button | P3 Landscaping #4932 3000 W Charlotte St, Broken Arrow, Oklahoma 74011 Tulsa Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 117 | chip | P3 |
| 118 | button | Select ticket 4932 |
| 119 | button | P3 Air filter needs to be changed #4933 3000 W Charlotte St, Broken Arrow, Oklahoma 74011 Tulsa Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 120 | chip | P3 |
| 121 | button | Select ticket 4933 |
| 122 | button | P3 Broken kitchen table chair #4934 817 Halley Dr., Moore, Oklahoma 73160 OKC Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 123 | chip | P3 |
| 124 | button | Select ticket 4934 |
| 125 | button | P3 Broken lamp #4939 14553 Serrano Ridge Dr, Ft. Worth, Texas 76052 Fort Worth Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 126 | chip | P3 |
| 127 | button | Select ticket 4939 |
| 128 | button | P3 Trash #4940 4003 Bendale Rd, Benbrook, Texas 76116 Fort Worth Other Unassigned Open Reply now Overdue by 8d Nov 16 |
| 129 | chip | P3 |
| 130 | button | Select ticket 4940 |
| 131 | button | P3 Quarterly property review: 13117 NE 9th St #4892 13117 NE 9th St, Choctaw, Oklahoma 73020 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 132 | chip | P3 |
| 133 | button | Select ticket 4892 |
| 134 | button | P3 Quarterly property review: 19021 Meadows Crossing Dr #4893 19021 Meadows Crossing Dr, Edmond, Oklahoma 73012 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 135 | chip | P3 |
| 136 | button | Select ticket 4893 |
| 137 | button | P3 Quarterly property review: 15226 High Timber Ln #4894 15226 High Timber Ln, Noblesville, Indiana 46060 Indy Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 138 | chip | P3 |
| 139 | button | Select ticket 4894 |
| 140 | button | P3 Quarterly property review: 1640 Glade Meadows Dr #4895 1640 Glade Meadows Dr, Joshua, Texas 76058 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 141 | chip | P3 |
| 142 | button | Select ticket 4895 |
| 143 | button | P3 Quarterly property review: 309 Prince John Dr #4896 309 Prince John Dr, Saginaw, Texas 76179 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 144 | chip | P3 |
| 145 | button | Select ticket 4896 |
| 146 | button | P3 Quarterly property review: 207 High Point Way #4897 207 High Point Way, Justin, Texas 76247 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 147 | chip | P3 |
| 148 | button | Select ticket 4897 |
| 149 | button | P3 Quarterly property review: 4607 S. Lakewood Ave #4898 4607 S. Lakewood Ave, Tulsa, Oklahoma 74135 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 150 | chip | P3 |
| 151 | button | Select ticket 4898 |
| 152 | button | P3 Quarterly property review: 2617 W Madison St. #4899 2617 W Madison St., Broken Arrow, Oklahoma 74012 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 153 | chip | P3 |
| 154 | button | Select ticket 4899 |
| 155 | button | P3 Quarterly property review: 4308 NW 158th St. #4900 4308 NW 158th St., Edmond, Oklahoma 73013 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 156 | chip | P3 |
| 157 | button | Select ticket 4900 |
| 158 | button | P3 Quarterly property review: 1908 E Urbana St #4901 1908 E Urbana St, Broken Arrow, Oklahoma 74012 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 159 | chip | P3 |
| 160 | button | Select ticket 4901 |
| 161 | button | P3 Quarterly property review: 10845 Sara Ct #4902 10845 Sara Ct, Midwest City, Oklahoma 73130 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 162 | chip | P3 |
| 163 | button | Select ticket 4902 |
| 164 | button | P3 Quarterly property review: 5034 N. 35th St. #4903 5034 N. 35th St., Broken Arrow, Oklahoma 74014 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 165 | chip | P3 |
| 166 | button | Select ticket 4903 |
| 167 | button | P3 Quarterly property review: 4308 S 177th Pl E #4904 4308 S 177th Pl E, Tulsa, Oklahoma 74134 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 168 | chip | P3 |
| 169 | button | Select ticket 4904 |
| 170 | button | P3 Quarterly property review: 628 Joy Ct #4905 628 Joy Ct, Burleson, Texas 76028 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 171 | chip | P3 |
| 172 | button | Select ticket 4905 |
| 173 | button | P3 Quarterly property review: 3712 N 39th St. #4906 3712 N 39th St., Broken Arrow, Oklahoma 74014 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 174 | chip | P3 |
| 175 | button | Select ticket 4906 |
| 176 | button | P3 Quarterly property review: 428 Drowsy Water Trl #4907 428 Drowsy Water Trl, Ft. Worth, Texas 76131 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 177 | chip | P3 |
| 178 | button | Select ticket 4907 |
| 179 | button | P3 Quarterly property review: 2332 Los Angeles Ave #4908 2332 Los Angeles Ave, Edmond, Oklahoma 73034 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 180 | chip | P3 |
| 181 | button | Select ticket 4908 |
| 182 | button | P3 Quarterly property review: 2016 NW 172ND #4909 2016 NW 172ND, Edmond, Oklahoma 73012 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 183 | chip | P3 |
| 184 | button | Select ticket 4909 |
| 185 | button | P3 Quarterly property review: 7071 Richardson Ct #4910 7071 Richardson Ct, Warr Acres, Oklahoma 73132 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 186 | chip | P3 |
| 187 | button | Select ticket 4910 |
| 188 | button | P3 Quarterly property review: 7351 Red Rock Rd #4911 7351 Red Rock Rd, Indianapolis, Indiana 46236 Indy Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 189 | chip | P3 |
| 190 | button | Select ticket 4911 |
| 191 | button | P3 Quarterly property review: 341 Thistlewood Dr #4912 341 Thistlewood Dr, Greenfield, Indiana 46140 Indy Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 192 | chip | P3 |
| 193 | button | Select ticket 4912 |
| 194 | button | P3 Quarterly property review: 9235 E 133rd St S #4913 9235 E 133rd St S, Bixby, Oklahoma 74008 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 195 | chip | P3 |
| 196 | button | Select ticket 4913 |
| 197 | button | P3 Quarterly property review: 815 E Fulton St #4914 815 E Fulton St, Broken Arrow, Oklahoma 74012 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 198 | chip | P3 |
| 199 | button | Select ticket 4914 |
| 200 | button | P3 Quarterly property review: 305 W 7th St #4915 305 W 7th St, Edmond, Oklahoma 73003 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 201 | chip | P3 |
| 202 | button | Select ticket 4915 |
| 203 | button | P3 Quarterly property review: 236 N Starnes St #4916 236 N Starnes St, Grapevine, Texas 76051 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 204 | chip | P3 |
| 205 | button | Select ticket 4916 |
| 206 | button | P3 Quarterly property review: 8408 NW 162nd St. #4917 8408 NW 162nd St., Edmond, Oklahoma 73013 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 207 | chip | P3 |
| 208 | button | Select ticket 4917 |
| 209 | button | P3 Quarterly property review: 2012 W. Black Powder Way #4918 2012 W. Black Powder Way, Mustang, Oklahoma 73064 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 210 | chip | P3 |
| 211 | button | Select ticket 4918 |
| 212 | button | P3 Quarterly property review: 8332 Welder Pl #4919 8332 Welder Pl, Indianapolis, Indiana 46237 Indy Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 213 | chip | P3 |
| 214 | button | Select ticket 4919 |
| 215 | button | P3 Quarterly property review: 5020 S 168th East Ave #4920 5020 S 168th East Ave, Tulsa, Oklahoma 74134 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 216 | chip | P3 |
| 217 | button | Select ticket 4920 |
| 218 | button | P3 Quarterly property review: 7422 S. Granite Ave #4921 7422 S. Granite Ave, Tulsa, Oklahoma 74136 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 219 | chip | P3 |
| 220 | button | Select ticket 4921 |
| 221 | button | P3 Quarterly property review: 401 E 10th St #4922 401 E 10th St, Edmond, Oklahoma 73034 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 222 | chip | P3 |
| 223 | button | Select ticket 4922 |
| 224 | button | P3 Quarterly property review: 33 Center Ln S #4923 33 Center Ln S, Carlton Landing, Oklahoma 74332 Carlton Landing Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 225 | chip | P3 |
| 226 | button | Select ticket 4923 |
| 227 | button | P3 Quarterly property review: 1636 NE 32nd St #4924 1636 NE 32nd St, Moore, Oklahoma 73160 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 228 | chip | P3 |
| 229 | button | Select ticket 4924 |
| 230 | button | P3 Quarterly property review: 3201 Belmont Circle #4925 3201 Belmont Circle, Edmond, Oklahoma 73034 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 231 | chip | P3 |
| 232 | button | Select ticket 4925 |
| 233 | button | P3 Quarterly property review: 2414 W. Kingsport Ct. S #4926 2414 W. Kingsport Ct. S, Broken Arrow, Oklahoma 74011 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 234 | chip | P3 |
| 235 | button | Select ticket 4926 |
| 236 | button | P3 Quarterly property review: 5923 Hollyhock Ln #4927 5923 Hollyhock Ln, Montgomery, Texas 77316 Houston Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 237 | chip | P3 |
| 238 | button | Select ticket 4927 |
| 239 | button | P3 Quarterly property review: 852 Inland Dr #4928 852 Inland Dr, Avon, Indiana 46123 Indy Quarterly inspection review Micah Sinor Open Start work Overdue by 8d Nov 16 |
| 240 | chip | P3 |
| 241 | button | Select ticket 4928 |
| 242 | button | P3 Back patio/furniture #4961 136 Magnolia Estates St., Crowley, Texas 76036 Fort Worth Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 243 | chip | P3 |
| 244 | button | Select ticket 4961 |
| 245 | button | P3 Ruined linens #4962 136 Magnolia Estates St., Crowley, Texas 76036 Fort Worth Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 246 | chip | P3 |
| 247 | button | Select ticket 4962 |
| 248 | button | P3 Carpet/ rug shampooing. #4963 136 Magnolia Estates St., Crowley, Texas 76036 Fort Worth Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 249 | chip | P3 |
| 250 | button | Select ticket 4963 |
| 251 | button | P3 Yard work #4964 136 Magnolia Estates St., Crowley, Texas 76036 Fort Worth Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 252 | chip | P3 |
| 253 | button | Select ticket 4964 |
| 254 | button | P3 Driveway stains. #4965 136 Magnolia Estates St., Crowley, Texas 76036 Fort Worth Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 255 | chip | P3 |
| 256 | button | Select ticket 4965 |
| 257 | button | P3 Guest items. #4966 136 Magnolia Estates St., Crowley, Texas 76036 Fort Worth Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 258 | chip | P3 |
| 259 | button | Select ticket 4966 |
| 260 | button | P3 Guest bathroom #4975 904 NE 34th Ter, Moore, Oklahoma 73160 OKC Other Unassigned Open Reply now Overdue by 7d Nov 17 |
| 261 | chip | P3 |
| 262 | button | Select ticket 4975 |
| 263 | button | P3 Quarterly property review: 11249 Pegasus Dr #4944 11249 Pegasus Dr, Noblesville, Indiana 46060 Indy Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 264 | chip | P3 |
| 265 | button | Select ticket 4944 |
| 266 | button | P3 Quarterly property review: 64 Turtle Loop #4945 64 Turtle Loop, Eufaula, Oklahoma 74432 Carlton Landing Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 267 | chip | P3 |
| 268 | button | Select ticket 4945 |
| 269 | button | P3 Quarterly property review: 7317 NW 159th Ter #4946 7317 NW 159th Ter, Edmond, Oklahoma 73013 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 270 | chip | P3 |
| 271 | button | Select ticket 4946 |
| 272 | button | P3 Quarterly property review: 2901 E 75th St #4947 2901 E 75th St, Tulsa, Oklahoma 74136 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 273 | chip | P3 |
| 274 | button | Select ticket 4947 |
| 275 | button | P3 Quarterly property review: 85 Lower Green Way #4948 85 Lower Green Way, Eufaula, Oklahoma 74432 Carlton Landing Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 276 | chip | P3 |
| 277 | button | Select ticket 4948 |
| 278 | button | P3 Quarterly property review: 13325 E 43rd Pl S #4949 13325 E 43rd Pl S, Tulsa, Oklahoma 74134 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 279 | chip | P3 |
| 280 | button | Select ticket 4949 |
| 281 | button | P3 Quarterly property review: 1722 Westchester Dr #4950 1722 Westchester Dr, The Village, Oklahoma 73120 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 282 | chip | P3 |
| 283 | button | Select ticket 4950 |
| 284 | button | P3 Quarterly property review: 4513 Black Mesa Lane #4951 4513 Black Mesa Lane, Yukon, Oklahoma 73099 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 285 | chip | P3 |
| 286 | button | Select ticket 4951 |
| 287 | button | P3 Quarterly property review: 1056 Wildwood Dr. #4952 1056 Wildwood Dr., Joshua, Texas 76058 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 288 | chip | P3 |
| 289 | button | Select ticket 4952 |
| 290 | button | P3 Quarterly property review: 9008 Scarlet Blvd #4953 9008 Scarlet Blvd, Yukon, Oklahoma 73099 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 291 | chip | P3 |
| 292 | button | Select ticket 4953 |
| 293 | button | P3 Quarterly property review: 10320 Lightning Creek Dr #4954 10320 Lightning Creek Dr, Yukon, Oklahoma 73099 OKC Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 294 | chip | P3 |
| 295 | button | Select ticket 4954 |
| 296 | button | P3 Quarterly property review: 1152 Western Yarrow Ave #4955 1152 Western Yarrow Ave, Justin, Texas 76247 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 297 | chip | P3 |
| 298 | button | Select ticket 4955 |
| 299 | button | P3 Quarterly property review: 721 Vaquero St. #4956 721 Vaquero St., White Settlement, Texas 76108 Fort Worth Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 300 | chip | P3 |
| 301 | button | Select ticket 4956 |
| 302 | button | P3 Quarterly property review: 1600 E Quantico St #4957 1600 E Quantico St, Broken Arrow, Oklahoma 74011 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 303 | chip | P3 |
| 304 | button | Select ticket 4957 |
| 305 | button | P3 Quarterly property review: 11514 S. Locust Ave #4958 11514 S. Locust Ave, Jenks, Oklahoma 74037 Tulsa Quarterly inspection review Micah Sinor Open Start work Overdue by 7d Nov 17 |
| 306 | chip | P3 |
| 307 | button | Select ticket 4958 |
| 308 | button | P3 Worn dreeeser #4997 5512 Hidden Trail lane, Warr Acres, Oklahoma 73132 OKC Other Unassigned Open Reply now Overdue by 6d Nov 18 |
| 309 | chip | P3 |
| 310 | button | Select ticket 4997 |
| 311 | button | P3 Yard #4998 1169 Blue Sky Lane, Burleson, Texas 76028 Fort Worth Other Unassigned Open Reply now Overdue by 6d Nov 18 |
| 312 | chip | P3 |
| 313 | button | Select ticket 4998 |
| 314 | button | P3 walls #4999 7006 E 154th St S, Bixby, Oklahoma 74008 Tulsa Other Unassigned Open Reply now Overdue by 6d Nov 18 |
| 315 | chip | P3 |
| 316 | button | Select ticket 4999 |
| 317 | button | P3 Trash #5025 4003 Bendale Rd, Benbrook, Texas 76116 Fort Worth Other Unassigned Open Reply now Overdue by 5d Nov 19 |
| 318 | chip | P3 |
| 319 | button | Select ticket 5025 |
| 320 | button | P3 Bedroom near bathroom smells like dog urine #5027 10320 Lightning Creek Dr, Yukon, Oklahoma 73099 OKC Other Unassigned Open Reply now Overdue by 5d Nov 19 |
| 321 | chip | P3 |
| 322 | button | Select ticket 5027 |
| 323 | button | P3 Carpet stain #5028 10320 Lightning Creek Dr, Yukon, Oklahoma 73099 OKC Other Unassigned Open Reply now Overdue by 5d Nov 19 |
| 324 | chip | P3 |
| 325 | button | Select ticket 5028 |
| 326 | button | P3 Quarterly property review: 5253 Tracey Jo Rd #5023 5253 Tracey Jo Rd, Greenwood, Indiana 46142 Indy Quarterly inspection review James Almario Leadership Open Start work Overdue by 5d Nov 19 |
| 327 | chip | P3 |
| 328 | button | Select ticket 5023 |
| 329 | button | P3 Landscaping #5049 11508 E 94th Pl N, Owasso, Oklahoma 74055 Tulsa Other Unassigned Open Reply now Overdue by 4d Nov 20 |
| 330 | chip | P3 |
| 331 | button | Select ticket 5049 |
| 332 | button | P3 Touch up paint #5065 10121 E 131st Pl S, Bixby, Oklahoma 74008 Tulsa Other Unassigned Open Reply now Overdue by 3d Nov 21 |
| 333 | chip | P3 |
| 334 | button | Select ticket 5065 |
| 335 | button | P3 Landscaping #5066 10121 E 131st Pl S, Bixby, Oklahoma 74008 Tulsa Other Unassigned Open Reply now Overdue by 3d Nov 21 |
| 336 | chip | P3 |
| 337 | button | Select ticket 5066 |
| 338 | button | P3 Light fixtures require replacing #5076 4718 E Shadowbrook Dr, Camby, Indiana 46113 Indy Other Unassigned Open Reply now Overdue by 2d Nov 22 |
| 339 | chip | P3 |
| 340 | button | Select ticket 5076 |
| 341 | button | P3 Broken kitchen chair #5078 817 Halley Dr., Moore, Oklahoma 73160 OKC Other Unassigned Open Reply now Overdue by 2d Nov 22 |
| 342 | chip | P3 |
| 343 | button | Select ticket 5078 |
| 344 | button | P3 Dog poop #5079 1152 Western Yarrow Ave, Justin, Texas 76247 Fort Worth Other Unassigned Open Reply now Overdue by 2d Nov 22 |
| 345 | chip | P3 |
| 346 | button | Select ticket 5079 |
| 347 | button | P3 Package #5080 4003 Bendale Rd, Benbrook, Texas 76116 Fort Worth Other Unassigned Open Reply now Overdue by 2d Nov 22 |
| 348 | chip | P3 |
| 349 | button | Select ticket 5080 |
| 350 | button | P3 Broken towel rack #5081 628 Joy Ct, Burleson, Texas 76028 Fort Worth Other Unassigned Open Reply now Overdue by 2d Nov 22 |
| 351 | chip | P3 |
| 352 | button | Select ticket 5081 |
| 353 | button | P3 Reservation #107555754 #5095 2522 S. Irvington Ave, Tulsa, Oklahoma 74114 Tulsa Other Unassigned Open Reply now Overdue by 35h Nov 23 |
| 354 | chip | P3 |
| 355 | button | Select ticket 5095 |
| 356 | button | P3 Damage to kitchen table top #5096 3333 Welling Rd, Edmond, Oklahoma 73012 OKC Other Unassigned Open Reply now Overdue by 34h Nov 23 |
| 357 | chip | P3 |
| 358 | button | Select ticket 5096 |
| 359 | button | P3 Needs a smoke alarm #5097 9120 Yassir Blvd, Yukon, Oklahoma 73099 OKC Other Unassigned Open Reply now Overdue by 34h Nov 23 |
| 360 | chip | P3 |
| 361 | button | Select ticket 5097 |
| 362 | button | P3 Smoke alarm #5098 9120 Yassir Blvd, Yukon, Oklahoma 73099 OKC Other Unassigned Open Reply now Overdue by 34h Nov 23 |
| 363 | chip | P3 |
| 364 | button | Select ticket 5098 |
| 365 | button | P3 3 broken coasters #5101 3333 Welling Rd, Edmond, Oklahoma 73012 OKC Other Unassigned Open Reply now Overdue by 30h Nov 23 |
| 366 | chip | P3 |
| 367 | button | Select ticket 5101 |
| 368 | button | P3 Quarterly property review: 19104 Meadows Crossing Dr. #4891 19104 Meadows Crossing Dr., Edmond, Oklahoma 73012 OKC Quarterly inspection review Micah Sinor In progress Nov 23 Overdue by 1 day Nov 16 |
| 369 | chip | P3 |
| 370 | button | Select ticket 4891 |
| 371 | button | P3 Reservation #107883011 #5124 33 Center Ln S, Carlton Landing, Oklahoma 74332 Carlton Landing Other Unassigned Open Reply now Overdue by 14h Today 7:20 AM |
| 372 | chip | P3 |
| 373 | button | Select ticket 5124 |
| 374 | button | P3 Couch has small tear #5125 2004 Cedar Ridge Rd, Edmond, Oklahoma 73013 OKC Other Unassigned Open Reply now Overdue by 11h Today 10:17 AM |
| 375 | chip | P3 |
| 376 | button | Select ticket 5125 |
| 377 | button | P3 Broken chair #5126 207 High Point Way, Justin, Texas 76247 Fort Worth Other Unassigned Open Reply now Overdue by 10h Today 10:28 AM |
| 378 | chip | P3 |
| 379 | button | Select ticket 5126 |
| 380 | button | P3 Linens ruined. #5127 207 High Point Way, Justin, Texas 76247 Fort Worth Other Unassigned Open Reply now Overdue by 10h Today 10:31 AM |
| 381 | chip | P3 |
| 382 | button | Select ticket 5127 |
| 383 | button | P3 Excessive trash. #5128 207 High Point Way, Justin, Texas 76247 Fort Worth Other Unassigned Open Reply now Overdue by 10h Today 10:32 AM |
| 384 | chip | P3 |
| 385 | button | Select ticket 5128 |
| 386 | button | P3 Broken lamp #5129 2004 Cedar Ridge Rd, Edmond, Oklahoma 73013 OKC Other Unassigned Open Reply now Overdue by 10h Today 11:03 AM |
| 387 | chip | P3 |
| 388 | button | Select ticket 5129 |
| 389 | button | P3 downstairs bathroom #5130 7422 S. Granite Ave, Tulsa, Oklahoma 74136 Tulsa Other Unassigned Open Reply now Overdue by 9h Today 12:02 PM |
| 390 | chip | P3 |
| 391 | button | Select ticket 5130 |
| 392 | button | P3 Trash outside by front door #5131 3201 Belmont Circle, Edmond, Oklahoma 73034 OKC Other Unassigned Open Reply now Overdue by 5h Today 3:54 PM |
| 393 | chip | P3 |
| 394 | button | Select ticket 5131 |
| 395 | button | Kanban |
| 396 | button | Calendar |
| 397 | heading | Pick up work |
| 398 | button, filter | Team A 0 |
| 399 | button, filter | Team B 40 |
| 400 | button, filter | All teams 40 |
| 401 | button, filter | All unclaimed 40 |
| 402 | heading | From Breezeway |
| 403 | chip | Breezeway |
| 404 | chip | P3 |
| 405 | button | Open in Breezeway |
| 406 | button | Take it |
| 407 | chip | Breezeway |
| 408 | chip | P3 |
| 409 | button | Open in Breezeway |
| 410 | button | Take it |
| 411 | chip | Breezeway |
| 412 | chip | P3 |
| 413 | button | Open in Breezeway |
| 414 | button | Take it |
| 415 | chip | Breezeway |
| 416 | chip | P3 |
| 417 | button | Open in Breezeway |
| 418 | button | Take it |
| 419 | chip | Breezeway |
| 420 | chip | P3 |
| 421 | button | Open in Breezeway |
| 422 | button | Take it |
| 423 | chip | Breezeway |
| 424 | chip | P3 |
| 425 | button | Open in Breezeway |
| 426 | button | Take it |
| 427 | chip | Breezeway |
| 428 | chip | P3 |
| 429 | button | Open in Breezeway |
| 430 | button | Take it |
| 431 | chip | Breezeway |
| 432 | chip | P3 |
| 433 | button | Open in Breezeway |
| 434 | button | Take it |
| 435 | chip | Breezeway |
| 436 | chip | P3 |
| 437 | button | Open in Breezeway |
| 438 | button | Take it |
| 439 | chip | Breezeway |
| 440 | chip | P3 |
| 441 | button | Open in Breezeway |
| 442 | button | Take it |
| 443 | chip | Breezeway |
| 444 | chip | P3 |
| 445 | button | Open in Breezeway |
| 446 | button | Take it |
| 447 | chip | Breezeway |
| 448 | chip | P3 |
| 449 | button | Open in Breezeway |
| 450 | button | Take it |
| 451 | chip | Breezeway |
| 452 | chip | P3 |
| 453 | button | Open in Breezeway |
| 454 | button | Take it |
| 455 | chip | Breezeway |
| 456 | chip | P3 |
| 457 | button | Open in Breezeway |
| 458 | button | Take it |
| 459 | chip | Breezeway |
| 460 | chip | P3 |
| 461 | button | Open in Breezeway |
| 462 | button | Take it |
| 463 | chip | Breezeway |
| 464 | chip | P3 |
| 465 | button | Open in Breezeway |
| 466 | button | Take it |
| 467 | chip | Breezeway |
| 468 | chip | P3 |
| 469 | button | Open in Breezeway |
| 470 | button | Take it |
| 471 | chip | Breezeway |
| 472 | chip | P3 |
| 473 | button | Open in Breezeway |
| 474 | button | Take it |
| 475 | chip | Breezeway |
| 476 | chip | P3 |
| 477 | button | Open in Breezeway |
| 478 | button | Take it |
| 479 | chip | Breezeway |
| 480 | chip | P3 |
| 481 | button | Open in Breezeway |
| 482 | button | Take it |
| 483 | chip | Breezeway |
| 484 | chip | P3 |
| 485 | button | Open in Breezeway |
| 486 | button | Take it |
| 487 | chip | Breezeway |
| 488 | chip | P3 |
| 489 | button | Open in Breezeway |
| 490 | button | Take it |
| 491 | chip | Breezeway |
| 492 | chip | P3 |
| 493 | button | Open in Breezeway |
| 494 | button | Take it |
| 495 | chip | Breezeway |
| 496 | chip | P3 |
| 497 | button | Open in Breezeway |
| 498 | button | Take it |
| 499 | chip | Breezeway |
| 500 | chip | P3 |
| 501 | button | Open in Breezeway |
| 502 | button | Take it |
| 503 | chip | Breezeway |
| 504 | chip | P3 |
| 505 | button | Open in Breezeway |
| 506 | button | Take it |
| 507 | chip | Breezeway |
| 508 | chip | P3 |
| 509 | button | Open in Breezeway |
| 510 | button | Take it |
| 511 | chip | Breezeway |
| 512 | chip | P3 |
| 513 | button | Open in Breezeway |
| 514 | button | Take it |
| 515 | chip | Breezeway |
| 516 | chip | P3 |
| 517 | button | Open in Breezeway |
| 518 | button | Take it |
| 519 | chip | Breezeway |
| 520 | chip | P3 |
| 521 | button | Open in Breezeway |
| 522 | button | Take it |
| 523 | chip | Breezeway |
| 524 | chip | P3 |
| 525 | button | Open in Breezeway |
| 526 | button | Take it |
| 527 | chip | Breezeway |
| 528 | chip | P3 |
| 529 | button | Open in Breezeway |
| 530 | button | Take it |
| 531 | chip | Breezeway |
| 532 | chip | P3 |
| 533 | button | Open in Breezeway |
| 534 | button | Take it |
| 535 | chip | Breezeway |
| 536 | chip | P3 |
| 537 | button | Open in Breezeway |
| 538 | button | Take it |
| 539 | chip | Breezeway |
| 540 | chip | P3 |
| 541 | button | Open in Breezeway |
| 542 | button | Take it |
| 543 | chip | Breezeway |
| 544 | chip | P3 |
| 545 | button | Open in Breezeway |
| 546 | button | Take it |
| 547 | chip | Breezeway |
| 548 | chip | P3 |
| 549 | button | Open in Breezeway |
| 550 | button | Take it |
| 551 | chip | Breezeway |
| 552 | chip | P3 |
| 553 | button | Open in Breezeway |
| 554 | button | Take it |
| 555 | chip | Breezeway |
| 556 | chip | P3 |
| 557 | button | Open in Breezeway |
| 558 | button | Take it |
| 559 | chip | Breezeway |
| 560 | chip | P3 |
| 561 | button | Open in Breezeway |
| 562 | button | Take it |
| 563 | heading | Imported from Notion |
| 564 | button | Show |
| 565 | card | Last 24 hours (115) |
| 566 | heading | Last 24 hours (115) |
| 567 | card | Overdue (91) |
| 568 | heading | Overdue (91) |
| 569 | card | Unassigned (129) |
| 570 | heading | Unassigned (129) |
| 571 | card | Refunds waiting on approval (0) |
| 572 | heading | Refunds waiting on approval (0) |
| 573 | card | Repeat problems this week (2) |
| 574 | heading | Repeat problems this week (2) |
| 575 | button | 4003 Bendale Rd Arrival check: 3 times in 90 days at this home. |
| 576 | button | 10121 E 131st Pl S Arrival check: 3 times in 90 days at this home. |
| 577 | card | Guest rating channels |
| 578 | heading | Guest rating channels |
| 579 | button | Airbnb |
| 580 | button | Vrbo |
| 581 | button | Booking.com |
| 582 | button | Direct |
| 583 | button | Google |
| 584 | button | Save (disabled) |

**Appears more than once:** chip: P2 × 24; chip: P3 × 135; chip: Breezeway × 40; button: Open in Breezeway × 40; button: Take it × 40.

### phone-prepare-handoffs.png

Screen: Prepare handoffs. Viewer: Emily. PNG: 390 × 844.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Search Resolve |
| 2 | button | Record work |
| 3 | button | Record routine work |
| 4 | button | Toggle Sidebar |
| 5 | button | Take the tour |
| 6 | button | Alerts and escalations |
| 7 | button | Chats, 1 unread |
| 8 | button | Notifications |
| 9 | button | Switch to dark mode |
| 10 | chip | 1 |
| 11 | button | lucide-layout-grid |
| 12 | button | Sign out (Admin) |
| 13 | heading | Prepare handoffs |
| 14 | button | Hand off all (disabled) |
| 15 | card | Due today (1) |
| 16 | heading | Due today (1) |
| 17 | filter | Done so far |
| 18 | filter | Next step |
| 19 | button | Hand off to James Almario (disabled) |
| 20 | button | Help & Feedback |

**Appears more than once:** No exact repeated label detected in the counted foreground surface..

### phone-guest-ready-standards.png

Screen: Guest-ready standards. Viewer: Emily. PNG: 390 × 1190.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Search Resolve |
| 2 | button | Record work |
| 3 | button | Record routine work |
| 4 | button | Toggle Sidebar |
| 5 | button | Take the tour |
| 6 | button | Alerts and escalations |
| 7 | button | Chats, 1 unread |
| 8 | button | Notifications |
| 9 | button | Switch to dark mode |
| 10 | chip | 1 |
| 11 | button | lucide-layout-grid |
| 12 | button | Sign out (Admin) |
| 13 | heading | Guest-ready standards |
| 14 | button | Add ticket type |
| 15 | table | Table |
| 16 | button | Edit |
| 17 | button | Edit |
| 18 | button | Edit |
| 19 | button | Help & Feedback |
| 20 | button | Edit |
| 21 | button | Edit |
| 22 | button | Edit |
| 23 | button | Edit |

**Appears more than once:** button: Edit × 7.

### phone-coordinator-team-b-home.png

Screen: Home with Needs you now. Viewer: Property Coordinator Team B view. PNG: 390 × 2339.

Role preview note: Existing View as supports Property Coordinator only, not a Team A or Team B identity. Emily remains signed in. Home and menu are the same generic coordinator preview; the queue chip selects the named team. These are not separate coordinator accounts or team-specific Home previews.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Search Resolve |
| 2 | button | Toggle Sidebar |
| 3 | button | Take the tour |
| 4 | button | Chats, 1 unread |
| 5 | button | Notifications |
| 6 | button | Switch to dark mode |
| 7 | button | lucide-layout-grid |
| 8 | chip | 1 |
| 9 | button | Sign out (Property Coordinator) |
| 10 | banner | Viewing as Property Coordinator. You can look around, but nothing can be changed. Stop viewing as |
| 11 | button | Stop viewing as |
| 12 | heading | Good morning, Emily. |
| 13 | card | Needs you now |
| 14 | heading | Needs you now |
| 15 | button | ALE Direct booking you started. Reply within 3 minutes. |
| 16 | button | Owlmarketplace Direct booking you started. Reply within 3 minutes. |
| 17 | button | Crsth Direct booking you started. Reply within 3 minutes. |
| 18 | button | Help & Feedback |
| 19 | button | ale Direct booking you started. Reply within 3 minutes. |
| 20 | button | Direct booking request Direct booking you started. Reply within 3 minutes. |
| 21 | card | My work |
| 22 | heading | My work |
| 23 | button | Team queue (0 unclaimed) |
| 24 | button, tab | Active1 |
| 25 | button, tab | Waiting0 |
| 26 | button, tab | Done recently0 |
| 27 | button, tab | All |
| 28 | button, tab | P1 |
| 29 | button, tab | P2 |
| 30 | button, tab | P3 |
| 31 | button, tab | List |
| 32 | button, tab | Board |
| 33 | filter | Search my work |
| 34 | button | 3915 W 104th St S, Jenks, Oklahoma 74037 Scheduled Pest Control Keep the work moving Due Nov 23 P2 |
| 35 | card | Routine work due today |
| 36 | heading | Routine work due today |
| 37 | button | Record routine work |
| 38 | card | My shift |
| 39 | heading | My shift |
| 40 | button | Request time off |
| 41 | button | End my shift |
| 42 | card | Recent activity (1) |
| 43 | heading | Recent activity (1) |
| 44 | button | Show |

**Appears more than once:** No exact repeated label detected in the counted foreground surface..

### phone-coordinator-team-b-left-menu-open.png

Screen: Left menu fully open. Viewer: Property Coordinator Team B view. PNG: 390 × 844.

Role preview note: Existing View as supports Property Coordinator only, not a Team A or Team B identity. Emily remains signed in. Home and menu are the same generic coordinator preview; the queue chip selects the named team. These are not separate coordinator accounts or team-specific Home previews.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Resolve OPERATIONS |
| 2 | heading | MY DAY |
| 3 | button | Home |
| 4 | button | Team Queue |
| 5 | button | Direct Bookings |
| 6 | button | Work Orders |
| 7 | button | Databases |
| 8 | button | Guest Claims & Refunds |
| 9 | heading | TEAM |
| 10 | button | Team and Coverage |
| 11 | button | Playbooks |
| 12 | button | Guest-ready standards |
| 13 | heading | HOMES AND OWNERS |
| 14 | button | Properties |
| 15 | button | My account |

**Appears more than once:** No exact repeated label detected in the counted foreground surface..

### phone-coordinator-team-b-team-queue.png

Screen: Team Queue. Viewer: Property Coordinator Team B view. PNG: 390 × 13337.

Role preview note: Existing View as supports Property Coordinator only, not a Team A or Team B identity. Emily remains signed in. Home and menu are the same generic coordinator preview; the queue chip selects the named team. These are not separate coordinator accounts or team-specific Home previews.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Search Resolve |
| 2 | button | Toggle Sidebar |
| 3 | button | Take the tour |
| 4 | button | Chats, 1 unread |
| 5 | button | Notifications |
| 6 | button | Switch to dark mode |
| 7 | button | lucide-layout-grid |
| 8 | chip | 1 |
| 9 | button | Sign out (Property Coordinator) |
| 10 | banner | Viewing as Property Coordinator. You can look around, but nothing can be changed. Stop viewing as |
| 11 | button | Stop viewing as |
| 12 | heading | Team Queue |
| 13 | filter | Search by title or home |
| 14 | button | Filter 1 |
| 15 | button | Clear 1 filter |
| 16 | button, tab | All team 117 |
| 17 | button, tab | Team A 3 |
| 18 | button, tab | Team B 140 |
| 19 | button, tab | Only mine 1 |
| 20 | chip | 117 |
| 21 | chip | 3 |
| 22 | chip | 140 |
| 23 | button, filter | Priority |
| 24 | button, filter | Status |
| 25 | button, filter | Person |
| 26 | button, tab | Maintenance 73 |
| 27 | button, tab | Reported issues 13 |
| 28 | button, tab | Cleaning reviews 0 |
| 29 | chip | 73 |
| 30 | chip | 13 |
| 31 | button, filter | Due today 73 |
| 32 | button, filter | This week 91 |
| 33 | button, filter | Next week 0 |
| 34 | button, filter | Closed 14 |
| 35 | table | Table |
| 36 | button | Help & Feedback |
| 37 | button | New House Setup - Stage Decor |
| 38 | button | Stock Supply Box |
| 39 | button | Change Smoke Detector Batteries |
| 40 | button | New House Setup - Press Curtains |
| 41 | button | Island is missing a piece of wood and it needs paint touch up |
| 42 | button | Install Air Filters |
| 43 | button | New House Setup - Setting Up ROKU TVs & Storing Remotes |
| 44 | button | Spare Front Door Key |
| 45 | button | Carpet Cleaning + Curtain Replacement |
| 46 | button | Hall bath tub - stopper |
| 47 | button | Fireplace not working + clogged toilet |
| 48 | button | Onsite Inspection & Quote Collection – 401 E. 10th St. |
| 49 | button | Haulaway Bins |
| 50 | button | Repair Loose Front Door Handle & Toilet Paper Holder – 9211 |
| 51 | button | Repair Broken Dining Chair – 817 Halley Dr. |
| 52 | button | Amazon Return: Ironing Board |
| 53 | button | carpet cleaning |
| 54 | button | Inspect and Repair AC Unit – 2617 W Madison St |
| 55 | button | New House Setup - Prep Property / Meet Photographer |
| 56 | button | Delivering the TV remote |
| 57 | button | Front Door Lock - Low Battery |
| 58 | button | Trash Removal and Disposal – 3333 Welling Rd |
| 59 | button | Remove and Dispose of Excess Trash – 19013 Meadows Crossing |
| 60 | button | Bathroom Vanity Lights Flickering – Inspection and Repair |
| 61 | button | Front Door Lock - Low Battery |
| 62 | button | Carpet stain |
| 63 | button | Carpet/ rug shampooing. |
| 64 | button | Back patio/furniture |
| 65 | button | Driveway stains. |
| 66 | button | trash haulaway |
| 67 | button | Front Door Lock - Low Battery |
| 68 | button | Purchase and Install Garage Door Opener – 9120 Yassir |
| 69 | button | Check Low Water Pressure in Bathroom – 3000 |
| 70 | button | Trash Removal Before Guest Check-In |
| 71 | button | Dead Animal Removal – 10320 |
| 72 | button | fix drywall hole |
| 73 | button | Recharge Ring Doorbell Camera |
| 74 | button | Front Door Lock - Low Battery |
| 75 | button | TEST - Work Order Instructions for Breezeway |
| 76 | button | Front Door Lock - Low Battery |
| 77 | button | Walmart Return Items |
| 78 | button | Bedroom Carpet Cleaning – Dog Urine Odor |
| 79 | button | Light fixtures require replacing |
| 80 | button | Haulaway |
| 81 | button | Front Door Lock - Low Battery |
| 82 | button | Front Door Lock - Low Battery |
| 83 | button | Front Door Lock - Low Battery |
| 84 | button | Kitchen Disposal Replacement |
| 85 | button | Reservation #64895038 |
| 86 | button | Shower Curtain Replacement |
| 87 | button | Haulaway Bins |
| 88 | button | Haul the trash + Broken Bed Board |
| 89 | button | loose toilet |
| 90 | button | The Master Bather Shower is Faulty |
| 91 | button | Inspect and Repair Master Bathroom Shower Head |
| 92 | button | Front Door Lock - Low Battery |
| 93 | button | Garage Door is Broken. |
| 94 | table | Open tickets |
| 95 | button | P2, hide rows |
| 96 | chip | P2 |
| 97 | button | Guest review: Reported issue: Shower head is not working properly. Needs fixing. Manual 2016 NW 172ND, Edmond, Oklahoma 73012 OKC P2 Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 7d Nov 17 |
| 98 | button | Add an update to ticket 4976 |
| 99 | button | The washer at 7422 has a reported broken timer and may require repair or replacement. Please review the previous updates, confirm the washer Manual 7422 S. Granite Ave, Tulsa, Oklahoma 74136 Tulsa P2 Immediate maintenance Qym Fuenteblanca Team B Open Start work Overdue by 7d Nov 17 |
| 100 | button | Add an update to ticket 4978 |
| 101 | button | The garage door is broken. It came off the track Manual 5020 S 168th East Ave, Tulsa, Oklahoma 74134 Tulsa P2 Maintenance and landscaping work-order review Qym Fuenteblanca Team B In progress Nov 17 Overdue by 7 days Nov 17 |
| 102 | button | Add an update to ticket 4974 |
| 103 | button | 2014 - get carpet quote to replace Manual 2014 E 52nd St, Tulsa, Oklahoma 74105 Tulsa P2 Other Romeo Canales Team B Waiting on owner Nov 20 · 8:00 AM Overdue by 5d Nov 3 |
| 104 | button | Add an update to ticket 1509 |
| 105 | button | to reach out to owner on considering to replace the carpet Manual 3712 N 39th St., Broken Arrow, Oklahoma 74014 Tulsa P2 Ongoing maintenance Romeo Canales Team B Open Start work Overdue by 4d Nov 20 |
| 106 | button | Add an update to ticket 5048 |
| 107 | button | 16401 - dryer not working Manual 16401 Villa Valeria Way, Edmond, Oklahoma 73013 OKC P2 Other Romeo Canales Team B Open Reply now Overdue by 4d Oct 27 |
| 108 | button | Add an update to ticket 1476 |
| 109 | button | 5923 - yale lock disconnected Manual 5923 Hollyhock Ln, Montgomery, Texas 77316 Houston P2 Other Romeo Canales Team B Waiting on vendor Nov 23 · 8:00 AM Overdue by 39h Oct 29 |
| 110 | button | Add an update to ticket 1487 |
| 111 | button | one of dining chairs was broken Manual 4607 W Union St, Broken Arrow, Oklahoma 74011 Tulsa P2 Immediate maintenance Qym Fuenteblanca Team B Open Start work Overdue by 29h Nov 23 |
| 112 | button | Add an update to ticket 5104 |
| 113 | button | 7006 project. This home is missing quite a few standard items that we need ordered and then a few things need replaced. Manual 7006 E 154th St S, Bixby, Oklahoma 74008 Tulsa P2 Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 29h Nov 23 |
| 114 | button | Add an update to ticket 5102 |
| 115 | button | bathroom mirror broken Manual 18200 Bodegon Rd., Edmond, Oklahoma 73012 OKC P2 Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 29h Nov 23 |
| 116 | button | Add an update to ticket 5103 |
| 117 | button | small tear/rip in couch Manual 2004 Cedar Ridge Rd, Edmond, Oklahoma 73013 OKC P2 Ongoing maintenance Romeo Canales Team B Open Start work Overdue by 6h Today 4:43 PM |
| 118 | button | Add an update to ticket 5132 |
| 119 | button | broken coasters Manual 3333 Welling Rd, Edmond, Oklahoma 73012 OKC P2 Ongoing maintenance Romeo Canales Team B Open Start work Overdue by 6h Today 4:46 PM |
| 120 | button | Add an update to ticket 5133 |
| 121 | button | towel rack repair Manual 628 Joy Ct, Burleson, Texas 76028 Fort Worth P2 Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:04 PM |
| 122 | button | Add an update to ticket 5134 |
| 123 | button | repair dining chair Manual 817 Halley Dr., Moore, Oklahoma 73160 OKC P2 Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:06 PM |
| 124 | button | Add an update to ticket 5135 |
| 125 | button | backyard needs mowed Manual 1169 Blue Sky Lane, Burleson, Texas 76028 Fort Worth P2 Ongoing maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:23 PM |
| 126 | button | Add an update to ticket 5136 |
| 127 | button | toilet paper holder Manual 845 Alexandria Ln, Joshua, Texas 76058-6216 Fort Worth P2 Immediate maintenance Qym Fuenteblanca Team B Open Start work Overdue by 5h Today 5:52 PM |
| 128 | button | Add an update to ticket 5137 |
| 129 | button | Kanban |
| 130 | button | Calendar |
| 131 | heading | Pick up work |
| 132 | button, filter | Team A 0 |
| 133 | button, filter | Team B 40 |
| 134 | button, filter | All teams 40 |
| 135 | button, filter | All unclaimed 40 |
| 136 | heading | From Breezeway |
| 137 | chip | Breezeway |
| 138 | chip | P3 |
| 139 | button | Open in Breezeway |
| 140 | chip | Breezeway |
| 141 | chip | P3 |
| 142 | button | Open in Breezeway |
| 143 | chip | Breezeway |
| 144 | chip | P3 |
| 145 | button | Open in Breezeway |
| 146 | chip | Breezeway |
| 147 | chip | P3 |
| 148 | button | Open in Breezeway |
| 149 | chip | Breezeway |
| 150 | chip | P3 |
| 151 | button | Open in Breezeway |
| 152 | chip | Breezeway |
| 153 | chip | P3 |
| 154 | button | Open in Breezeway |
| 155 | chip | Breezeway |
| 156 | chip | P3 |
| 157 | button | Open in Breezeway |
| 158 | chip | Breezeway |
| 159 | chip | P3 |
| 160 | button | Open in Breezeway |
| 161 | chip | Breezeway |
| 162 | chip | P3 |
| 163 | button | Open in Breezeway |
| 164 | chip | Breezeway |
| 165 | chip | P3 |
| 166 | button | Open in Breezeway |
| 167 | chip | Breezeway |
| 168 | chip | P3 |
| 169 | button | Open in Breezeway |
| 170 | chip | Breezeway |
| 171 | chip | P3 |
| 172 | button | Open in Breezeway |
| 173 | chip | Breezeway |
| 174 | chip | P3 |
| 175 | button | Open in Breezeway |
| 176 | chip | Breezeway |
| 177 | chip | P3 |
| 178 | button | Open in Breezeway |
| 179 | chip | Breezeway |
| 180 | chip | P3 |
| 181 | button | Open in Breezeway |
| 182 | chip | Breezeway |
| 183 | chip | P3 |
| 184 | button | Open in Breezeway |
| 185 | chip | Breezeway |
| 186 | chip | P3 |
| 187 | button | Open in Breezeway |
| 188 | chip | Breezeway |
| 189 | chip | P3 |
| 190 | button | Open in Breezeway |
| 191 | chip | Breezeway |
| 192 | chip | P3 |
| 193 | button | Open in Breezeway |
| 194 | chip | Breezeway |
| 195 | chip | P3 |
| 196 | button | Open in Breezeway |
| 197 | chip | Breezeway |
| 198 | chip | P3 |
| 199 | button | Open in Breezeway |
| 200 | chip | Breezeway |
| 201 | chip | P3 |
| 202 | button | Open in Breezeway |
| 203 | chip | Breezeway |
| 204 | chip | P3 |
| 205 | button | Open in Breezeway |
| 206 | chip | Breezeway |
| 207 | chip | P3 |
| 208 | button | Open in Breezeway |
| 209 | chip | Breezeway |
| 210 | chip | P3 |
| 211 | button | Open in Breezeway |
| 212 | chip | Breezeway |
| 213 | chip | P3 |
| 214 | button | Open in Breezeway |
| 215 | chip | Breezeway |
| 216 | chip | P3 |
| 217 | button | Open in Breezeway |
| 218 | chip | Breezeway |
| 219 | chip | P3 |
| 220 | button | Open in Breezeway |
| 221 | chip | Breezeway |
| 222 | chip | P3 |
| 223 | button | Open in Breezeway |
| 224 | chip | Breezeway |
| 225 | chip | P3 |
| 226 | button | Open in Breezeway |
| 227 | chip | Breezeway |
| 228 | chip | P3 |
| 229 | button | Open in Breezeway |
| 230 | chip | Breezeway |
| 231 | chip | P3 |
| 232 | button | Open in Breezeway |
| 233 | chip | Breezeway |
| 234 | chip | P3 |
| 235 | button | Open in Breezeway |
| 236 | chip | Breezeway |
| 237 | chip | P3 |
| 238 | button | Open in Breezeway |
| 239 | chip | Breezeway |
| 240 | chip | P3 |
| 241 | button | Open in Breezeway |
| 242 | chip | Breezeway |
| 243 | chip | P3 |
| 244 | button | Open in Breezeway |
| 245 | chip | Breezeway |
| 246 | chip | P3 |
| 247 | button | Open in Breezeway |
| 248 | chip | Breezeway |
| 249 | chip | P3 |
| 250 | button | Open in Breezeway |
| 251 | chip | Breezeway |
| 252 | chip | P3 |
| 253 | button | Open in Breezeway |
| 254 | chip | Breezeway |
| 255 | chip | P3 |
| 256 | button | Open in Breezeway |
| 257 | heading | Imported from Notion |
| 258 | button | Show |

**Appears more than once:** button: Haulaway Bins × 2; button: Front Door Lock - Low Battery × 9; chip: Breezeway × 40; chip: P3 × 40; button: Open in Breezeway × 40.

### phone-coordinator-team-b-open-ticket-panel.png

Screen: Open ticket panel. Viewer: Property Coordinator Team B view. PNG: 390 × 1657.

Role preview note: Existing View as supports Property Coordinator only, not a Team A or Team B identity. Emily remains signed in. Home and menu are the same generic coordinator preview; the queue chip selects the named team. These are not separate coordinator accounts or team-specific Home previews.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Open full page |
| 2 | button | Close Ticket |
| 3 | heading | Ticket |
| 4 | heading | Guest review: Reported issue: Shower head is not working properly. Needs fixing. |
| 5 | button | More |
| 6 | heading | Corrective commitment |
| 7 | button | Add a commitment |
| 8 | chip | Logged |
| 9 | chip | Fix it |
| 10 | chip | Done |
| 11 | heading | Do this now |
| 12 | heading | Start work |
| 13 | button | Waiting on someone? |
| 14 | card | Make it right |
| 15 | button | lucide-chevron-down |
| 16 | heading | Make it right |
| 17 | heading | DETAILS |
| 18 | filter | Add an update: who you called, what the vendor found, what the guest said… |
| 19 | button | lucide-building-2 |
| 20 | button | lucide-send (disabled) |
| 21 | button | lucide-send (disabled) |
| 22 | heading | Unnamed heading |
| 23 | button, filter | Active-stay impact (disabled) |
| 24 | button, filter | Guest communication required (disabled) |

**Appears more than once:** button: lucide-send × 2.

### phone-coordinator-team-a-home.png

Screen: Home with Needs you now. Viewer: Property Coordinator Team A view. PNG: 390 × 2339.

Role preview note: Existing View as supports Property Coordinator only, not a Team A or Team B identity. Emily remains signed in. Home and menu are the same generic coordinator preview; the queue chip selects the named team. These are not separate coordinator accounts or team-specific Home previews.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Search Resolve |
| 2 | button | Toggle Sidebar |
| 3 | button | Take the tour |
| 4 | button | Chats, 1 unread |
| 5 | button | Notifications |
| 6 | button | Switch to dark mode |
| 7 | button | lucide-layout-grid |
| 8 | chip | 1 |
| 9 | button | Sign out (Property Coordinator) |
| 10 | banner | Viewing as Property Coordinator. You can look around, but nothing can be changed. Stop viewing as |
| 11 | button | Stop viewing as |
| 12 | heading | Good morning, Emily. |
| 13 | card | Needs you now |
| 14 | heading | Needs you now |
| 15 | button | ALE Direct booking you started. Reply within 3 minutes. |
| 16 | button | Owlmarketplace Direct booking you started. Reply within 3 minutes. |
| 17 | button | Crsth Direct booking you started. Reply within 3 minutes. |
| 18 | button | Help & Feedback |
| 19 | button | ale Direct booking you started. Reply within 3 minutes. |
| 20 | button | Direct booking request Direct booking you started. Reply within 3 minutes. |
| 21 | card | My work |
| 22 | heading | My work |
| 23 | button | Team queue (0 unclaimed) |
| 24 | button, tab | Active1 |
| 25 | button, tab | Waiting0 |
| 26 | button, tab | Done recently0 |
| 27 | button, tab | All |
| 28 | button, tab | P1 |
| 29 | button, tab | P2 |
| 30 | button, tab | P3 |
| 31 | button, tab | List |
| 32 | button, tab | Board |
| 33 | filter | Search my work |
| 34 | button | 3915 W 104th St S, Jenks, Oklahoma 74037 Scheduled Pest Control Keep the work moving Due Nov 23 P2 |
| 35 | card | Routine work due today |
| 36 | heading | Routine work due today |
| 37 | button | Record routine work |
| 38 | card | My shift |
| 39 | heading | My shift |
| 40 | button | Request time off |
| 41 | button | End my shift |
| 42 | card | Recent activity (1) |
| 43 | heading | Recent activity (1) |
| 44 | button | Show |

**Appears more than once:** No exact repeated label detected in the counted foreground surface..

### phone-coordinator-team-a-left-menu-open.png

Screen: Left menu fully open. Viewer: Property Coordinator Team A view. PNG: 390 × 844.

Role preview note: Existing View as supports Property Coordinator only, not a Team A or Team B identity. Emily remains signed in. Home and menu are the same generic coordinator preview; the queue chip selects the named team. These are not separate coordinator accounts or team-specific Home previews.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Resolve OPERATIONS |
| 2 | heading | MY DAY |
| 3 | button | Home |
| 4 | button | Team Queue |
| 5 | button | Direct Bookings |
| 6 | button | Work Orders |
| 7 | button | Databases |
| 8 | button | Guest Claims & Refunds |
| 9 | heading | TEAM |
| 10 | button | Team and Coverage |
| 11 | button | Playbooks |
| 12 | button | Guest-ready standards |
| 13 | heading | HOMES AND OWNERS |
| 14 | button | Properties |
| 15 | button | My account |

**Appears more than once:** No exact repeated label detected in the counted foreground surface..

### phone-coordinator-team-a-team-queue.png

Screen: Team Queue. Viewer: Property Coordinator Team A view. PNG: 390 × 7872.

Role preview note: Existing View as supports Property Coordinator only, not a Team A or Team B identity. Emily remains signed in. Home and menu are the same generic coordinator preview; the queue chip selects the named team. These are not separate coordinator accounts or team-specific Home previews.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Search Resolve |
| 2 | button | Toggle Sidebar |
| 3 | button | Take the tour |
| 4 | button | Chats, 1 unread |
| 5 | button | Notifications |
| 6 | button | Switch to dark mode |
| 7 | button | lucide-layout-grid |
| 8 | chip | 1 |
| 9 | button | Sign out (Property Coordinator) |
| 10 | banner | Viewing as Property Coordinator. You can look around, but nothing can be changed. Stop viewing as |
| 11 | button | Stop viewing as |
| 12 | heading | Team Queue |
| 13 | filter | Search by title or home |
| 14 | button | Filter 1 |
| 15 | button | Clear 1 filter |
| 16 | button, tab | All team 117 |
| 17 | button, tab | Team A 3 |
| 18 | button, tab | Team B 140 |
| 19 | button, tab | Only mine 1 |
| 20 | chip | 117 |
| 21 | chip | 3 |
| 22 | chip | 140 |
| 23 | button, filter | Priority |
| 24 | button, filter | Status |
| 25 | button, filter | Person |
| 26 | button, filter | Unassigned 40 |
| 27 | button, filter | Waiting 2 |
| 28 | button, filter | Blocked 3 |
| 29 | button, filter | Escalated 117 |
| 30 | button, filter | Overdue 112 |
| 31 | table | Open tickets |
| 32 | button | P2, hide rows |
| 33 | chip | P2 |
| 34 | button | Help & Feedback |
| 35 | button | P2 The Door in the bedroom fell down. The carpet is dirty #4941 207 High Point Way, Justin, Texas 76247 Fort Worth Immediate cleaning need Mike Cacatian Team A In progress Nov 16 Overdue by 8 days Nov 16 |
| 36 | chip | P2 |
| 37 | button | Select ticket 4941 |
| 38 | button | P2 Guest touch base: Pending: Finding her the new house she will extend in from Dec 20 onwards. #4972 724 Abilene Way, Yukon, Oklahoma 73099 OKC Current or past guest request Mike Cacatian Team A In progress Nov 17 Overdue by 7 days Nov 17 |
| 39 | chip | P2 |
| 40 | button | Select ticket 4972 |
| 41 | button | P2 Guest touch base: 11/18 - MC #5000 207 High Point Way, Justin, Texas 76247 Fort Worth Current or past guest request Mike Cacatian Team A In progress Nov 18 Overdue by 6 days Nov 18 |
| 42 | chip | P2 |
| 43 | button | Select ticket 5000 |
| 44 | button | Kanban |
| 45 | button | Calendar |
| 46 | heading | Pick up work |
| 47 | button, filter | Team A 0 |
| 48 | button, filter | Team B 40 |
| 49 | button, filter | All teams 40 |
| 50 | button, filter | All unclaimed 40 |
| 51 | heading | From Breezeway |
| 52 | chip | Breezeway |
| 53 | chip | P3 |
| 54 | button | Open in Breezeway |
| 55 | chip | Breezeway |
| 56 | chip | P3 |
| 57 | button | Open in Breezeway |
| 58 | chip | Breezeway |
| 59 | chip | P3 |
| 60 | button | Open in Breezeway |
| 61 | chip | Breezeway |
| 62 | chip | P3 |
| 63 | button | Open in Breezeway |
| 64 | chip | Breezeway |
| 65 | chip | P3 |
| 66 | button | Open in Breezeway |
| 67 | chip | Breezeway |
| 68 | chip | P3 |
| 69 | button | Open in Breezeway |
| 70 | chip | Breezeway |
| 71 | chip | P3 |
| 72 | button | Open in Breezeway |
| 73 | chip | Breezeway |
| 74 | chip | P3 |
| 75 | button | Open in Breezeway |
| 76 | chip | Breezeway |
| 77 | chip | P3 |
| 78 | button | Open in Breezeway |
| 79 | chip | Breezeway |
| 80 | chip | P3 |
| 81 | button | Open in Breezeway |
| 82 | chip | Breezeway |
| 83 | chip | P3 |
| 84 | button | Open in Breezeway |
| 85 | chip | Breezeway |
| 86 | chip | P3 |
| 87 | button | Open in Breezeway |
| 88 | chip | Breezeway |
| 89 | chip | P3 |
| 90 | button | Open in Breezeway |
| 91 | chip | Breezeway |
| 92 | chip | P3 |
| 93 | button | Open in Breezeway |
| 94 | chip | Breezeway |
| 95 | chip | P3 |
| 96 | button | Open in Breezeway |
| 97 | chip | Breezeway |
| 98 | chip | P3 |
| 99 | button | Open in Breezeway |
| 100 | chip | Breezeway |
| 101 | chip | P3 |
| 102 | button | Open in Breezeway |
| 103 | chip | Breezeway |
| 104 | chip | P3 |
| 105 | button | Open in Breezeway |
| 106 | chip | Breezeway |
| 107 | chip | P3 |
| 108 | button | Open in Breezeway |
| 109 | chip | Breezeway |
| 110 | chip | P3 |
| 111 | button | Open in Breezeway |
| 112 | chip | Breezeway |
| 113 | chip | P3 |
| 114 | button | Open in Breezeway |
| 115 | chip | Breezeway |
| 116 | chip | P3 |
| 117 | button | Open in Breezeway |
| 118 | chip | Breezeway |
| 119 | chip | P3 |
| 120 | button | Open in Breezeway |
| 121 | chip | Breezeway |
| 122 | chip | P3 |
| 123 | button | Open in Breezeway |
| 124 | chip | Breezeway |
| 125 | chip | P3 |
| 126 | button | Open in Breezeway |
| 127 | chip | Breezeway |
| 128 | chip | P3 |
| 129 | button | Open in Breezeway |
| 130 | chip | Breezeway |
| 131 | chip | P3 |
| 132 | button | Open in Breezeway |
| 133 | chip | Breezeway |
| 134 | chip | P3 |
| 135 | button | Open in Breezeway |
| 136 | chip | Breezeway |
| 137 | chip | P3 |
| 138 | button | Open in Breezeway |
| 139 | chip | Breezeway |
| 140 | chip | P3 |
| 141 | button | Open in Breezeway |
| 142 | chip | Breezeway |
| 143 | chip | P3 |
| 144 | button | Open in Breezeway |
| 145 | chip | Breezeway |
| 146 | chip | P3 |
| 147 | button | Open in Breezeway |
| 148 | chip | Breezeway |
| 149 | chip | P3 |
| 150 | button | Open in Breezeway |
| 151 | chip | Breezeway |
| 152 | chip | P3 |
| 153 | button | Open in Breezeway |
| 154 | chip | Breezeway |
| 155 | chip | P3 |
| 156 | button | Open in Breezeway |
| 157 | chip | Breezeway |
| 158 | chip | P3 |
| 159 | button | Open in Breezeway |
| 160 | chip | Breezeway |
| 161 | chip | P3 |
| 162 | button | Open in Breezeway |
| 163 | chip | Breezeway |
| 164 | chip | P3 |
| 165 | button | Open in Breezeway |
| 166 | chip | Breezeway |
| 167 | chip | P3 |
| 168 | button | Open in Breezeway |
| 169 | chip | Breezeway |
| 170 | chip | P3 |
| 171 | button | Open in Breezeway |
| 172 | heading | Imported from Notion |
| 173 | button | Show |

**Appears more than once:** chip: P2 × 4; chip: Breezeway × 40; chip: P3 × 40; button: Open in Breezeway × 40.

### phone-coordinator-team-a-open-ticket-panel.png

Screen: Open ticket panel. Viewer: Property Coordinator Team A view. PNG: 390 × 1743.

Role preview note: Existing View as supports Property Coordinator only, not a Team A or Team B identity. Emily remains signed in. Home and menu are the same generic coordinator preview; the queue chip selects the named team. These are not separate coordinator accounts or team-specific Home previews.

| # | Kind | Visible label |
|---:|---|---|
| 1 | button | Open full page |
| 2 | button | Close Ticket |
| 3 | heading | Ticket |
| 4 | heading | The Door in the bedroom fell down. The carpet is dirty |
| 5 | button | More |
| 6 | chip | Logged |
| 7 | chip | Fix it |
| 8 | chip | Done |
| 9 | heading | Do this now |
| 10 | heading | CLEANING COMPLAINT · STEP 2 |
| 11 | heading | Get photos or video from the guest. |
| 12 | button | Show vendor and work order tools |
| 13 | heading | Does this need a field repair? |
| 14 | button | No repair needed: finish this ticket |
| 15 | button | Waiting on someone? |
| 16 | card | Make it right |
| 17 | button | lucide-chevron-down |
| 18 | heading | Make it right |
| 19 | heading | DETAILS |
| 20 | filter | Add an update: who you called, what the vendor found, what the guest said… |
| 21 | button | lucide-building-2 |
| 22 | button | lucide-send (disabled) |
| 23 | button | lucide-send (disabled) |
| 24 | heading | Unnamed heading |
| 25 | button | lucide-external-link |
| 26 | button | View 8fa496d3-4613-4ddb-8cba-da8602df77bd.jpeg |
| 27 | button | Download 8fa496d3-4613-4ddb-8cba-da8602df77bd.jpeg |
| 28 | button | Remove 8fa496d3-4613-4ddb-8cba-da8602df77bd.jpeg |
| 29 | button, filter | Active-stay impact (disabled) |
| 30 | button, filter | Guest communication required (disabled) |
| 31 | button | lucide-external-link |
| 32 | button | lucide-external-link |

**Appears more than once:** button: lucide-send × 2; button: lucide-external-link × 3.
