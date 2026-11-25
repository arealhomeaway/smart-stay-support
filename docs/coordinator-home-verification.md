# Simple coordinator Home, Nov 25, 2026

Screen-only change. No server function, trigger, routing rule, alert rule, switch,
schedule or database row changed. Not published.

## Checked
- Current Home, shared Team Queue/review/booking/owner-follow-up reads and existing actions.
- Signed-in preview as Emily, then the existing View as Property Coordinator, at
  1440 desktop and 390 phone widths.
- Leaders still render the prior Home branch; observed the same 338 decision band,
  Needs you now, My work, Routine work, My shift and Recent activity.
- Coordinator has only My work, Take one and Hand off beneath the existing header.
- Home content native buttons: 9 before, 6 after, on both desktop and phone.
  This excludes shell/menu buttons and links. Existing segmented options are
  role=tab, so are not included in that native-button comparison.
- Current after content has eight interactive controls including the ticket link
  and Prepare handoffs link. Every measured new control is 44px or taller.
- No horizontal overflow at 390px. Existing booking panel opens; Prepare handoffs
  link opens /prepare-handoffs. No browser page errors captured.
- 68 tests passed across coordinator-home, home-work, automated-sources,
  quiet-import-clocks and my-shift. Latest harness check: build OK.

## Limits of verification
View as changes roles, not identity or assigned team. Emily's retained account
shows five owned booking rows and one owned ticket, with Take one and incoming
handoffs empty. There is no separate Team A/B preview identity selector.
Actual Take, routine Start, booking Start and handoff Accept were not submitted:
View as is read-only and this request prohibited database changes. Existing
actions are reused, not replaced. Review and owner-work rows were not present
for this account to click. The full test suite was not run for this focused task.

## Existing files changed
| File | Before | Now |
|---|---|---|
| src/routes/_authenticated/dashboard.tsx | One Home layout | Coordinator-only three-section branch; leader branch retained |
| src/components/operations/AutomatedSourceQueue.tsx | Inline Take write/history | Same write/history reused through shared helper |
| src/components/routines/RoutineDrawer.tsx | Inline routine Start write | Identical Start write reused through shared helper |
| src/lib/__tests__/automated-sources.test.ts | Checks Take guards inline | Same assertions check the shared helper and its queue caller |
| roadmap.md | Earlier task list | Records this request and verification limit |

New files: CoordinatorHome.tsx, coordinator-home.ts, coordinator-home.test.ts,
take-unowned-ticket.ts and start-routine-review.ts. Root AGENTS.md was not changed
because its protected content is at the size limit.