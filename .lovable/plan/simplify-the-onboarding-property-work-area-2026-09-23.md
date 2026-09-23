# Simplify the onboarding property work area

## Goal
Make **Work & Scope** open to one obvious, ordered place to work. Preserve the property header and the four existing top-level tabs.

## Changes
- Replace the current next-action card, Ready now list, four track columns, and always-visible stage task accordions with one dominant **Work queue**.
- Order the queue so actionable work appears first, followed by corrections/attention items, then blocked or waiting work; keep completed work available through the same control.
- Show due date, assignee, track, and status as lightweight metadata on every row. Clicking a row keeps opening the existing task workspace.
- Replace the lane chips and “Show work” menu with one filter bar: **All work**, **Needs attention**, **My assigned**, and **Waiting**.
- Keep a compact waiting summary beside the queue counts; waiting-on-homeowner work appears only in this queue and summary.
- Remove the separate **Homeowner decisions** list from Work & Scope.
- Keep the full stage and track picture available in one collapsed **Browse full plan** area below the queue, reusing the existing data rather than creating another competing workflow.
- Preserve scope editing, notes, scheduling, templates, lifecycle controls, and task creation below the primary queue.

## Technical details
- Add pure queue ordering/filter helpers so behavior is testable and consistent.
- Add a focused queue component using existing semantic tokens and task detail actions.
- Update the property route to use the queue and remove obsolete competing imports/state.
- Add regression tests for ordering, filters, and homeowner-waiting deduplication.
- Verify the Fitzgerald workspace at desktop and mobile widths, including opening a task from the queue.
