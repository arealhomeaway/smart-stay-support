# Clean slate (register N8, M5). APPLIED: 01, 01c, 02. NOT RUN: 02b (stopped), 01b (never)

Emily's decision of Nov 7, 2026, with her answers of Nov 8. Emily's go for the real run: Nov 8,
about 6:55 PM Central. Each SQL file refuses to run unless `full_backups` holds a backup that
finished and passed Verify in the last 2 hours (Admin tools > Back up everything, then Verify).

## Real run (Nov 9 UTC, Nov 8 about 6:58 to 7:03 PM Central)

Full record: `live-capture/real-run-2026-11-09.txt`.

- Backup first: `2026-11-09_005832Z`, 235 tables, 99,445 rows, Verify passed 01:00 UTC.
- Before: the 42 live tickets matched the Nov 8 list id for id; no real ticket after the 4:00 PM cut.
- Ran for real, one step each, byte for byte: 01, then 01c, then 02 (02 finished 01:02:53 UTC).
  Every count moved exactly as in practice run 2.
- Before and after: tickets 42 to 0, claims 9 to 0, expenses 16 to 0, Work Orders 4 to 0,
  profiles 35 to 17, role rows 34 to 18, staff alerts 584 to 443, homeowner alerts 184 to 156,
  file records 324 to 314, audit log 2,748 to 2,764 (16 role removal lines). Every trigger and
  delete block on, as before. Homes, owners, vendors, settings, schedule, routines, templates,
  onboarding and the integration log kept their counts.
- After: the 5-minute pass added 2 demo follow-up alerts to the removed QA Kati account (two demo
  homes still have an open follow-up assigned to it), so staff alerts read 445.
- 02b NOT RUN: its read only pre-check failed. 12 of the 18 sign-ins are still named by kept
  records the database will not release (audit log lines, demo onboarding Tasks, file records,
  approvals, team invites). Only 6 could be removed. Waits for Emily's decision. All 18 sign-ins
  remain, each with no profile and no role.
- Never ran 01b.

The order the files were run in:

| Order | File | What it does | Undo |
|---|---|---|---|
| 1 | `01_delete_all_tickets.sql` | Deletes every ticket and what depends on it (see the file header). Also refuses if any non-demo ticket was created after Nov 8, 4:00 PM Central (my default, kept by Emily on Nov 8, so Monday's work is never deleted by surprise). | Restore from the backup folder |
| 1b | `01b_optional_ticket_log_lines.sql` | DO NOT RUN (Emily, Nov 8): the audit and integration log lines stay. Kept here only as a record. | n/a |
| 1c | `01c_delete_demo_claims_and_expenses.sql` | Deletes the 9 demo claims that have no ticket and all 16 test expenses, by explicit id list, each checked against its title or payee (Emily, Nov 8, answer 3; Nov 9, answer 4). Refuses unless 01 has run. | Restore from the backup folder |
| 2 | `02_delete_test_accounts.sql` | Removes 18 listed test and demo accounts' roles, memberships, alerts, homeowner messages and profiles. Checks each id still has the expected address. Both James staff accounts stay (Emily, Nov 8). | Restore from the backup folder |
| 2b | `02b_delete_test_logins.ts` | Removes the same 18 sign-ins through the sign-in service (a database step may not touch sign-ins). Run as an Admin step after 2. NOT RUN on Nov 9: 12 sign-ins are held by kept records (see Real run). | None (sign-ins cannot be restored; most are already blocked) |

Restore: the backup folder in the private `backups` storage bucket holds one file per table and a
manifest with row counts and fingerprints. Secret columns (encrypted door codes, tokens) are not
in the backup, so restoring deleted rows never needs them; none of the rows deleted here hold any.

## Practice runs (cancelled, nothing kept)

- Run 2, Nov 9 (current files): fresh backup `2026-11-09_003358Z`, 235 tables, 99,430 rows, Verify
  passed. Record: `live-capture/practice-run-2026-11-09.txt`. Tickets 42 to 0, claims 9 to 0,
  expenses 16 to 0, profiles 35 to 17. Reviews all kept, only unlinked. Afterwards every count was
  back to its value before, and every delete block was on.
- Run 1, Nov 8 (before the 7 linked demo expenses were added): `live-capture/practice-run-2026-11-08.txt`.

## 1c: the 9 demo claims and all 16 test expenses

Claims (all demo, none has a ticket): b7fbde89 Departure damage, Pet damage; 2a822c00 and
262af36e QA SYNTH denied claim; c03ec414 waiver approve; f8bbc559 waiver deny; d41dafb4 partial
recovery; e1aa27c0 waiver approved; e8f4cf2c waiver denied; 23823dfb Finance receipts.

Expenses (all 16 on Nov 9, so none is left): be487bc2 QA SYNTH typo (archived); 8e4e99eb Plumbing
(incomplete); d94593ed Gutter Clean; 9249f929 Repair B; b8cc35c0 Repair A; 9cb7ad7b, 8106ce05,
95c5899a Plumbing Co; 574e104e, a blank archived expense made by the QA James test account that
is not marked demo (Emily, Nov 9: it goes); and the 7 demo expenses that were linked to the deleted
tickets and Work Orders (Emily, Nov 9: they go): d49b514e Diagnostics Co, cae21a0c Estimate Co,
5b99cb63 Evidence Gate, 39aafabe Plumbing Co, 67e65cc5 SR Deferred, 18a2ff17 SR Diagnostics,
610761ca SR Repair Hold.

Kept, only unlinked (Emily, Nov 9, answer 5): the departure review and the cleaning review that
pointed at a claim, the cleaning review that pointed at a ticket, and the 3 guest reviews that
pointed at a ticket. Also kept: the home activity entries the expenses were linked to, and the
audit log lines about them.

Delete blocks switched off inside 1c only, and on again at its end: `expense_events_append_only`,
`guard_expense_recovery`, `guard_statement_dispositions`.

## 01: what goes, counted read only on Nov 8 (`live-capture/ticket-dependents-2026-11-08.txt`)

- Tickets 42, ticket history lines 158, troubleshooting answers 3, escalations 1, handoffs 1,
  refunds 1 (demo), with their activity.
- Work Orders created for them 4 (3 demo, 1 real) with their events 23 and vendor candidates 3;
  1 approval on a Work Order.
- Alerts: 93 about tickets, plus those about the 4 Work Orders and the refund.
- File records on tickets 4 (the stored files stay in storage).
- Automatic homeowner opportunities made from tickets 29 (all demo, none answered) and their
  home links.
- Home work list rows 42. Capture table rows 0 today (ticket state log, scorecard records).
- Finance: 7 links from expenses to these tickets and Work Orders (all on demo expenses). The
  expenses stay; each unlink is recorded in the expense history.
- Unlinked and kept: 3 guest reviews, 1 completed demo routine check, 1 cleaning review.

Delete blocks switched off inside 01 only, and on again at its end (checked before it finishes):
`tickets_never_delete`, `ticket_state_log_no_change`, `scorecard_records_no_change`,
`routine_controls_lock_completed`. Every other rule, clock and trigger is untouched.

## 02: candidate accounts (read only, `live-capture/accounts-2026-11-08.txt`)

Staged for removal (18):

| id | Display name | Email domain | Role | Last sign in | Why |
|---|---|---|---|---|---|
| 81a80bac-2655-4994-9651-a9afb81ec721 | Riley Alder (DEMO) | demo.arha.test | owner | 2026-08-28 | demo owner, blocked |
| ea98f339-1ccc-437a-88bb-06ac94be655a | Emily Jimenez | example.com | none | never | test address, removed, blocked |
| 77a301f0-161c-40a4-8266-0c0e05cefa45 | pr10-owner-a-20260917 | example.invalid | owner | 2026-09-17 | test owner, blocked |
| f44ecf9a-a358-430c-9c64-0ffaa31740b4 | pr10-owner-b-20260917 | example.invalid | owner | 2026-09-17 | test owner, blocked |
| e3c913e4-1562-4143-a6ff-1f17cd5deda6 | Emma Renee | gmail.com | none | 2026-10-20 | listed as the test account in settings, removed, blocked |
| ec5405ff-4722-4a85-a22e-069e68bd3c7f | QA James | resolve-test.invalid | manager, admin | 2026-08-28 | qa, blocked |
| d1dafc2e-ba9a-450a-94e3-ad9c11c10ef8 | QA Kati | resolve-test.invalid | onboarding | 2026-08-28 | qa |
| 8fac5aa5-ba70-42f2-afa0-6d77382383b3 | QA Micah | resolve-test.invalid | manager | 2026-08-28 | qa |
| d13885de-6178-4f32-8560-997d182f245f | QA Test Outsider | resolve-test.invalid | owner | 2026-08-28 | qa, blocked |
| f8a9d111-3416-47f7-abc1-48f5e8aac2ab | Avery Lindqvist (demo owner) | resolve-test.invalid | owner | 2026-09-29 | demo owner |
| eeaf39c4-3b22-4733-9ba5-b275476bc5a8 | QA Signup Test | resolve-test.invalid | owner | 2026-08-28 | qa |
| d1b80a3e-3b42-46e5-aacb-43276ef272eb | QA Test Tech | resolve-test.invalid | tech | 2026-08-28 | qa, blocked |
| 0a6d5dc9-8159-4850-9b5e-421308d2e464 | qa.um.admin | resolve-test.invalid | admin | 2026-09-29 | qa, blocked |
| 06fd8599-c7aa-40b2-8161-cafae4da99b7 | QA UM Manager | resolve-test.invalid | manager | 2026-09-29 | qa, blocked |
| 3a476833-49ff-4aa3-996d-18913422f8e4 | qa.um.pending | resolve-test.invalid | none | never | qa, blocked |
| c6579620-2ee4-41fe-ad10-07f451d7ae97 | Quinnie Targetson | resolve-test.invalid | tech | 2026-09-29 | qa, blocked |
| 5557f537-6847-4f33-af90-1e78b5c344fa | qa.um.tech | resolve-test.invalid | tech | 2026-09-29 | qa, blocked |
| 9f3b6143-b693-4067-9a3c-d645b5ecd716 | QA Vendor | resolve-test.invalid | vendor | never | qa, blocked |

Kept as real (17): the six homeowner logins (Dana Syska, Lindsey Lee, Rachel Ramsey, Ryan Lee,
Victor Puodziunas, Matthew Linder) and the eleven staff logins on the company address, including
both James staff accounts (Emily, Nov 8: real staff).

What stays after 02: records the test accounts made (359 demo onboarding Tasks by QA Kati, 293
audit lines, 95 expense history lines, and others) keep their rows and show no name. Two demo
homeowner programs (QA Signup Test, Avery Lindqvist) stay, with no owner login. The demo alert
recipients setting points at QA Micah and QA James; demo alerts will reach nobody.

## Not staged

- Moving the 6 homes on old plans to the Standard plan, and deleting old templates: DEFERRED
  (Emily, Nov 8), not part of Monday. The dry run report stays as the record:
  `live-capture/old-plans-dry-run-2026-11-08.txt`.
