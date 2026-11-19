# ticket-page-fixes (staged, not applied)

Nov 19 request, ticket page fixes. The screen changes are in the preview; these three database changes are what
make items 1, 3 and 4 work for real. Nothing here is applied until "Approved: apply ticket-page-fixes".

## What it changes
1. `private.guard_checklist_answer` (trigger `ticket_steps_checklist_answer`). Today it refuses every change to a
   saved checklist answer. After apply, a team member (the same people the existing `ticket_steps_staff` rule lets
   answer a step) can change a finished step on an open ticket, on its existing row:
   - only `answer`, `answer_fields`, `note` and `not_applicable_reason` may change; who answered, when, the step,
     the ticket and the checklist version are refused;
   - closed, resolved or archived tickets are refused; vendors and anyone not on the team are refused;
   - the same answer checks as a new answer (an answer is required, "doesn't apply" needs a reason);
   - deleting a saved answer stays refused; new answers are checked exactly as today.
   The history line ("Changed answer on ...") is written by the ticket page, with the person and time.
2. `work_types.required_closure_evidence` for Immediate maintenance (e110029f) becomes
   "What was repaired or replaced; vendor name; smoke detector, CO alarm, security device all checked working".
   On a ticket that is not about smoke, CO, alarms or security, the ticket page shows
   "What was repaired or replaced and vendor name" (existing scoping rule, closure-evidence.ts untouched).
3. Maintenance checklist version 3: step 9's only answer reads "Checked" instead of "Uploaded" (the saved value
   `uploaded` stays). Everything else is identical to version 2. Version 2 is retired, not changed. New tickets
   get version 3; tickets already started keep their version.
4. Audit: `checklist_answer_edit_enabled`, `work_type_closure_evidence_changed`, `ticket_checklist_published`.
   Reasons carry no names.

## Files
`preflight.sql` (read only, every row ok = true), `apply.sql` (one DO block, one transaction, refuses if anything
moved), `apply.undo.sql` (puts the guard back exactly, restores the text, republishes the version 2 body as a new
version; answers already edited stay edited and their history lines stay), `practice.sql`, `SHA256SUMS`.

## Practice (Nov 19, live database, rolled back)
- After apply: new Immediate maintenance text; live maintenance checklist v3 with answer "Checked", value
  "uploaded", otherwise identical to v2; v2 retired; 3 audit rows.
- Team edit on an open ticket's step 9 row: answer changed on the same row, still 1 row for that step, every other
  column unchanged. Blocked: a reason under 3 characters, changing who answered, moving to another step, delete,
  someone not on the team, the same edit on a closed ticket.
- After undo: original text; live v4 with the v2 body (same checksum); guard identical to the original; edits
  blocked again.
- Afterwards: guard unchanged, text unchanged, v1 retired and v2 live, the practice row and ticket unchanged,
  0 audit rows kept.

## Apply
Only on `Approved: apply ticket-page-fixes`: checksums, preflight, apply.sql, then read back.
