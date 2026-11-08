# Fix batch 4: automated sources stay unowned, triage windows, overnight leftovers

Emily's decisions of Nov 7 and Nov 8, 2026 (register T15, D2, D3, S1). Nothing is deleted.

## Files

| File | Kind | What it does |
|---|---|---|
| `01_automated_sources_unowned.sql` | migration | `auto_assign_ticket`: one source check. A ticket whose `external_source` is `email`, `ownerrez` or `breezeway` keeps no owner and gets the note "Waiting in the Team Queue for the team to take it." Everything else in the rule is byte-identical to the live capture. |
| `01_undo_automated_sources_unowned.sql` | undo | Restores `auto_assign_ticket` exactly as captured live. |
| `02_overnight_alert_wording.sql` | migration | `release_overnight_direct_bookings`: the 8:00 AM alert now ends "Press Start to own it. Reply clock starts at 9:00 AM." The time is read from the Overnight reply clock starts at setting (default 9:00 AM; a bad value falls back to 9:00 AM). Who, when and once only are unchanged. Also corrects the internal note on `leads.overnight_until`. |
| `02_undo_overnight_alert_wording.sql` | undo | Restores the live function and the old note. |
| `03_triage_windows_off.sql` | data | Switches off the four extra triage windows (Mon, Tue, Wed evening Guest Experience 5 to 10 PM; Tue morning Property Operations 8 AM to 1 PM). The rows stay, `active = false`. The four weekend rows (S1) stay on. |
| `03_undo_triage_windows_off.sql` | undo | Switches the same four rows back on. |
| `live-capture/` | evidence | Live definitions and rows before the change. |

## Which tickets are automated

Only the automated paths set `external_source`; staff Record work never does (a test checks the
Record work page), and Notion imports are quiet and never reach the trigger.

- Info inbox: `/api/public/intake/email` sets `external_source` to its source (`email` by default,
  `ownerrez` for the OwnerRez relay).
- OwnerRez review follow ups: `createFollowUpTicket` now sets `external_source = 'ownerrez'`,
  `external_id = 'review_followup:<feedback id>'`, `source_channel = 'ownerrez'` for reviews from
  OwnerRez. Survey follow ups are unchanged (they still route).
- Breezeway: `createTicketFromWorkOrder` already sets `external_source = 'breezeway'`; it no longer
  calls `routeBreezewayTicket` or overwrites the owner afterwards.

## Triage windows: who reads them (checked read only before the change)

- No database function, view or scheduled job reads `coverage_triage_windows`.
- `ticket_route_at` (all ticket routing) never reads them.
- App: `breezeway-routing.server.ts` `routeBreezewayTicket` (active rows only; no longer called on
  creation) and the Team and Coverage page list (`coverage-admin.functions.ts`, active rows only).

## Proof before applying

- `src/lib/__tests__/direct-bookings-overnight-sql.test.ts` (isolated PostgreSQL): each source
  created with no owner; a Record work ticket routes exactly as before (also with email or
  OwnerRez as the guest's channel); closed tickets and Notion untouched; undo restores the live
  rule; the morning alert text, setting, fallback, once only, Start cancels it; undo restores.
- `src/lib/__tests__/automated-sources.test.ts`: sources, team groups, Take it, Home count, Home
  line, settings field.

## Applied

- Nov 8, 2026, approved by Emily. `sha256.txt` checked first (all OK).
- `01` APPLIED byte-for-byte as migration 0296, `02` as migration 0297 (each migration file is
  identical to its staged file). `03` run with the data tool as written.
- Read back: the live `auto_assign_ticket` and `release_overnight_direct_bookings` equal the staged
  bodies; grants unchanged (owner and service role only); both ticket triggers enabled and
  unchanged; `ticket_route_at` and `audit_ticket_auto_assign` byte-identical to the captures; the
  column note is the new one; triage windows 4 of 8 active (the weekend four).
- Routing preview for every work type at Tuesday 9 AM and Wednesday 7 PM: 42 rows, fingerprint
  e9323f81457c0affc44bab2979c15702 before and after, identical.
- Cancelled live check (nothing kept): one ticket each from the info inbox, the OwnerRez relay, an
  OwnerRez review follow up and a Breezeway work order were created with no owner and the line
  "Waiting in the Team Queue for the team to take it."; a Record work ticket went to the Guest
  Experience evening coordinator, the same person the routing rule names. Afterwards tickets 42,
  practice tickets 0, leads 1, alerts 584, settings 11. The ticket number sequence moved on by
  five (a cancelled step cannot give numbers back).
