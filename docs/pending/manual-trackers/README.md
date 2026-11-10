# Build 14: Team records, Coaching, Weekly scorecard (register BN7, BN8, BN9)

Applied Nov 10 after the isolated database test passed: `drizzle/migrations/0328_manual_trackers.sql`,
byte for byte the same as `01_manual_trackers.sql` (checksums in `sha256.json`).

## What 01 adds
- Fact kinds `records_check` and `records_check_review` on `scorecard_records` (add only, as before).
- Tables `team_record_draws`, `team_record_check_picks`, `weekly_scorecard_drafts` (reads through checked functions).
- Settings in `app_settings`: `team_records_settings` (5 a coordinator, 5 double checks), `coaching_settings`
  (1 a coordinator a month, per coordinator overrides), `weekly_scorecard_settings` (first due Thu Nov 19).
- Functions for the draw, review, skip, double check, coordinator view, coaching log, weekly scorecard
  (draft, submit, decide, weeks), settings and Needs you now (`trackers_waiting`).
- Replaces two Build 13 functions so the engine reads the new facts: `private.bonus_facts` (adds
  `team_clean_records`, `pc_clean_records`, `weekly_report`, coaching per coordinator) and
  `private.bonus_measure_built` (all measures now built).
- One job `team-records-draw`, Mondays 11:05 and 12:05 UTC; the draw runs only at or after 6 AM Central, so one of
  the two runs does the work in each clock season and the other adds nothing.

## Undo
`undo/01_manual_trackers.sql` restores the Build 13 functions, removes the job, the new functions, tables and
settings, and restores the old fact kinds only if no tracker facts exist. Run only with Emily's approval.

## Practice
`practice_01_manual_trackers.sql` ran once on the real database and cancelled itself. A read afterwards found
0 draws, 0 tracker facts, 0 practice shift ends, the settings unchanged and the Supervisor counting start Nov 16.
