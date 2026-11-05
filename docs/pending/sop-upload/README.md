# SOP Upload, staged only

Do not apply or publish without separate approval. No real SharePoint or AI calls were made in testing.

## Apply order and dependencies

1. Apply `docs/pending/playbooks-nov5/01_playbook_editing.sql` first after its own approval and checks.
2. Verify this folder's checksums, schema dependencies and existing function names.
3. Apply `01_sop_upload.sql` byte-for-byte only after approval.

Dependencies: public profiles, playbooks, playbook_steps, existing staff predicates, `can_manage_playbooks`, `save_playbook_draft`, and `change_playbook_state`. No existing playbook, checklist template, Ticket or Task is modified by this setup.

## Behavior

Admin and both Director seats see Upload. Word and text-based PDF originals up to 20 MiB are read locally in the browser and sent to the authenticated server. Scanned or encrypted/unreadable PDFs fail before saving. Full text above 180,000 characters asks for smaller SOPs rather than silently truncating policy. File identity for later versions is its original filename, case-insensitive; upload the same filename to create a later version.

SharePoint remains master: ARHA Resolve site's Documents library, SOPs folder, original basename plus ` v{n}` before extension. Only Resolve's existing service-account connection is used. No workspace connector or per-uploader Microsoft login. SharePoint upload sessions preserve the 20 MiB limit and refuse replacement collisions.

The existing Coach model/provider path generates ordinary playbooks, not guided checklist templates. Existing situation IDs and checklist category tags are recorded; they never activate a checklist flag, change routing or introduce tiles. Draft content must only reflect the SOP; uncertain source interpretation is marked Check this. Approval still uses the canonical playbook approval action and history.

Saved SOP versions record title, original name, version, owner, effective date, uploader/time, SharePoint link and item identity. A caller-owned reservation prevents concurrent uploads choosing the same version. Only the final transactional commit creates draft playbooks and saved SOP metadata. Later versions create replacements for each active linked playbook and leave those active rows unchanged. Needs review is projected from saved SOP lineage, not a new lifecycle status. Side-by-side review includes Consider, Do first, Escalate if, evidence and ordered steps. Editing later drafts preserves SOP provenance.

## Failure safety

AI and reading failures create no records/files. A confirmed SharePoint or commit failure cancels the session, removes this upload's file, and aborts its reservation. A lost commit response is reconciled through the caller-authenticated receipt before deleting anything. If receipt lookup or cleanup cannot be confirmed, the app does not falsely say Saved nothing; it asks for a check before retrying and retains the reservation. No automatic retries occur. SharePoint and database are separate systems, so cleanup is compensating, not a distributed atomic transaction. Creation of an empty SOPs folder can remain after an upload fails.

If an unfinished reservation remains, an Admin must verify SharePoint item identity and the saved receipt before releasing it. Do not delete a master file or clear a reservation blindly.

## Undo

`01_undo_sop_upload.sql` removes only new SOP functions, tables, and the provenance trigger. It does not remove generated playbooks or touch SharePoint. Do not run after real uploads until SOP metadata and lineage are exported and recovery is approved. Earlier playbook editing setup is not undone here.

## Verification

Mocked SharePoint/AI orchestration tests plus isolated PostgreSQL tests cover saving drafts, inactive state, v2 replacement and review projection, server permissions, failure rollback and uncertain commit receipts. Browser checks use a local Word fixture, mocked accounts/save responses, and no real session; desktop/mobile dialog and text extraction passed. Real authenticated SharePoint/AI saving remains unverified because publishing, migrations and real uploads are not approved.