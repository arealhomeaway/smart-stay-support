# Playbook editing, Nov 5

Build and test only. Nothing in this folder has been applied. No real playbook was edited, approved or archived.

## Approved application correction, Nov 5 at 22:23 UTC

Emily approved removing only the first `BEGIN;` line and last `COMMIT;` line from `01_playbook_editing.sql`. All interior bytes remain unchanged. The migration tool supplies the transaction. SHA256SUMS is updated; the undo is unchanged. Application is authorized, but real playbook editing, approval, archival and publishing remain prohibited. The build-only statements below describe the original build.

## Read-only inventory

- Checklist build: Nov 4–5, from Emily's Guided Ticket Checklists request and exact six seeds. Live schema/seeds were applied Nov 5 at 03:29 UTC. All six switches are off.
- 29 ordinary playbooks: 15 Draft, 14 legacy active (normalized as Approved). Six additional approved checklist templates.
- Duplicate exact title: Appliance not working (one draft and one active, different content and keys).
- Empty: TEST 1, active, no steps or guidance. Drafts with guidance but no ordered steps are not empty.
- No records were repaired or archived during this build.
- Separate unresolved intake issue: Booking and Other guest complaint both map to guest_needs_now. The current simplified situation-only intake selects the first category, Other guest complaint. No new tiles or mappings were added here.

## Pending migration

1. Check SHA256SUMS and live dependencies before applying `01_playbook_editing.sql` exactly.
2. Dependencies: existing playbooks/playbook_steps/playbook_approvals/work_types, auth.uid, has_role, is_director, is_onboarding_director, is_internal_staff. New function/trigger names and playbook_approvals.version must be absent.
3. No new tables, policies, grants on tables, seed data or backfill. New RPC execution grants are authenticated/service_role only, never anon or PUBLIC.
4. `can_manage_playbooks` admits Admin, the existing Operations Director rule (including cover), and the existing Onboarding Director rule.
5. `save_playbook_draft` writes a draft in place; any other version makes a new inactive draft. Family advisory locking and updated_at conflict checks prevent competing versions and stale saves. Existing matcher facets, vendor brief, provenance, policy markers and active version content remain intact.
6. `change_playbook_state` atomically records approval/archival/review history. Approval retires prior active family rows and points existing work-type defaults at the newly approved row. Existing tickets and copied ticket steps never change. Archive is retired+inactive and stays visible in history.
7. Existing RLS stays intact. Security-definer actions verify the caller before narrow writes. Direct ordinary content/step/history writes are guarded, and playbook hard deletes are refused. Checklist rows retain their existing publishing path.
8. Description uses the existing summary field. Approval version is added to existing playbook_approvals; old entries display their parent version without backfill. Actor names resolve from profiles by stored actor_id.

## Undo

`01_undo_playbook_editing.sql` removes only the added functions, triggers and approval version column. Existing RLS/functions are not replaced. It does not delete or reverse future authored versions, approvals, archive choices or work-type pointer updates. If application writes have happened after application, capture those changes and obtain separate approval for any data restoration. Undo removes version values but retains approval records and their parent playbook version.

## Validation

- Isolated PostgreSQL tests execute the exact staged SQL, not the live database: draft-in-place, active-to-draft, old content retained until approval, atomic activation/history/default switch, existing tickets retained, Admin/both Director authority, staff review-only, anonymous refusal, archive exclusion, direct bypass refusal, stale saves, duplicate drafts, rollback and new draft creation.
- Synthetic browser editor checks cover all fields, multiline lists, step add/remove/reorder, required/photo flags, saved output, desktop/mobile. No signed-in or real-record end-to-end save is verified because applying this migration and real writes are prohibited.
- Editing/approval/review saves have no browser-write fallback when the staged functions are absent; they report that setup still needs to be applied. Apply before publishing these changes.