# Nightly backup to SharePoint (staged)

Rebuilt Nov 5 2026 from the backup code already in the app (`src/lib/nightly-backup*.ts`,
`src/routes/api/public/hooks/nightly-backup.ts`, `NightlyBackupPanel`). The original folder
was missing from the project and has no record in project history.

Apply order:
1. `01_backup_runs.sql` - run history table read by Admin > Integrations. Undo: `01_backup_runs.undo.sql`.
2. Add server secret `BACKUP_CRON_SECRET` (32+ characters) in Project Settings > Secrets.
3. The scheduler needs the same value: a database vault entry `backup_cron_secret`.
4. `02_schedule_backup.sql` - 07:00 and 08:00 UTC calls; only 2 a.m. Central runs. Undo: `02_schedule_backup.undo.sql`.

Exports: tickets, ticket_activity, work_orders, claims, guest_recovery, guest_recovery_ledger,
expenses, onboarding_tasks, as CSV in ARHA Resolve > Documents > Resolve Backups > <date>.
Retention 60 days, only folders recorded in backup_runs.
