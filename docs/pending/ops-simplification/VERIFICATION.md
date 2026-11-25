# Not ready to apply

This package is incomplete and was NOT applied. Emily already authorized application, but the required isolated practice did not pass. Do not apply apply.sql until the remaining work below is complete.

## Checked
- Deployed function and trigger definitions captured read-only.
- Raw open records: 882 non-demo non-archived open tickets; 677 match old-backlog criteria. 148 open maintenance/lawn routine reviews, 2 before go-live. 23 open Direct Bookings, 1 before go-live. These raw counts are not the current UI counts.
- Baseline current Home aggregation from live readbacks: 208 operational open tickets, 131 unassigned, 206 overdue/high-risk, 1 ticket with escalation fields, 363 category-summed need-your-decision items. Needs you now showed seven rows in the preceding screenshot; it was not freshly verified for this build. No after counts, because no migration or preview activation occurred.
- Fourteen new pure rule tests passed. Existing focused queue baseline: 55 passed.
- All 527 existing test files attempted in 36 sequential baseline batches; 20 batches timed out, one failed, fifteen passed. Full completion/comparison was not achieved.
- Latest preview build/typecheck signal: build OK at 05:18:48 UTC. New OperationsQueue and OldBacklog components are not mounted, so the existing user screens remain unchanged.
- Nov 25 part 1: captured fresh live function, column, enum, constraint and trigger definitions. Fixture now contains 47 real dependency definitions including seat_holder_at. Isolated practice failed while creating the schema: the generated vendor_orgs.qualification_score expression was incorrectly represented as DEFAULT and PostgreSQL rejected it with `cannot use column reference in DEFAULT expression`. No behavior checks ran. Per Emily's explicit stop instruction, no retry, application or scheduling followed. See practice-result.json. No behavior, rollback, undo, routing fairness, or authenticated action acceptance was verified.
- Revised staged apply.sql marks only open tickets (including open Notion), excludes closed/resolved/archived tickets, removes every restrictive existing-record policy, and does not create a cron schedule. Real trigger guards and all-source assignment remain staged and unverified. Coupled arrival ticket/check identity is staged as Team A. Close/archive/reactivation actions are deferred, not in apply.sql.

## Remaining work
1. Correct generated-column reconstruction in the isolated fixture, complete exact schema/ACL preflight, and run behavior/undo tests. Fix all issues found before application; authorization already stands.
2. Review dormant queue: remove nested row/button controls, align role-only ownership, one flat shared table, contextual Take it authority, all cleaning/review populations and caller-scoped selectors.
3. Mount the completed queue and Oversight backlog UI; unify Home candidates across all sources and replace leader tiles. Update all affected projections and privileged server readers to exclude backlog.
4. Complete date-reset rules for Direct Booking reactivation against Guest-ready standards and existing reply/follow-up clocks.
5. Verify serial assignment fairness and correct tomorrow date. A proposed job is staged for Nov 26 14:00 UTC, NOT scheduled.
6. Update T15/decision register only with the completed implementation; preserve existing unrelated rules.
7. Read before/after counts at actual application, run post-change suite and authenticated desktop/mobile flows.

Earlier guest-ready-type-links, database-priority-words and reported-issue-order-links remain unchanged and on hold. No switches changed. Nothing published.
