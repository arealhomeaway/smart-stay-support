# Record work as one flow

Register T8, T9, T10, T11 (board approved Nov 7). Status: **applied** Nov 8 2026 (Central, Nov 9 UTC), not published.

| Step | File | Applied as | What it does |
|---|---|---|---|
| 01 | `01_record_work.sql` | `drizzle/migrations/0312_record_work_one_flow.sql` | Home history lines get a problem type and a one touch mark. Setting `record_work_repeat` (`{"times": 3, "days": 90}`). `home_problem_repeat` and `home_repeat_flags` count one problem type per home across tickets and one touch saves (archived tickets and quiet Notion imports never count). `record_work_route_preview` turns the existing routing by time (`ticket_route_at`) into a role kind for Who will do it, never a person. `record_work_escalate` lets the person who just created a ticket mark it escalated (existing `escalations` row, `escalation_level`, `escalated_at`, a history line) and alerts the Operations Supervisor through the existing `notify_staff` path; pressing it twice is safe. |

Undo: `01_undo_record_work.sql`. It drops the two new columns, so saved one touch lines lose their problem type (the lines stay); take a backup first.

The staged file and the applied migration are identical, byte for byte (checked with `cmp`, and by `src/lib/__tests__/record-work-sql.test.ts`).

## Practice runs (cancelled, nothing kept)

1. `practice_cancel.sql` (step 01 plus checks; the run used the same statements with the header comment trimmed), before applying, real home 1012 Wasatch Ct, a real Property Coordinator. Results: preview `on_call` (it was overnight); the refrigerator ticket stored the Maintenance label, Today, owned by the person on call tonight, routing note "No coordinator was on shift overnight, so it went to the person on call tonight"; a ticket with no problem type stored the Ops label and routed the same way; one touch made 0 tickets and 0 alerts; repeat 2 then 3 of 3 in 90 days, flagged on the third; the home flag and the weekly list each showed 1 row; Escalate now twice returned the same escalation, level supervisor, 1 open escalation, 1 alert to the Operations Supervisor (email pending), 1 history line; another coordinator was refused. Rolled back by a deliberate error.
2. Final check on the applied functions: one ticket and one one touch for 1012 Wasatch Ct as the same coordinator: Maintenance label set, Today, owned, clocks set, routing automatic (on call, overnight); one touch 0 tickets, 0 alerts; repeat count 2 of 3. Rolled back.

Read back after both: tickets 0, home history 0, staff alerts 444 (unchanged), escalations 0, ticket history 0, practice rows 0.

## Not in this step

- No change to ticket creation rules, `auto_assign_ticket`, `ticket_route_at`, clocks, SLAs, existing alerts, owner approvals, reports or the bonus.
- The stored Ops or Maintenance label (`tickets.entry_kind`) is still written on every new ticket; the panel sets it from Repair needed at the home.
- Checksums: `sha256.txt`.
