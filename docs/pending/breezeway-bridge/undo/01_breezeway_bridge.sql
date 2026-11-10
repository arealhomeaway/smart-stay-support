-- Undo of 01_breezeway_bridge.sql (Breezeway bridge, Build 10).
-- Run only with approval. Turn the bridge off first (set_breezeway_bridge(false)) so the safety
-- sweep is inactive. Tickets and reviews the bridge already made stay: they are ordinary
-- records with their own history. Mirror rows keep every older column.

DROP TRIGGER IF EXISTS breezeway_bridge_apply ON public.breezeway_work_orders;
DROP TRIGGER IF EXISTS work_orders_internal_switch ON public.work_orders;
DROP TRIGGER IF EXISTS breezeway_outbound_internal_switch ON public.breezeway_outbound_tasks;
DROP TRIGGER IF EXISTS feature_flags_breezeway_bridge_guard ON public.feature_flags;
DROP TRIGGER IF EXISTS app_settings_breezeway_bridge_guard ON public.app_settings;

DROP FUNCTION IF EXISTS public.breezeway_bridge_status();
DROP FUNCTION IF EXISTS public.set_breezeway_bridge(boolean);
DROP FUNCTION IF EXISTS private.breezeway_bridge_apply();
DROP FUNCTION IF EXISTS private.refuse_internal_work_orders();
DROP FUNCTION IF EXISTS private.breezeway_is_new_house(text, text[], text, text);
DROP FUNCTION IF EXISTS private.breezeway_bridge_skip_reason(boolean, timestamptz, timestamptz, uuid, text);
DROP FUNCTION IF EXISTS private.breezeway_bridge_start_line();
DROP FUNCTION IF EXISTS private.guard_breezeway_bridge_switch();

DELETE FROM public.app_settings WHERE key = 'breezeway_bridge_start_line';
DELETE FROM public.feature_flags WHERE key = 'internal_work_orders';

DROP TABLE IF EXISTS public.breezeway_bridge_records;
DROP TABLE IF EXISTS public.breezeway_home_tags;

ALTER TABLE public.breezeway_work_orders
  DROP COLUMN IF EXISTS bridge_keep,
  DROP COLUMN IF EXISTS report_url,
  DROP COLUMN IF EXISTS reported_issue,
  DROP COLUMN IF EXISTS requested_by,
  DROP COLUMN IF EXISTS created_by_name,
  DROP COLUMN IF EXISTS created_by_id,
  DROP COLUMN IF EXISTS tags;
