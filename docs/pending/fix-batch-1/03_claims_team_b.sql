-- Fix batch 1, part 3: Claims go to Team B. Staged only. Not applied until approved.
-- Undo: 03_undo_claims_team_b.sql
-- This is a one row data change, so when approved it is applied with the data
-- tool, not as a migration. No BEGIN/COMMIT.
--
-- Decision: Team B (Property Operations) handles guest damage claims. Only the
-- Claims work type changes: its role becomes the Property Operations day
-- coordinator (po_day, the same role every other Team B work type uses), its
-- team becomes property_operations, and its backup note names the other
-- Property Operations role. Response times, priority, closure evidence,
-- playbook and every other work type stay exactly as they are. Existing
-- tickets keep the role they were saved with (there are none today).

UPDATE public.work_types
SET functional_role_code = 'po_day',
    team = 'property_operations',
    backup_coverage = 'Other Property Operations role; escalate decisions beyond authority'
WHERE name = 'Claims'
  AND functional_role_code = 'ge_day'
  AND team = 'guest_experience';
