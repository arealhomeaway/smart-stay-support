-- Repair approval ladder, policy v3, part 3 (Emily, answer E2): new Work Orders default to v3.
-- Changes only the column default. Existing Work Orders keep the version already stamped on them
-- (four live rows on v2), and every app path already stamps v3 explicitly. The text matches the
-- stored policy version in app_settings maintenance_authority_policy exactly.
-- Undo: 03_work_order_default_v3.undo.sql
ALTER TABLE public.work_orders ALTER COLUMN policy_version SET DEFAULT 'ARHA Maintenance Authority Policy for Resolve v3';
