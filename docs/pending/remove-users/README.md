# Remove users: pending database change

Nothing here has been applied.

| File | What it does | Undo |
|---|---|---|
| 01_remove_users.sql | Adds removed_at/removed_by and archived_at/archived_by to profiles (nullable). Adds a guard that refuses any profile delete. Adds staff_open_work, reassign_staff_open_work, remove_staff_user and set_account_archived (Admin only, audited). | 01_undo_remove_users.sql |

Design: nobody's row is ever deleted.
- Staff "Delete user" keeps the profile as a tombstone: roles, seat memberships, departments, staff notifications, future on-call nights and the on-call pattern entry are removed; the server action then turns the login off permanently. Past records keep pointing at the same row and show "Name (former)".
- Because no sign-in account is deleted, none of the ON DELETE CASCADE keys to the sign-in account (owner_time_entries, staff_notifications, vendor_org_members, vendor_attestations, vendor_job_ratings, department_members, user_notification_preferences, profiles, user_roles) can fire. The delete guard on profiles is the backstop: any sign-in account delete then fails as a whole instead of cascading. No foreign key is changed.
- Homeowners, co-owners and vendors are archived: login off, roles kept, every hour, approval, document, work order, invoice and payment unchanged. Restore turns the login back on. The participation report reads hours by home, so Admins can still download it.
- Delete is blocked while the person owns open tickets, onboarding Tasks, Work Orders, pending approvals or seats. "Reassign all" sends tickets to their seat, then the backup seat, then the Operations Supervisor; Tasks to the Onboarding Director; Work Orders and approvals to the Operations Supervisor; seats are emptied.
- Every delete, reassignment, archive and restore writes audit_log with the actor and time.

Privileges: execute for authenticated only (functions check Admin inside); PUBLIC and anon revoked.
Undo keeps the four columns (marked retired) so recorded removals and archives are not lost.
Isolated test: src/lib/__tests__/remove-users-sql.test.ts.
