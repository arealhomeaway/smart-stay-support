# ops-simplification

Approved by Emily Nov 25: Approved: apply ops-simplification. Earlier guest-ready-type-links, database-priority-words and reported-issue-order-links stay on hold.

## Scope
Add canonical backlog markers and history; separate pre-Nov16 open work and all Notion tickets without changing owners/status/deadlines; restrict ordinary reads and suppress backlog notification/escalation producers. Preserve source imports, schedules, switches and captured scorecard history. Existing routing is composed for all new tickets and maintenance/lawn reviews, including the existing other-team, lunch-only, on-call and Supervisor fallback rules. Arrival checks route to Team A before insert.

## One-time assignment
Capture the currently open unassigned live ticket/review IDs, not future arrivals. SQL-only job at Nov 26, 2026 8 AM Central (14:00 UTC); serial routing sees prior assignments in the same transaction. Receipt prevents repeat execution; job unschedules after success. Nothing assigned tonight by this backfill.

## Run
1. Exact function fingerprint preflight.
2. Run practice.mjs against isolated PGlite fixtures.
3. Apply apply.sql verbatim through the migration tool.
4. Read counts, current rules, assignment receipt and schedules.

## Undo
undo.sql restores exact deployed rules/ACL-preserving replacements, removes only added triggers/policies and clears untouched separation markers. New tables and history remain. Post-apply explicit changes and one-time assignments are never silently reversed. An undo after the scheduled assignment needs reviewed IDs and separate approval.

## Defaults
Cutover uses midnight Nov 16 Central. Unknown Guest-ready standard uses the existing priority due-date default for tickets; maintenance review fallback remains next day. No prior pending standard/link/priority package is included.
