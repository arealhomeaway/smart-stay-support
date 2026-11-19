# closure-evidence-breezeway (staged, not applied)

Emily, Nov 19. Photos come through Breezeway for now, so Resolve does not ask for a photo or file to close these
tickets. Data and wording only. No code changes. The photo rule stays in the code
(evidence-requirements.ts, closure-evidence.ts, ticket-lifecycle.ts, ticket-lifecycle.server.ts untouched).

## What it changes
1. `work_types.required_closure_evidence` (3 rows, matched by id and by today's exact text):
   - Immediate maintenance (e110029f): "Photos before and after, what was repaired ..." becomes
     "What was repaired or replaced, vendor name, and confirmation every smoke, CO and security device in the home
     was checked and left working"
   - Ongoing maintenance (a5b90e0e): "Work performed, vendor, and photo of the completed work" becomes
     "Work performed and vendor name"
   - Immediate cleaning need (c2214621): "Photos of the cleaned area and who completed it" becomes
     "Who completed the cleaning"
   The closing rule reads this text when a ticket is closed, so none of the three asks for a file any more; the
   written closing evidence is still required. This applies to open tickets of these types too (7 today).
2. Maintenance ticket checklist: version 2 is published with exactly what the publish action writes. Only step 9's
   question changes: "Work done? Upload vendor photo or invoice." becomes "Work done? Check the vendor photos or
   invoice in Breezeway." Every other step, option ("Uploaded"), action and setting is identical (checked in practice).
   Version 1 is retired, not changed. New tickets get version 2. The 4 tickets already on version 1 keep it,
   and the 2 existing ticket steps holding the old words are not touched.
3. Audit: 3 rows `work_type_closure_evidence_changed` and 1 row `ticket_checklist_published`.

The publish action needs a signed-in person, so apply.sql repeats its exact writes with no person recorded as
approver (version 1 also has none). The reason line records Emily's Nov 19 request.

## Files
`preflight.sql` (read only; every row ok = true), `apply.sql` (one DO block, one transaction, refuses if anything
moved), `apply.undo.sql` (restores the three texts and republishes the version 1 body as version 3; versions 1 and 2
and every ticket pin stay), `practice.sql` (apply, checks, undo, checks, forced error), `SHA256SUMS`.

## Practice (Nov 19, live database, rolled back)
- After apply: the three new texts; 0 of the 3 still ask for a file; live maintenance checklist v2 with the new
  question and otherwise identical to v1; v1 retired; 4 tickets still on v1; 2 old ticket steps unchanged; 4 audit rows.
- After undo: the three old texts; live maintenance checklist v3 with the v1 body (same checksum).
- Afterwards: preflight all ok, one maintenance version, v1 approved, 0 audit rows kept.
- The app's own rule (requiresPhotoOrFile) returns false for the three new texts and true for an old one.

## Apply
Only on `Approved: apply closure-evidence-breezeway`: checksums, preflight, apply.sql, then read back.
