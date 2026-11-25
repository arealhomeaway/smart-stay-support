# ops-simplification

Approved by Emily Nov 25: Approved: apply ops-simplification. Earlier guest-ready-type-links, database-priority-words and reported-issue-order-links stay on hold.

## Scope
Part 1 stages canonical backlog markers and history for OPEN work only: pre-Nov16 non-Notion open work and Notion imports that were already older than 30 days at import. Recent-at-import Notion work remains quiet and retains its mapped owner; started imports remain normal work. Closed/resolved records are untouched. No restrictive policies are added to existing records; history remains readable. Current live-reader exclusions, From Notion presentation and Old backlog labels still need implementation. Notification/escalation suppression is staged. Preserve source imports, schedules, switches and captured scorecard history. Existing routing is composed for new non-Notion tickets and maintenance/lawn reviews, including existing other-team, lunch-only, on-call and Supervisor fallback rules. Arrival checks route to Team A before insert.

## STOPPED: Nov 25 part 1 practice failed
The real-schema fixture incorrectly recreated the generated `vendor_orgs.qualification_score` expression as a DEFAULT. PostgreSQL rejected it with `cannot use column reference in DEFAULT expression`. No behavior checks or live preflight execution ran; nothing was applied or scheduled. Emily instructed stopping on any practice failure, so no retry was made. The fixture contains 47 real dependency definitions, including seat_holder_at; the remaining schema-copy issue must be fixed before another run. Close/archive/reactivation actions were moved to deferred-actions.sql, which is not part of part 1 application and remains unverified.

## One-time assignment
Capture the currently open unassigned live ticket/review IDs, not future arrivals. Every Notion-imported ticket is excluded at capture and execution, including started ones. SQL-only job planned at Nov 26, 2026 8 AM Central (14:00 UTC); serial routing must see prior assignments in the same transaction. Receipt prevents repeat execution; job unschedules after success. Nothing assigned tonight by this backfill. No schedule has been created.

## Nov 25 Notion correction
The correction-only isolated practice passed seven checks, and 24 pure helper tests passed. This does not validate the complete package or undo and does not authorize bypassing its failed full practice. See notion-correction-report.md and notion-practice-result.json. No live rows were changed.

## Run
1. Exact function fingerprint preflight.
2. Run practice.mjs against isolated PGlite fixtures.
3. Apply apply.sql verbatim through the migration tool.
4. Read counts, current rules, assignment receipt and schedules.

## Undo
undo.sql is staged to restore deployed rules/ACL-preserving replacements, remove only added triggers and clear untouched separation markers. It has NOT passed practice. New tables and history remain. Post-apply explicit changes and one-time assignments must never be silently reversed. An undo after the scheduled assignment needs reviewed IDs and separate approval.

## Defaults
Cutover uses midnight Nov 16 Central. Unknown Guest-ready standard uses the existing priority due-date default for tickets; maintenance review fallback remains next day. No prior pending standard/link/priority package is included.
