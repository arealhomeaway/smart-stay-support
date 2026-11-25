# guest-ready-standards (staged, not applied)

Change 1 of 5, items 1 and 2 (Operations walkthrough, Nov 24).

**Needs ticket-due-date applied first.** Live check Nov 24: `tickets.due_on` and `set_ticket_due_on` do not exist,
so the Due date itself is not live yet. That package was staged Nov 18 and never applied; its Notion due dates were
read Nov 18. Apply order: `ticket-due-date`, then this one.

## What it changes
- New table `guest_ready_standards` with the seven starting rows. Staff read; Supervisors, Directors and Admin save
  through `save_guest_ready_standard` (same editor rule as playbooks). Rows are never deleted. Audit row per save.
- `tickets.due_locked`.
- `private.ticket_due_on_default` (from ticket-due-date) now reads the ticket's row. Locked rows set the date; Not set
  keeps P1/P2 today, P3 + 7. Quiet imports untouched. Arrival check: the date is not worked out here.
- Trigger `tickets_due_lock_guard`: a locked date is refused unless changed through `set_ticket_due_on` with a reason.
- `set_ticket_due_on(ticket, date, reason)` replaces the two-argument version. Unlocked: same as before. Locked:
  Supervisor, Director or Admin only, reason required, added as an update on the ticket with the person.
- Open tickets whose row is Locked get `due_locked = true`. No date, owner, status or clock changes.

## Not changed
Clocks, SLA, routing, alerts, scorecard capture, Breezeway bridge, OwnerRez sync. No email, no notice.

## Files
`preflight.sql`, `apply.sql`, `apply.undo.sql`, `practice.sql`, `CHECKSUMS.sha256`.
Practice: not run yet; it needs ticket-due-date in place (run both inside one rolled-back transaction).

Apply only on: **Approved: apply guest-ready-standards**
