# arrival-team-a-existing (applied Nov 25, 2026)
Change 3, answer 5 (Emily, Nov 25). Moves the open arrival checks that already exist to Team A, the same way
new ones go: check team Guest Experience, ticket role ge_day (Team A). Open only; history untouched.
Old values saved in one audit row; undo puts them back. No owner, status or clock change.
Preflight: preflight.sql. Undo: undo/01_move_open_checks.sql. Practice: passed in an isolated reduced-schema PostgreSQL fixture (practice.mjs).
Apply only on: **Approved: apply arrival-team-a-existing**

## Approved application
- Emily's exact approval received Nov 25, 2026. Original CHECKSUMS.sha256 passed unchanged.
- Preflight repeated immediately before application: 90 open checks, 90 checks to move, 90 tickets to move; new-check Team A rule present; no previous application audit.
- Applied as one data-only transaction at 03:49:21 UTC, not a schema migration. `apply.data.sql` replaces the approved temporary snapshots with materialized query snapshots; identical filters, updates and saved old values. Both versions were compared in isolated practice.
- Practice verifies 90 checks and tickets move, closed/cancelled checks remain unchanged, owners and dates stay unchanged, audit retains old values, undo restores all rows, and an error rolls back the whole transaction. This is a reduced-schema fixture, not a full live database clone. Live update triggers were inspected separately.
- Readback: 90 checks and 90 tickets moved; zero remaining open checks or linked open tickets outside Team A. Audit `7bf51912-41f2-4d56-a0b6-6e6f231d4cf4` retains old values for all 180 records.
- Before/after whole-table fingerprints match for checks excluding team, tickets excluding role and normal updated timestamp, and every non-open check in full. Ownership, status, deadlines and stored clocks unchanged. Existing ticket update timestamps advance normally.
- Preview build log says build OK. No UI edits, no browser save, no full test suite rerun, no switch changes and no publication.
