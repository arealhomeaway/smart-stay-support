# Direct Bookings (pilot plan, nothing built)

## 1. What I would reuse
- **Leads data**: `leads`, `lead_properties` (offer status, quote fields, decline reason from Finder part 2), `lead_activity` for history. A Direct Booking request is a lead row with a new kind flag, not a new record type.
- **Availability Finder logic**: `src/lib/availability-finder.ts` (distance, `milesBetween`, 30D FIRM tiering, short stay counts), `availability-finder.server.ts` (OwnerRez reads, staff-only gate), `lead-offers.functions.ts` (save quote, offer outcome). The Finder page stays reachable by link only, hidden from the menu.
- **Inquiry Sources**: `inquiry_sources` table and `src/lib/inquiry-sources.ts` become "Referral sources" (discount per source lives here).
- **Email intake**: `mail-categories.ts` + `outlook-lead.server.ts` + `outlook-subscription.server.ts` already turn a tagged Outlook message into a lead. Change the tag name it matches.
- **Email reply**: `outlook-email.ts` / `mailbox.server.ts` already reply inside the same Outlook thread (tested in `outlook-thread.test.ts`). Reuse for reply and follow-up with Cc.
- **Templates**: existing `email_templates` table for "Direct booking reply" and "Direct booking follow-up".
- **Alerts and approvals**: `staff_notifications` for Coordinator, Supervisor and Director alerts; the existing 5 minute notify pass for the 2 minute escalation check; `coverage_shifts` / `coverage_config` for "who is on shift for Team A"; Home "Needs you now" list.
- **Home labels**: home display uses `formatPropertyLabel`; labels would be new (see below).

## 2. Additive database changes (staged in docs/pending/direct-bookings/ with undo, not applied)
- `leads`: add `kind` ('direct_booking' default null), `owned_by`, `started_at`, `clock_started_at`, `reply_sent_at`, `reply_sent_by`, `outlook_message_id`, `outlook_conversation_id`, `booked_outcome`, `not_booked_reason`, `not_booked_note`.
- `direct_booking_approvals`: one row per quote sent for approval (requested at, approved by, role used, sent back note, escalated at).
- `direct_booking_settings` (or `app_settings` keys): approval period start/end, approval wait (2 min), reply target (3 min), flat nightly rate per bedroom count.
- `inquiry_sources`: add `rent_discount_pct` (5 for MyMetis, Owl Marketplace, Travelers Haven).
- `home_labels` and `property_home_labels` with RLS: Admin manages list and bulk assign; Operations and Onboarding staff assign to a home.
- New not-booked reason values added as a check list, not changing the old lead loss enum.
- RPCs: `start_direct_booking` (first press wins, atomic), `request_quote_approval`, `approve_and_send`, `send_back_quote`, `mark_direct_booking_outcome`. Every RPC checks role on the server.

## 3. Steps and files, in order
1. Rent and ranking rules as pure functions: `src/lib/direct-bookings.ts` (monthly = flat x 30, less discount, nearest $10; nightly = monthly / 30; filters; tier order; tie break bedrooms then distance; 5/10/20 mile radius). Tests first.
2. Staged SQL + undo + checksums + README.
3. Intake: change tag constant in `mail-categories.ts`, add `kind` in `outlook-lead.server.ts`, keep old tag matched during a short overlap.
4. Server actions: `src/lib/direct-bookings.functions.ts` (start, approve, send back, send reply, follow-up, outcome).
5. Alerts: on-shift Coordinator alert at create; Supervisor alert at approval request; Director alert after 2 minutes, hooked into the notify pass.
6. Screens: `src/routes/_authenticated/direct-bookings.index.tsx` (list) and `direct-bookings.$id.tsx` (request screen with the 3 sections, banner, map, home cards, reply).
7. Menu: replace "Bookings & Leads" in `src/lib/shell-nav.ts`; hide Finder, Leads and Inquiry Sources entries; old links redirect.
8. Home "Needs you now" entry; confirm it is excluded from Team Queue.
9. Labels admin screen and label picker on the home page.
10. Templates seeded in the staged SQL; Settings section for approval period and rates.

## 4. Outside the app, and fallback for Monday
- **Outlook tag**: someone must rename the Outlook rule. Fallback: Resolve matches both old and new tag names; "New request" always works.
- **OwnerRez availability**: already read live. If OwnerRez is slow or down, show "We could not check calendars. Try again." and let the coordinator still write the reply by hand.
- **Same thread reply**: depends on the shared mailbox connection staying signed in. Fallback: "Copy reply" button so the coordinator sends from Outlook, then presses "I sent it" to stop the clock.
- **Map**: needs home coordinates; homes without them show in the list without a dot.

## 5. Conflicts and decisions needed
- **After the approval period ends (my proposal)**: quotes send straight away with no approval; the Supervisor gets a copy and a daily list of sent quotes. Please confirm.
- **2 and 5 bedroom rates not set**: I would show the home with "Rate not set. Ask the Operations Supervisor." and block sending that home until a rate is entered in Settings.
- **Approval vs 3 minute clock**: a 2 minute wait for approval can push past 3 minutes. Should the clock stop at "sent for approval" or at "reply sent"?
- **Who approves**: today there is no single "Operations Supervisor" role in user roles; I would use the existing functional role. Please confirm the Director role used for escalation.
- **Today's tag text** is "Resolve: lead management- create a ticket" (no space before the dash). New tag match will be exact and case-insensitive.
- **Existing leads and the Pipeline page**: keep data read-only under Direct Bookings, or hide?
- **"Databases" page with Referral sources**: I need to confirm where that page lives; if missing I add the list there.
- **"More than 2 short stays"** removes the home; current Finder only shows tier 3 when tiers 1 and 2 are empty. New rule always shows them in third place.
- **Active Owner exclusion**: use `owner_program_properties` as the source and treat "7D MAX" as a backup check only.
- **Team A**: which coverage shift or Pod defines Team A?
- **Booked / not booked**: does "Mark as booked" need a home and dates, or just the outcome?

## 6. Testing
- Unit tests for rent math (rounding, discount sources, nightly), filters, tier order, tie breaks, radius.
- Server tests: first Start wins under two clicks, only Supervisor/Director can approve, Director alert after 2 min, approval skipped only per the period rule, outcome requires reason and note.
- Intake tests with a mocked mailbox: new tag creates request, old tag still works during overlap.
- Thread test: reply and follow-up go to the same conversation with Cc.
- Word check test: no "seat", "Hit", "Median" or person names on new screens.
- Browser check signed in as a coordinator with mocked OwnerRez and mail, then full suite, type check and build. Nothing published.
