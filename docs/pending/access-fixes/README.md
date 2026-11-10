# Access fixes and the Supervisor handoff only view

Emily, Nov 7 to 9 (register A1, A4 to A14, A16, A20, M5, M6). Build 5 of 7. No publish.

## Files

| File | What it does |
| --- | --- |
| `01_access_fixes.sql` | The step. Applied through the migration tool as `drizzle/migrations/0317_access_fixes.sql`, byte for byte. |
| `01_undo_access_fixes.sql` | Puts back every rule exactly as captured live on Nov 10, 2026. |
| `live-capture/policies.txt` | The help ticket and invite code rules live before the step. |
| `live-capture/private.home_profile_editor.sql` | The home editing rule live before the step. |
| `practice_cancel.sql` | The cancelled live check with real accounts (nothing kept), and what it showed. |
| `sha256.txt` | Checksums of the files above. |

## What changes in the database

- Help tickets (A20): everyone still reads their own reports. Only the Admin reads every report, changes a status and writes the reply thread. The Director of Operations no longer does. Rules changed: `Leadership reads help tickets`, `Leadership updates help tickets` on `help_tickets`; `Leadership reads help ticket events`, `Leadership writes help ticket events` on `help_ticket_events`. `Users submit own help tickets` and the demo account rule are unchanged.
- Invite codes (A14): three new rules on `team_invites` let the Director of Onboarding create, read and update Onboarding staff codes only. The Admin and Operations leadership rules are unchanged.
- Home editing (A12): `private.home_profile_editor` gains one clause. A person whose only work role is Finance on a Supervisor type account (no Operations Supervisor held or covered, no Director, no Admin, no Coordinator or Onboarding account type) no longer edits home details, labels or photos. Everything else in the rule is as captured live. The function keeps its access list (signed in users run it).

Unchanged: every other policy and function, routing, clocks, alerts, scheduled jobs and syncs.

## Applied and checked

- `0317_access_fixes` matches `01_access_fixes.sql` byte for byte. Afterwards: the three new invite rules exist, the help ticket read rule is Admin or own, and the home editing rule kept its access list.
- `practice_cancel.sql` ran and cancelled itself before applying; results are at the end of that file. Afterwards no practice codes remained and the rules were as before.

## Undo

Roll the app code back first, then run `01_undo_access_fixes.sql`.
