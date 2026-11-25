# Operations cleanup verification (Nov 25)
Code, live catalog/function definitions and signed-in localhost preview checked. Published site not changed or checked. No switch writes, live data edits, outbound Breezeway calls, or OwnerRez sync edits.
Latest harness build/typecheck: build OK. Focused suite: 37 pass, 0 fail. Isolated practice: 5 standard, 4 alert, 7 group-link checks pass.
Whole suite before/after not completed: initial foreground command timed out after 21 batches; continuation completed three batches then timed out. The known owner progress failure reproduced. This is a deviation from H12, not a passing full-suite claim.
Team B live preview: 140 equals 73 maintenance +13 reported +0 cleaning +0 inspection +54 lawn. Grouped two-issue row opens both issue descriptions and the existing canonical Ticket workspace. Group save was not clicked because its database package is pending.
Lock icons verified on signed-in Oversight, Supervisor and Databases; Home/Needs you now filtering and carry-over verified by tests. Property read projects due_on/due_locked through shared renderer. The access URL opens the existing entry section and scrolls to lock brand. Clicking View lock from the chosen arrival check was not completed (Yes selector selected a different control); no arrival step was saved.
Three pending packages: guest-ready-type-links, database-priority-words, reported-issue-order-links. Each includes preflight, isolated practice, undo and checksums. Apply only using Emily's exact approval words. Added type SLA values inherit Ongoing maintenance; no existing type/SLA changes. Lawn display date is separate from original due_at.
## Existing files modified
- src/components/databases/TicketTabs.tsx
- src/components/nav/TicketDrawer.tsx
- src/components/operations/AllOpenTicketsTable.tsx
- src/components/operations/TeamBReviewRows.tsx
- src/components/property/HomeProfileTab.tsx
- src/components/tickets/ArrivalCheckPanel.tsx
- src/components/tickets/ReportedIssuesPanel.tsx
- src/components/tickets/TicketDueLabel.tsx
- src/components/workorders/BreezewayRepairLink.tsx
- src/lib/breezeway-bridge.functions.ts
- src/lib/breezeway-bridge.server.ts
- src/lib/databases-data.ts
- src/lib/guest-ready-standards.ts
- src/lib/home-work.ts
- src/lib/property-hub.server.ts
- src/lib/reported-issue-group.ts
- src/lib/team-b-view.ts
- src/lib/ticket-tabs.ts
- src/routes/_authenticated/dashboard.tsx
- src/routes/_authenticated/property.$propertyId.tsx
- src/routes/_authenticated/supervisor-check.tsx
- src/routes/_authenticated/team-queue.tsx
- src/routes/_authenticated/tickets.$ticketId.tsx
## What changed
Ticket date projections/renderers now retain lock flags in Databases, property, Home and Supervisor lists. Home work predicates hide onboarding except handoff_carryovers provenance. Team B sums the actual five tab populations and retains captured issue IDs in drawer/full-page links. Shared drawer opens all issue descriptions and delegates actions to the existing Ticket workspace. Shared work order link uses a new atomic group RPC only for groups; single-ticket behavior remains. Mirror read adds group associations when that table exists. Arrival View lock uses the existing profile entry anchor and profile jump handling. Standards fallback links Minor items/Pest control names; lawn routine display reads additive date when present. No existing clocks, alert timing, routing, score capture, bridge or OwnerRez sync rules were changed.
