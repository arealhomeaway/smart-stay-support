-- Undo for 03_claims_team_b.sql: puts the Claims work type's role link back on
-- the Guest Experience day coordinator role exactly as it was. Data tool, not a
-- migration. No BEGIN/COMMIT.

UPDATE public.work_types
SET functional_role_code = 'ge_day'
WHERE name = 'Claims'
  AND functional_role_code = 'po_day';
