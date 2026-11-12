# Onboarding kinds, completion build (Nov 12): staged, NOT APPLIED

Apply in order, only when approved. Each file has its own undo. Practice runs of every file and
undo pass on an isolated copy: `src/lib/__tests__/onboarding-kinds-2-sql.test.ts`.

| File | Item | What it does | Undo |
|---|---|---|---|
| 01_fill_in_and_follow_ups.sql | 1, 8 | Adds `onboarding_projects.inspection_on` (date) and `onboarding_tasks.follow_up_of` (link to the source Task, same home only, never itself) | 01_fill_in_and_follow_ups.undo.sql removes the rule and index and marks both columns retired; values are kept |
| 02_approval_send_back.sql | 9 | `approval_task_reviewer` (assigned person, else the role holder on the home; null when a step review is configured) and `approval_task_send_back` (required note; reopens finished Show files from steps, notifies each step's person, logs a note, project event and audit) | 02_approval_send_back.undo.sql drops both functions |
| 03_owner_approve_and_outside.sql | 5, 2 | Replaces `respond_owner_opportunity` so Approve on a staff Opportunity marks a Business Decision Task approved as `owner_item_approve` does (plus audit row); adds `owner_outside_resolve_lines` | 03_owner_approve_and_outside.undo.sql restores the live definition captured in `live-capture/` and drops the reader |

Until applied, the app behaves as follows: inspection date shows "Not available yet"; a follow-up
is linked by its text line only; Approval Tasks use the assigned person for Approve and hide Send
back; staff Opportunity Approve keeps today's rule; owner cards keep their current text.

Grants: both new public functions are revoked from PUBLIC and anon and granted to authenticated
and service_role. `respond_owner_opportunity` keeps its existing grants (CREATE OR REPLACE).
