# Nightly backup to SharePoint (staged)

Rebuilt Nov 5 2026 from the backup code already in the app (`src/lib/nightly-backup*.ts`,
`src/routes/api/public/hooks/nightly-backup.ts`, `NightlyBackupPanel`). The original folder
was missing from the project and has no record in project history.

Apply order:
1. `01_backup_runs.sql` - run history table read by Admin > Integrations. Undo: `01_backup_runs.undo.sql`.
2. `02_schedule_backup.sql` - creates a random token held only in the database
   (`private.backup_cron_token`), a service-role-only check `backup_verify_cron_token`, and the
   07:00 and 08:00 UTC calls (header `x-cron-secret`); only 2 a.m. Central runs. Same pattern as the
   cleaner-hours job. No app secret and no vault copy. Undo: `02_schedule_backup.undo.sql`.

Admins can also press "Run backup now" on Admin > Integrations; it uses the same backup step,
role-checked on the server.

Exports: tickets, ticket_activity, work_orders, claims, guest_recovery, guest_recovery_ledger,
expenses, onboarding_tasks, as CSV in ARHA Resolve > Documents > Resolve Backups > <date>.
Retention 60 days, only folders recorded in backup_runs.
