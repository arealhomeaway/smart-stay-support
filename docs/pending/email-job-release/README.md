# Email job repair — built, not released

> **Superseded status — Oct 20 release prep:** See `RELEASE-PREP.md` for the current results, release list and blockers. The schedule note filename now matches its unchanged journal entry. Full suite: 1,535 passed / 0 failed / 5 skipped (234 fresh processes). Real-schema inspection found and repaired the missing `handoff` mapping in prepared 0152. Real-database rollback-only execution remains NOT VERIFIED: available read/write tools do not support schema-changing rollback transactions, and migration tooling would apply changes. Neither migration was applied. Historical results below are retained, not current release authorization.

## Safety and release status

No project database changes, publish, schedule changes, provider sends, resends, account/seat changes or secret changes were performed in this repair. The `deliver-owner-alerts` job remains absent/off. Temporary PostgreSQL tests used an independent local disposable instance, not the shared backend.

**Not release-ready: migration journal repair remains blocked.** The schedule note was renamed to `0151_resume_existing_owner_notify_schedule.sql`, but the managed journal still references `0150_resume_existing_owner_notify_schedule`. Its indices and tags are unique; its referenced filename is missing, and applied Opportunity migration `0150_opportunity_notifications_link_to_opportunity.sql` is not represented by that journal entry. Hand-editing managed metadata and running Drizzle commands directly are prohibited; the available migration tool also applies changes, outside this build-only authorization. No migration tool was invoked. A supported metadata-only correction is required before any release/migration.

## Timing choice

The prepared command uses a 120-second scheduler wait, instead of returning before the work completes. Each run records its start, completed parts, sent-email counts and errors; a timeout or unfinished run requires review and is never automatically restarted.

This wait reduces the observed five-second timeout; it does not guarantee that a large batch finishes within 120 seconds. The job stops subsequent components on an error. Unexecuted components remain distinguishable because they have no part result; zero counts do not imply execution. A failed audit write leaves the run unfinished. Callback-generated progress alerts carry a run ID so the immediate callback does not race the scheduled owner drain (prepared audit migration only).

Authentication uses the existing server-only stored-token method already used by the cleaner nightly job, instead of treating the browser-visible publishable key as authority to send mail. No token value is copied into code or the prepared command. This route change and the recreation command must ship together.

## Changed code

- `src/lib/email-safety.server.ts`: all To/additional To/CC/BCC addresses; explicit demo flags; database record/account verification; fail closed if verification is unavailable.
- `src/lib/email.server.ts`: shared final delivery guard and run attribution; an audit failure after provider acceptance never retries that accepted send.
- `src/lib/owner-progress-alerts.server.ts`: reads program demo state; demo alerts remain in-app, email/text skipped; insert errors surface.
- `src/lib/deadline-alerts.server.ts`: demo deadlines remain in-app; removed nonexistent `claims.ref` read which would otherwise stop the pass.
- `src/lib/owner-notify.server.ts`, `staff-notify.server.ts`, `email-composer.server.ts`, `owner-welcome.server.ts`: source context/run attribution and surfaced delivery failures; scheduled blocks stay skipped.
- `src/lib/email-job.server.ts`, `src/routes/api/public/hooks/owner-notify.ts`: audited sequential execution and verified server-only cron token.
- `src/lib/AGENTS.md`, `roadmap.md`: safety architecture and completion/blocker records.
- Tests: `email-safety.test.ts`, `owner-progress-demo.test.ts`, `email-job.test.ts`, `email-sender-boundary.test.ts`.

## Prepared migrations and command — NOT APPLIED

1. `0152_email_delivery_safety.sql`: final record/account checks plus owner-notification source trigger. No backfill/schedule. A release prerequisite: without its RPC the new shared sender intentionally refuses delivery, including live messages.
2. `0153_email_job_run_audit.sql`: audit storage, attribution fields, guarded run RPCs, and suppression of immediate callbacks for scheduled-run alerts. This is more than demo blocking and therefore cannot be applied under the current DB authorization.
3. `recreate-schedule.sql`: exact `deliver-owner-alerts`, `*/5 * * * *`, stored token lookup, empty body, 120000-ms wait. NOT RUN. Refuses any matching endpoint job (including inactive) so a future operator must inspect/reuse an existing job rather than blindly recreate it.

## Verification

- Entire test inventory, run one file per fresh process: **1,529 passed, 0 failed, 5 existing skipped**, 232 files. Fresh processes are required because existing welcome/financial-delivery tests mock the shared sender globally; a single combined Bun process contaminates the sender-boundary tests (three failures). No production mail provider was called; actual-sender tests replace fetch with a local 202 response and use fake keys.
- Automatic compiler/build log: **build OK**, latest observed 2026-10-20 14:25:03 UTC (includes type checks). No manual project build or typecheck was run; the platform runs these automatically.
- Both prepared SQL files executed in the disposable database with minimal independent fixtures. Concrete assertions passed: `.invalid` blocked, demo record to real staff blocked, live record allowed, demo insert remains in-app/skipped, run start/part/finish and staff=1/owner=0 counts. This validates syntax and isolated rules, **not full shared-schema integration or provider behavior**.

## Read-only first-pass forecast (Oct 20, approximately 14:18–14:23 UTC)

| Part | Stored/work candidates | Expected emails after repair |
|---|---|---|
| Staff backlog | 0 pending; 78 skipped, zero attempts retained | 0 backlog emails |
| Ticket deadlines | 1 real overdue action-start alert (Ticket `4c066921-7123-4cac-9581-e4a9146490bb`), recipient James Almario; 18 demo overdue Tickets | At most 1 real staff email, subject to current preference/access/guard; 0 demo |
| Vendor dispatch deadlines | 1 demo no-ack candidate; no real candidate | 0 emails |
| Claim deadlines | 2 demo passed-deadline candidates; no real candidate | 0 emails; isolated recipient routing still applies |
| Vendor compliance expiry | 0 verified-expiry rows within 30 days | 0 |
| Transitional vendor reminders | 76 real flagged vendors; earliest deadline Nov 29, outside 14/7/1-day windows | 0 |
| Owner pending alerts | 3 pending demo alerts; no pending real alert | 0 emails; demo rows remain in-app |
| Progress | 2 demo active programs and 1 real active program; real program has 1,819 minutes (30.32h), no open Opportunities, last activity Oct 19; no recent real alert log | Real pace email not indicated by the current snapshot; demo candidates cannot email. Exact new demo in-app alert count not independently replayed against full aggregates |
| Scheduled emails | 0 due rows | 0 |
| Welcomes | 0 rows; absent stored template resolves to unapproved draft | 0; wording gate unchanged |

Overall forecast: **0 demo/test emails, at most 1 staff email; 0 vendor/homeowner emails indicated**, not a send authorization. Staff email uses Microsoft 365 / `info@arealhomeaway.com`. No automated SMS provider or Telegram send exists in this pass; urgent owner SMS flags create internal contact work only. Counts are time-sensitive and must be refreshed before enabling. Preference/access checks for James and complete demo progress aggregates remain unverified. The missing Claims column is corrected in source only.

## Rollback and unknowns

Keep the schedule off. Before a future approved release, record the exact immediately prior live version; restore that app version if necessary, preserve safety guards/audit history, and do not remove audit columns or data. No rollback has been executed. Do not enable an older publishable-key-authorized sender merely to bypass the new guards. Interrupted welcomes remain `sending` and require review, not automated recovery.

No production run or mailbox delivery has been verified. The SQL draft's source/account coverage was inspected but must be checked against the full schema in an approved isolated copy. Auth-service account email is outside these five-minute components. Journal metadata, coordinated migration/app release, and first-two-run operational acceptance remain blockers; schedules must stay off.