# weekly-hours-report (staged, not applied)

Adds the weekly Active Owner hours report. Apply only after "Approved: apply weekly-hours-report".

- New tables: ao_hours_reports (one per program per week, unique), ao_hours_report_homes (text saved on each home's Owner tab), ao_hours_report_holds (Hold this week), ao_hours_report_edits (who and when for every Admin edit).
- New functions: save_ao_hours_report_settings (Admin only), hold_ao_hours_report (staff), ao_record_hours_report (scheduled job only).
- Changed: ao_owner_email_run. A held hours report joins that day's one email as its top section, or goes alone. The one-email-per-owner-per-day limit is unchanged. Everything else in the daily email is byte for byte the same (see current-ao_owner_email_run.sql).
- Settings live in app_settings key ao_hours_report. Defaults apply until an Admin saves.

Preflight: run preflight.sql (read only). run_md5 must be 476d9d4bd0bb974d10a1cd2b8760bc77.
Practice: not possible from this workspace (no rights to create tables); the same text was checked by diff against the live function.
Undo: apply.undo.sql restores the live ao_owner_email_run and drops the three new functions. Tables are kept so sent history and the edit log stay.
Checksums: SHA256SUMS.
