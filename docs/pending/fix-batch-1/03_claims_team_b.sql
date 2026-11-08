-- Fix batch 1, part 3: Claims go to Team B. Staged only. Not applied until approved.
-- Undo: 03_undo_claims_team_b.sql
-- This is a one row data change, so when approved it is applied with the data
-- tool, not as a migration. No BEGIN/COMMIT.
--
-- Decision: Team B (Property Operations) handles guest damage claims. Only the
-- Claims work type's role link changes, to the Property Operations day
-- coordinator role (po_day, the role the other Team B work types use).
-- Its team label and backup note are left as they are (nothing reads them
-- today). Response times, priority, closure evidence, playbook and every
-- other work type stay exactly as they are. Existing tickets keep the role
-- they were saved with (there are none on Claims today).

UPDATE public.work_types
SET functional_role_code = 'po_day'
WHERE name = 'Claims'
  AND functional_role_code = 'ge_day';
