# Owner answer save (applied live Nov 16, approved by the Admin)

Applied as `drizzle/migrations/0350_owner_answer_save.sql`, one transaction with one `audit_log` row
(`owner_answer_save_applied`).

Adds `public.ao_submit_card(_plan_card uuid, _values jsonb, _files jsonb)`. It checks the files the same
way `ao_edit_card_answer` does (the owner's own, not deleted, on this home, at most 20), then calls the
unchanged two-argument `ao_submit_card` and stores the files on the saved answer (and on copies the same
call saved for the owner's other homes). Granted to authenticated and service_role only.

Unchanged: the two-argument save and every card rule (open, closed, already answered, other homes),
emails, notices, hours.

Practice (live demo home, rolled back): someone else's file refused; values and file saved on the answer;
card completed; a second send refused; the two-argument save still works with no files.

Undo: `apply.undo.sql` drops only the three-argument function. Checksums: `checksums.sha256`.
