# Delete the 18 fake test sign-ins (register S6). APPLIED Nov 9, 2026 (UTC)

Emily's instruction, Nov 8: every fake login is deleted, not blocked; this replaces the Nov 9 answer
"keep and block" and the older rule that sign-ins are never deleted. Register S6 now ends with:
"The fake test sign-ins are deleted, not blocked (Emily, Nov 8)."

Only the 18 accounts listed in both files, by explicit id, each checked against its sign-in address.
The 11 real staff and 6 real homeowners were never in the list and kept every row.

## Files

| Order | File | What it does | Undo |
|---|---|---|---|
| 1 | `01_detach_and_remove_test_accounts.sql` | Refuses without a checked backup from the last 2 hours, without all 18 addresses matching, or if any id has a profile, role or program place. Detaches every kept record from the 18 accounts (link cleared, name kept where a name field exists, audit lines with no name get "Name (former)"). Deletes only records with no value without the account (6 invites to test addresses, 5 demo approval lines between two test accounts, 2 closed demo follow-ups, 5 invalidated demo statement checks, 2 synthetic demo activity lines). Lets help ticket history keep a line whose author is gone. Switches off the touched tables' safety rules only inside the step, puts them back, checks they match, checks the audit log kept every line plus one, and checks no row anywhere links to the 18. Adds one audit line listing every row detached or deleted. Every count must equal the Nov 9 count or nothing is kept. | Restore rows from backup `2026-11-09_023728Z`; the removal audit line lists every row id |
| 2 | `02_remove_test_signins.ts` | `--check` reads only; `--remove` removes the 18 sign-ins through the sign-in service, each address and the absence of a profile, role and program place checked first, then lists every sign-in. | None (a removed sign-in cannot be restored) |
| practice | `practice_cancel.sql` | Appended after 01 for the practice only; reports the counts and cancels, so nothing is kept. | n/a |

## Read only first (Nov 9)

`live-capture/references-before-2026-11-09.txt`: every uuid column of every table scanned (954
columns); 954 links to the 18 accounts in 36 table columns. Text mentions that are not links: audit
lines' before/after text, the demo alert recipients setting, the test account list setting.

## Run record (Nov 9, 2026 UTC; Nov 8 evening Central)

- Backup `2026-11-09_023728Z`: 235 tables, 98,781 rows, finished 02:38:33, Verify passed 02:39:32
  (0 broken, 0 changed).
- `02 --check`: 18 of 18 passed; sign-ins 35, profiles 17, sign-ins without a profile 18.
- Practice (one step, cancelled at the end): first try stopped on a naming clash in the audit name
  line (nothing ran); fixed in 01; second try passed every check and reported: 35 link columns
  cleared at exactly the expected counts, deleted approvals 5, follow-ups 2, activity lines 2,
  statement checks 5, invites 6; audit 2,764 to 2,765; 249 audit lines given a (former) name;
  profiles 17, roles 18; removal line lists 18 accounts. Afterwards every table matched the backup
  except live sync and email run tables; help ticket author still required; 293 audit lines still
  linked (nothing kept).
- Real run: 01 applied byte for byte as migration `0308_delete_test_logins_detach.sql`
  (sha256 cdb1b738...6661, identical to the staged file), removal audit line 03:06:45 UTC.
- `02 --remove`: 18 of 18 passed the checks, 18 removed; sign-ins now 17, profiles 17, sign-ins
  without a profile 0.

## After (read only)

- Sign-ins 35 to 17; profiles 17; role rows 18: 6 homeowners, 11 staff (1 Admin plus Coordinator,
  1 Admin, 3 Operations leadership, 3 Onboarding, 3 Coordinators).
- No uuid column anywhere links to the 18, except audit lines' subject (131 lines), kept on purpose
  so each line still says who it was about; the removal line maps each id to its name.
- Audit log 2,764 to 2,765; every older line kept; 249 lines now read "Name (former)".
- All 279 safety rules on, as before; 24 ticket rules on.
- Changed tables against the backup: approvals 20 to 15, audit log +1, team invites 26 to 20,
  property activity 2 to 0, statement checks 5 to 0, follow-ups 6 to 5 and staff alerts 443 to 444
  (see below); the rest were live sync and email runs only.
- After the step, the regular follow-up pass opened 1 new demo follow-up for demo home
  "Riley Adler" with no Project Manager (the removed QA Kati was its Project Manager), routed to the
  Director of Onboarding with 1 in-app demo alert; not emailed (skipped). Left as it is for Emily.
- The demo alert recipients setting still names the removed QA Micah and QA James (Emily, Nov 9,
  answer 3: leave it). Demo alerts then reach nobody; nothing errors.
- Home, Team Queue, Direct Bookings and Properties loaded for Admin and the four View as roles;
  a demo home, help tickets and a demo onboarding home loaded with no errors.
