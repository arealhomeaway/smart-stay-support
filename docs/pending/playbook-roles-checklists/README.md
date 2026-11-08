# Playbook history role and Ticket checklist editors

Emily's answers D1 and D2 (Nov 8, 2026). Register line A15: "Ticket checklists follow the same rule."

## What changes

1. `01_playbook_history_role.sql`: `public.change_playbook_state`, one line. New playbook history
   lines record whoever holds or covers the Operations Supervisor role as `ops_supervisor`
   (shown on screen as Operations Supervisor) instead of `staff`. Admin and both Directors are
   recorded exactly as before. Old history lines are never edited.
2. `02_ticket_checklist_editors.sql`: `public.publish_ticket_checklist`, the permission check and
   its message. Before: Admin or the Director of Operations. After: the playbook editor rule
   `public.can_save_playbooks` (Admin, Director of Operations, Director of Onboarding, and whoever
   holds or covers the Operations Supervisor role). Every other account, Finance included, views
   only. Versioning, retiring the prior version and the audit line are unchanged.

Both are `CREATE OR REPLACE` of the live copies in `live-capture/` (read Nov 8, 2026), so the
signature, security definer, search path and grants (authenticated, service_role) stay the same.
`public.can_save_playbooks` itself is unchanged.

The screen reads the same rule: `src/routes/_authenticated/ticket-checklists.tsx` uses
`canEditPlaybooks`, the Ticket checklists tab and page open for every staff account (`playbooks_view`).

## Undo

`02_ticket_checklist_editors.undo.sql`, then `01_playbook_history_role.undo.sql`. Each restores the
live copy exactly.

## Proof

`src/lib/__tests__/playbook-roles-checklists.test.ts` (isolated database and screen rule).

## Applied

- Nov 8, 2026, approved by Emily (answers D1 and D2). Checksums in `sha256.txt` matched before
  anything ran and both live functions matched `live-capture/` exactly.
- 01 APPLIED byte-for-byte as migration 0292 (`drizzle/migrations/0292_playbook_history_role.sql`).
- 02 APPLIED byte-for-byte as migration 0293 (`drizzle/migrations/0293_ticket_checklist_editors.sql`).
- Read back: both functions are still security definer with search path public, private and the
  same grants (authenticated, service_role).
- Cancelled live check (nothing kept, checked afterwards): the Operations Supervisor approved a
  practice playbook and the history line saved `ops_supervisor`; the Operations Supervisor
  published a lockout checklist version and the Director of Onboarding a cleaning version; the
  Finance lead was refused with "Only Admins, Directors and the Operations Supervisor can publish a
  ticket checklist." Afterwards: 6 checklists all still version 1, 0 history lines, 0 publish audit
  lines, no practice playbook. Same as before.
