# Applied

- When: 2026-11-21 17:56:33 UTC (started 17:55:28), after "Approved: apply hours-double-save".
- Checksums verified (SHA256SUMS all OK). Preflight: preflight.sql stops at the private-schema lookup under
  the read-only session (permission denied), so the same three checks were read from the catalog: Log hours
  action md5 eebeaa3064236750e229914ce101b3af (as captured), Edit and Add more md5
  f360b0cfed229f21574863e160365db7 (homeowner-reopen, live), rule absent. No other difference.
- apply.sql applied unchanged as drizzle/migrations/0359_hours_double_save.sql (diff identical).
- Read back: log_owner_time_entry and owner_update_time_entry contain the guard, run as definer, callable
  by signed-in users only (not anon, not public). private.owner_time_recent_repeat exists, not callable by
  app users. 1 audit_log row (hours_double_save.apply).
- Shannon: 65 entries, 33 counted, 2,523 minutes, 32 links.
- 17:55:28 to 18:06:33 UTC: 0 owner notices, 0 emails, 0 program events, 0 home chat lines, 0 owner
  messages, 0 homeowner updates. The five-minute pass ran at 18:00 and 18:05 and sent nothing.
- Undo: apply.undo.sql.
