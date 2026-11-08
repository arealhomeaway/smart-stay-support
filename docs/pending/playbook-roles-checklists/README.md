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

See the end of this file once applied.
