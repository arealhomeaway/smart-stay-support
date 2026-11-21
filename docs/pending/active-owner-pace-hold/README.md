# active-owner-pace-hold (staged, not applied)

Hold pace emails for 7 days after the team or a data fix changes a homeowner's counted hours.

**What it adds (additive only)**
- `owner_programs.pace_emails_held_until` (timestamptz, empty by default).
- `private.hold_pace_after_correction()` and trigger `owner_time_correction_pace_hold` on `owner_time_entries`
  (AFTER INSERT, or UPDATE OF amends_entry_id / correction_reason). It sets the date to now + 7 days when the row is a
  correction entry, an amends link or a correction reason, and the writer is not the homeowner who owns the entry
  (`auth.uid()` empty or different). Her own log, edit, add more and resubmit run signed in as her and never set it.
- One audit line.

**What reads it (code, already in the preview)**
- `src/lib/owner-progress-alerts.server.ts`: while the date is in the future the five-minute pass drops
  progress_pace, progress_checkpoint, progress_milestone and progress_quiet (`src/lib/pace-hold.ts`). Celebration and
  final days notices and team follow-ups still run. Until this is applied the code reads no column and nothing changes.
- Board row and the home's Active Owner section show "Hours corrected. Pace emails resume [Mon D]."

**Does not change** any hour entry, count, the hours lock, or any existing function. The program record's
lifecycle guard does not need a change: the trigger runs as the trusted owner (postgres), checked in preflight.

**Steps**: `preflight.sql` (all ok = true), then `apply.sql` as one migration. `practice.sql` = apply + cases on DEMO
Willow Creek Cottage + undo, always rolled back. `apply.undo.sql` removes the trigger, function and column.

**Practice result (Nov 21, live database, rolled back)**: homeowner log: no hold; homeowner edit (amends the edited
entry): no hold; team correction: hold set to exactly 7 days, resumes Nov 28; data fix amends link: hold set; data fix
reason only: hold set; other field change: no hold; Shannon untouched (65 entries, 33 counted, 2,523 min, no hold);
0 owner notices, 0 emails; 1 chat line (from the homeowner log itself, existing behavior); hours lock on; after undo
column, function and trigger gone.
