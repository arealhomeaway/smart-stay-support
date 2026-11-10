# Build 13: bonus engine, My bonus, verify chain, Finance view

Applied Nov 10 after the isolated database test passed: `drizzle/migrations/0327_bonus_engine.sql`,
byte for byte the same as `01_bonus_engine.sql` (checksums in `sha256.json`).

## What 01 adds (nothing existing is changed)
- 12 tables (`bonus_plans`, `bonus_period_amounts`, `bonus_goals`, `bonus_goal_thresholds`, `bonus_participants`,
  `bonus_priorities`, `bonus_settings_history`, `bonus_periods`, `bonus_period_history`, `bonus_manual_measures`,
  `bonus_adjustments`, `bonus_questions`). Direct reads: COO, CEO and Admin only. Everyone else reads through
  checked functions. History tables cannot be changed or deleted.
- Seeds every number in `docs/specs/bonus-guide-values.md` B, C and D. The Finance packets goal is seeded Inactive.
- Engine `private.bonus_compute` follows section A: share per level, skipped goals move their share, fewer than
  3 measured goals pays the full Goal met amount, never more than Exceeds, a COO-approved system problem counts at
  Goal met or the actual level, whichever is higher; excused records need a reason and the COO's approval.
- Never counted: demo and test records, imported Notion tickets, archived tickets, anything before the counting start.
- One hourly job `bonus-periods` (minute 17): one Needs you now item and email when a period closes, one reminder after 2 days.

## Undo
`undo/01_bonus_engine.sql` removes the job, every function and every bonus table. Run only with Emily's approval:
it deletes all bonus settings, periods and verifications.

## Practice
`practice_01_bonus_engine.sql` ran once on the real database and cancelled itself; a read afterwards found
0 periods, 0 entries, 0 requests, 0 questions and 0 bonus notifications kept, and the plans unchanged.
