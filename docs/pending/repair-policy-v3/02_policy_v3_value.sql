-- Data change (apply with the data tool, after 01): store policy v3 in the existing
-- app setting. One row. policy v2 is kept under previousVersions so Work Orders
-- decided under it keep their result.
UPDATE public.app_settings
SET value = '{"version": "ARHA Maintenance Authority Policy for Resolve v3", "supervisorApprovalThreshold": 250, "ownerApprovalThreshold": 350, "ownerThresholdInclusive": true, "supervisorAlsoApprovesOwnerTier": true, "ownerNoticeSameDay": true, "previousVersions": [{"version": "ARHA Maintenance Authority Policy for Resolve — v2", "supervisorApprovalThreshold": 200, "ownerApprovalThreshold": 350, "ownerThresholdInclusive": false, "supervisorAlsoApprovesOwnerTier": false, "ownerNoticeSameDay": false}]}'::jsonb,
    updated_at = now()
WHERE key = 'maintenance_authority_policy'
  AND value = '{"version": "ARHA Maintenance Authority Policy for Resolve — v2", "ownerApprovalThreshold": 350, "supervisorApprovalThreshold": 200}'::jsonb;
