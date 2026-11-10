# Email intake follow ups (Emily, Nov 9, register E1)

Status: STAGED ONLY. Not applied. Email intake and its timed check stay off.

## What this changes in the database

`01-one-switch.sql` replaces one function, `public.set_email_intake`, from the safety batch (0314).
No table, column, policy, setting or scheduled job is added or removed.

- Before: turning email intake on moved the start line and recorded who and when. The timed check
  (`resolve-mailbox-sync`, every minute) had to be turned on by hand afterwards.
- After: the same, plus the timed check follows the switch in the same database step. On starts it,
  off stops it. If the timed check is missing, turning on is refused and nothing changes. If any part
  fails, the whole step is undone, so there is never a half on state. Asking for the position it is
  already in only repairs a timed check left out of step, and records that.
- Unchanged: Admin only; the start line only moves forward; the switch cannot be flipped directly;
  the history row per change.

The step "Turn the timed check on by hand" in `docs/pending/email-intake-safety/README.md` is no longer
needed once this is applied.

## Practice

- Isolated copy: `src/lib/__tests__/email-intake-followups-sql.test.ts` (safety batch, then this change,
  then undo).
- Real database, Nov 10: one step that a coordinator was refused in, an Admin turned intake on (the
  timed check started, the start line moved) and off (the timed check stopped), two history rows. The
  step then stopped on purpose; afterwards the switch was off, the timed check off, the start line still
  2026-09-01T23:20:20Z, no switch history, the old function still live, no test records.

## To apply (only with Emily's okay)

1. Check `sha256.json`.
2. Apply `01-one-switch.sql` as a migration, byte for byte.
3. Confirm the switch and the timed check are both still off.

## Undo

Turn email intake off first, then run `undo.sql`. It puts back the safety batch function exactly
(checked against the live function text). History rows are records and stay.

## Code changes that need no database change

- (a) Test records show, with their Test chip, to the Admin, the Operations Supervisor and the
  Directors, in a separate uncounted list on the Team Queue and Direct Bookings, and open on the ticket
  page and the request page. Coordinators do not see them. Counts, totals and approvals read only real
  records, as before.
- (c) Run intake now is hidden.
- (e) The switch row and the status panel show the switch and the timed check, and say plainly if they
  ever differ.
