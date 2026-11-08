-- Undo for 03_claims_team_b.sql: puts the Claims work type back on Team A exactly
-- as it was before. Data tool, not a migration. No BEGIN/COMMIT.

UPDATE public.work_types
SET functional_role_code = 'ge_day',
    team = 'guest_experience',
    backup_coverage = 'Other Guest Experience role; escalate decisions beyond authority'
WHERE name = 'Claims'
  AND functional_role_code = 'po_day'
  AND team = 'property_operations';
