-- Undo for 03_work_order_default_v3.sql: restores the prior default exactly (read live Nov 8, 2026).
ALTER TABLE public.work_orders ALTER COLUMN policy_version SET DEFAULT 'ARHA Maintenance Authority Policy for Resolve — v2'::text;
