# Breezeway sending: answers (read only, nothing changed)

1. **Is it still built?** Yes, but the ticket screen no longer offers it. The send code with a template picker and a Breezeway person picker is still there: `BreezewayTaskPanel.tsx` (pickers at line 358) calls `createBreezewayOutboundTask` (`breezeway-outbound.functions.ts:101`), then `createOutboundTask`, then `POST /task/` (`breezeway-outbound.server.ts:577`). Only the onboarding Task drawer uses that panel today (`TaskDrawer.tsx:700`). On a ticket, the only send is the Work Order "hand off to Breezeway" step (`vendor-sourcing.functions.ts:57`). It sends the accepted vendor and the agreed appointment, with no template and no person picker, and it sits inside `TicketWorkOrderPanel`, which only shows while internal_work_orders is on.
2. **The four switches:**
   - **internal_work_orders:** every Breezeway send from Resolve needs it on (`breezeway-outbound.server.ts:133, 346`). It also shows Work Orders on tickets.
   - **breezeway_outbound:** the master switch for sending (line 133). It is on, but does nothing while internal_work_orders is off.
   - **onboarding_breezeway_send:** onboarding "Work order:" Tasks only (`onboarding-kati.functions.ts:189`; `breezeway-outbound.server.ts:363`).
   - **breezeway_bridge:** turns incoming Breezeway events into tickets and reviews (`breezeway-workorders.server.ts:118`, `breezeway-bridge.server.ts`). It never sends anything.
3. **Which homes are allowed:** No list of homes is kept today. The `breezeway_sending_settings` table is empty, so the code falls back to "every verified home" (`pilot-dispatch.ts:2`, `pilot-dispatch.server.ts:5-9`). A home qualifies when it has `breezeway_mapping_state = 'verified'`, a Breezeway property id, is not demo, archived or inactive, and the ticket or Task is not demo (`breezeway-mapping.server.ts:189-254`). 158 homes are verified today. The "pilot property only" label does not match this code.
4. **Onboarding vs Operations:** They share the same final send (`createOutboundTask`). The onboarding "Send to Breezeway" (`sendOnboardingWorkOrderFn`) also needs onboarding_breezeway_send on, a tentative date and no linked work order yet. It sends with no template, "maintenance" and "normal", plus the one person chosen in the section. Other vendor Tasks use the Operations-style panel with the template and person pickers.
5. **What it would take for the 4 homes:**
   - Switches: internal_work_orders on (this also brings back Work Orders on tickets, against the Nov 10 decision that they stay off), and onboarding_breezeway_send on.
   - 1464 Buckland Ct is verified (Breezeway home 1509882) and ready.
   - 624 Daniel Court, 8602 E. Galveston St. and 3400 N Fern Ave have no Breezeway home and no mapping. Each needs a Breezeway property id and a verified mapping.
   - Optional: a `breezeway_sending_settings` row (mode `pilot_only`, these 4 home ids) to limit sending to just these homes.
   - Each Task also needs a tentative date.
   - Not verified: whether those 3 homes exist in Breezeway yet. I also found no record of the send a month ago: 0 outbound rows and 0 Breezeway audit rows in the last 60 days.
