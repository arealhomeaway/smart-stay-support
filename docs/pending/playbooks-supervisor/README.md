# Playbooks: the Operations Supervisor edits, everyone else views

Approved by Emily (Nov 8, 2026). Matrix line Playbooks: coordinators view, Supervisor edit,
Director of Operations edit, Director of Onboarding edit, Admin edit, Project Manager,
Utilities, Design and Finance view. Edit means: edit and save, approve or publish a new
version, archive, and upload an SOP file. Fix batch 2 gave the Supervisor draft saving only.

Apply with the migration tool, byte for byte, after checking `sha256.txt`.

| Order | File | Undo |
| --- | --- | --- |
| 1 | `01_playbooks_supervisor.sql` | `01_playbooks_supervisor.undo.sql` |

`live-capture/` holds the six live definitions read on Nov 8 that the file replaces and the
undo restores (`change_playbook_state`, `reserve_sop_upload`, `sop_upload_context`,
`sop_upload_receipt`, `commit_sop_upload`, `abort_sop_upload`), plus `can_save_playbooks`,
which is unchanged and is the editor rule.

## What it does

- Each of the six functions changes one line: its permission check reads the existing
  `can_save_playbooks` (Admin, Director of Operations, Director of Onboarding, and whoever
  holds or covers the Operations Supervisor role) instead of `can_manage_playbooks` (Admin and
  the two Directors). The refusal message names the Operations Supervisor.
- In `change_playbook_state` the check now covers every action. Before, any staff account
  could add a review note or send a draft for review; now only editors can. Approve and
  archive were Admin and Directors only; now editors.
- `save_playbook_draft` already reads `can_save_playbooks` (fix batch 2) and is not touched.
- Unchanged: version history (a save on an approved playbook creates a new draft version),
  approval history lines in `playbook_approvals` (one per approve, archive and replaced
  version), SOP version records and receipts, locks, the write guard trigger, reading rules
  and grants. `can_manage_playbooks` and `can_save_playbooks` are not changed.

## Screens (same change)

- `src/lib/playbook-editing.ts`: one rule `canEditPlaybooks`; the two older names now point
  to it.
- `src/routes/_authenticated/playbooks.tsx`: edit, approve, archive, review and SOP upload
  controls show only to editors; everyone else gets the read only library.
- `src/components/GuidanceCard.tsx`: the link to playbook administration on work screens
  shows only to editors.

## Proof run before applying

`src/lib/__tests__/playbooks-supervisor-sql.test.ts` (isolated database): each function differs
from its live copy only in the permission line; the Supervisor, the Supervisor cover, both
Directors and Admin save, approve, archive and upload with history; a coordinator, a Project
Manager and Finance are refused each and nothing is written; the undo restores the live rule.
