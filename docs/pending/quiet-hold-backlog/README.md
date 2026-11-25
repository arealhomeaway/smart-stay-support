# Quiet hold backlog: completed read-only, no eligible changes

Emily authorized this narrow hold-only task under `Approved: apply ops-simplification`.
This is not an application of the larger staged ops-simplification package.

Live reads on Nov 25, 2026 at 05:46:13 and 05:47:26 UTC found **zero C and zero D tickets**.
No database write was needed or performed. `undo.csv` has no data rows, and `undo.sql`
is deliberately a read-only no-op. No audit or ticket history row was added.

The existing hold does **not** make non-Notion tickets quiet throughout the system:
- `public.run_ticket_timed_alerts()` excludes untouched Notion tickets by external source/status,
  not by `import_hold`; its unowned and waiting-return loops do not have a hold exclusion.
- `src/lib/notion-ticket-display.ts` returns `none` for a non-Notion ticket regardless of hold;
  `visibleClocks` and `withoutQuietNotion` therefore leave it live.
- `SupervisorAttentionBand` does not select `import_hold` and uses `withoutQuietNotion`.
- The Imported tickets page explicitly reads `external_source = 'notion'`.

Accordingly D is skipped as instructed, even if a future read finds D rows.
Do not apply this hold to ordinary tickets as a substitute for missing quiet behavior.
Nothing in a function, trigger, alert, routing rule, app code, switch or schedule was changed.

## Checks
- `preflight.sql`: exact read-only classification used by this task.
- `practice.mjs`: isolated PGlite no-op check using captured real row values,
  plus source-level behavior checks using the unchanged app helpers.
- `REPORT.md`: all group counts and the exact Home calculation, before and after.
- `CHECKSUMS.sha256`: package checksums.

Practice command (input is a temporary capture, not a committed copy of private ticket content):
`QUIET_HOLD_CAPTURE=/tmp/quiet-hold/before.json NODE_PATH=/dev-server/node_modules bun docs/pending/quiet-hold-backlog/practice.mjs`

The larger ops-simplification package remains unapplied. `guest-ready-type-links`,
`database-priority-words`, and `reported-issue-order-links` remain on hold. No publication.