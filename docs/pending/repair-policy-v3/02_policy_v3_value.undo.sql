-- Undo for 02_policy_v3_value.sql (data tool): restore the exact policy v2 value
-- read on Nov 8, 2026. Apply before 01's undo.
UPDATE public.app_settings
SET value = '{"version": "ARHA Maintenance Authority Policy for Resolve — v2", "ownerApprovalThreshold": 350, "supervisorApprovalThreshold": 200}'::jsonb,
    updated_at = now()
WHERE key = 'maintenance_authority_policy'
  AND value->>'version' = 'ARHA Maintenance Authority Policy for Resolve v3';
