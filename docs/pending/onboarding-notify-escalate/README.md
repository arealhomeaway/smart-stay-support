# onboarding-notify-escalate (staged, not applied)

Apply only on the exact words `Approved: apply onboarding-notify-escalate`.

**What apply.sql does (one transaction, additive, nothing deleted)**
1. Stops if any of the four notice rules or two table rules differ from what was read live on Nov 22.
2. Each person gets a time zone (Central until they change it on their profile) and `set_my_time_zone`.
3. Test inbox: app setting `onboarding_email_test_inbox` = the COO's address. While it is set, every
   onboarding notice email is saved as `held`: the published app never sends it, and only the new build
   sends it, to the test inbox only. Removing the setting sends new ones to their real people again;
   held ones are never sent to anyone else.
4. The shared onboarding notice writer: the Director of Onboarding is told only about escalations, Tasks a
   Project Manager adds by hand, Tasks the Director created, and owner tasks on a home with no Project
   Manager. Everyone else is unchanged. The person who acts is never told (as before).
5. Owner tasks (Opportunities from the plan or added by hand, and homeowner replies on owner items) go
   only to the home's Project Manager; the Director when the home has none.
6. New trigger: a Project Manager adds a Task by hand (not from the plan) and the Director is told.
7. Escalations reuse the Operations `escalations` table: two new columns (owner card, Task), the role
   `onboarding_director`, a shape rule (no ticket, has a home and a card or Task), and two actions,
   `raise_onboarding_escalation` (one open per card; alert and email to the Director) and
   `resolve_onboarding_escalation` (Director or Admin closes, the raiser can withdraw; the raiser is told).
8. Table `onboarding_daily_reminders`: one row per person per local day, so the 8 AM reminder goes once.

**Checked Nov 22 (live database, read only)**: preflight all 6 ok; 0 escalations without a ticket; the
Director of Onboarding role has a holder; no five-minute run open.

**Practice (Nov 22, live database, every run rolled back)**
| Case | Result |
|---|---|
| Project Manager adds a Task by hand | 1 notice, to the Director, email held |
| Homeowner answers an owner task | 1 notice, to the PM, 0 to the Director, email held |
| Homeowner replies on an owner item | 1 notice, to the PM (was 2 people), email held |
| Same, home with no PM | 1 notice, to the Director |
| Task comment the Director would have had | 0 |
| Creator completes their own Task | 0 notices to the creator |
| Escalate an owner card twice | same escalation; card 1, Task 1, ticket 0 |
| Director alerts for 2 escalations | 2, email held |
| Director closes them | 2 resolved, raiser told 2 times |
| Time zone | saved; everyone else Central |
| Owner notices, emails sent, pending staff emails | 0, 0, 0 |
| Undo: the four notice rules | match before exactly |

Not practised end to end: the undo's removal steps (drops, constraint and setting removal) in the same
run as apply. They are ordinary statements; the rule restore above was practised.

**Undo**: apply.undo.sql restores the four notice rules exactly (functions-before.sql), removes the new
actions, trigger and test inbox, turns held emails into skipped (never sent), and keeps rows written
while applied. The new columns, index, time zone and reminder table stay (nothing deleted).

**Not changed**: Operations escalations and their screens; staff review alerts (the overdue review
alert to the Director stays); handoff alerts; Finance notices; followed home notices; any Task data.

## Applied
Applied Nov 22 on "Approved: apply onboarding-notify-escalate" as migration 0367. Checksums verified and preflight
re-run first (all 6 ok, no five-minute run open). Read back: test inbox set to the COO's address; everyone's time
zone Central; escalation columns and rules, three actions, hand-added Task trigger and reminder record exist;
email status allows held; 0 onboarding escalations, 0 held emails; audit row `onboarding_notify_escalate.apply`.
Held emails are sent to the test inbox only by the new build's five-minute pass, so they wait until it is published.
