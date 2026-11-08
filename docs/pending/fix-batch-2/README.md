# Fix batch 2: access blockers

APPLIED Nov 8, 2026 with Emily's written approval. See the note at the end.

Approved by Emily (Nov 8, 2026). Nothing in this folder has been run against the live
database. Apply only with explicit approval, in the order below, with the migration tool,
byte for byte, after checking `sha256.txt`.

| Order | File | Item | Undo |
| --- | --- | --- | --- |
| 1 | `01_playbook_supervisor_save.sql` | 1. Operations Supervisor saves playbooks | `01_playbook_supervisor_save.undo.sql` |
| 2 | `02_operations_invites.sql` | 2. Operations leadership adds Operations users | `02_operations_invites.undo.sql` |
| 3 | `03_email_templates_onboarding_director.sql` | 3. Director of Onboarding saves templates | `03_email_templates_onboarding_director.undo.sql` |
| 4 | `04_vendor_editors.sql` | 4. Director of Onboarding, Project Manager, Utilities edit vendors | `04_vendor_editors.undo.sql` |
| 5 | `05_direct_booking_settings_admin.sql` | 10. Admin saves Direct Bookings settings | `05_direct_booking_settings_admin.undo.sql` |

`live-capture/` holds the live definitions read on Nov 8 that files 1 and 5 replace and the
undo files restore (`save_playbook_draft`, `save_direct_booking_settings`), plus
`can_manage_playbooks`, which is unchanged and used by the test.

## What each part does

1. **Playbook saving.** New `can_save_playbooks(user)`: the existing Admin and Director rule
   (`can_manage_playbooks`) plus whoever holds or is covering the Operations Supervisor role.
   `save_playbook_draft` changes one line: it checks `can_save_playbooks`. Approve, archive
   and SOP upload keep `can_manage_playbooks` and are not touched.
2. **Operations invites.** New `can_invite_operations_users(user)`: the Director of
   Operations, or whoever holds or covers the Operations Supervisor role. Three new policies on
   `team_invites` let them create, read and update codes whose account type is Coordinator
   (`tech`) or Supervisor (`manager`) only. Admin policies are unchanged. Redeeming a code is
   unchanged.
3. **Email templates.** Two new policies let the Director of Onboarding create and change
   (including retire) shared templates. Reading is unchanged. Removing stays with Supervisors.
4. **Vendor editing.** New `can_edit_vendors(user)`: Supervisors and Admin (as today), the
   Director of Onboarding, and the Project Manager and Utilities roles. New policies let them
   create and update vendor companies, and save service areas and home coverage. Unchanged:
   vendor status, Gold Standard and compliance fields (the existing `vendor_orgs_guard`
   trigger still refuses them for non-leadership), screening results, documents, vendor
   logins, imports, column definitions and saved views. Design is not included.
5. **Direct Bookings settings.** `save_direct_booking_settings` also allows Admin. Quote
   approval is a separate rule and is not touched.

Every file is additive. No existing policy is dropped or rewritten.

## Proof run before staging

- Isolated database tests: `src/lib/__tests__/fix-batch-2-sql.test.ts` (each replaced function
  differs from its live copy only in its permission check; each role allowed and refused as
  listed; Admin still sees every invite; each undo removes what its file added and restores
  the live functions).

## App code that depends on these parts

Until applied, the screens offer the new actions but the database refuses them with a plain
message, and nothing is saved: Operations Supervisor playbook saves (1), Operations leadership
invite codes (2, the list shows empty), Director of Onboarding template saves (3, "The
template was not saved"), vendor saves by the Director of Onboarding, Project Manager and
Utilities (4, the existing Supervisor rule is used until `can_edit_vendors` exists), and Admin
Direct Bookings settings saves (5).

## Screen change made with the apply (Nov 8, 2026)

Emily's answer: the Director of Onboarding, Project Managers and Utilities do not see the
Database tab, Needs Review or the screening panel on the Vendors page (hidden, not shown and
refused). They keep the vendor list, profiles and the edits in part 4. Rule in
`src/lib/vendor-page-views.ts`, test `src/lib/__tests__/vendor-page-views.test.ts`.

## Applied

- Nov 8, 2026: `sha256.txt` checked first (all files OK). APPLIED byte-for-byte as
  migrations 0284 (`01_playbook_supervisor_save.sql`), 0285 (`02_operations_invites.sql`),
  0286 (`03_email_templates_onboarding_director.sql`), 0287 (`04_vendor_editors.sql`) and
  0288 (`05_direct_booking_settings_admin.sql`). Each migration file matches its staged file
  exactly. The two replaced functions differ from `live-capture/` only in the staged
  permission line and its message.
  Undo order if ever needed: 05, 04, 03, 02, 01.
