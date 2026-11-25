# Quiet hold ticket report, Nov 25, 2026

Checked current code and fresh live database rows/definitions. Published app not checked or changed.
Before read: 05:46:13 UTC. After read: 05:47:26 UTC. No intervening write by this task.

## All open, non-archived, non-demo tickets

Open means open, dispatched, in_progress, waiting or awaiting_guest.
Notion age is `created_at - reported_at`, measured at import, inclusive of 30 days.
Non-Notion creation uses `created_at`. Nov 16 Central begins at Nov 16 06:00 UTC.
Using `reported_at` instead for ordinary tickets also finds zero D tickets.

| Group | Open | Without an owner | Home overdue/high-risk rule | Visible breached clock | Changed |
|---|---:|---:|---:|---:|---:|
| A: recent Notion, no hold | 73 | 17 | 3 | 1 | 0 |
| B: older Notion, held | 586 | 586 | 0 | 0 | 0 |
| C: older Notion, no hold | 0 | 0 | 0 | 0 | 0 |
| D: non-Notion, before go-live | 0 | 0 | 0 | 0 | 0 |
| E: non-Notion, go-live onward | 205 | 131 | 203 | 202 | 0 |
| Recent Notion already held, outside the requested five groups | 18 | 18 | 0 | 0 | 0 |
| Total | 882 | 752 | 206 | 203 | 0 |

"Without an owner" means both assigned_to and current_action_owner are empty;
it is a row fact, not necessarily a counted unassigned item. All 17 unowned A imports
remain quiet, so A contributes zero to counted unassigned work. A contains three
already-started imports, preserved unchanged; they account for its three high-risk
items and one breached clock. B has 570 backlog_review and 16 needs_home rows.
The additional 18 recent held imports have nine backlog_review and nine needs_home
rows. None were moved, since they are outside C/D.

Past stored due dates are not the same as displayed clocks or Home high risk.
For example, quiet imports can have an old stored date without counting as overdue.
The two overdue columns above distinguish Home's existing aging/clock rule from
an actually breached visible response/action clock. Neither rule was changed.

## Exact existing Home numbers

Used `SupervisorAttentionBand`'s existing selections and limits: 500 tickets,
200 ticket-linked escalations, 200 pending approvals, no new ordering; then
`withoutQuietNotion` and `supervisorAttention` in supervisor mode. This is a
source/live-data reproduction, not a new signed-in browser measurement.

| Home measure | Before | After |
|---|---:|---:|
| Open working tickets | 196 | 196 |
| Unassigned | 125 | 125 |
| Overdue / high risk | 194 | 194 |
| Open escalations | 0 | 0 |
| Need your decision | 338 | 338 |

All 196 open tickets in that limited Home read are from E. Its 125 unassigned
and 194 overdue/high-risk items are also from E. A/B/C/D and the extra recent
held imports contribute zero open/unassigned/overdue items in this particular
500-row Home selection. The three already-started open A tickets are outside it.

338 is a sum of decision buckets, not a distinct ticket count:
125 unassigned + 194 overdue/high-risk + 10 resolved tickets needing final review
+ 9 pending approvals + 0 blockers + 0 open escalations.
The final-review ten are five already-started Notion tickets and five non-Notion
tickets, all resolved, so they are outside the requested OPEN A-E groups.
All nine approvals are onboarding_task records under Home's existing query.
No filtering or counting correction was made to this existing calculation.

## Outcome

No C rows need a hold. D is empty and would be skipped regardless, because the
existing hold does not quiet ordinary tickets or include them on Imported tickets.
No live ticket changed; owners, status, due dates, history and clocks are untouched.
Undo has no IDs or values to restore. The requested narrow hold-only operation
cannot reduce the current Home numbers: they come from post-go-live work, not C/D.