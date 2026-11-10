-- Undo for 01_arrival_check.sql. Run only with Emily's approval. Kept records (checks, facts,
-- tickets) are never deleted: tables are kept and only the steps that make new ones are removed.
DO $do$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'arrival-checks';
  END IF;
END $do$;
DROP TRIGGER IF EXISTS owner_notifications_skip_arrival_check ON public.owner_notifications;
DROP TRIGGER IF EXISTS owner_reviews_skip_arrival_check ON public.owner_reviews;
DROP FUNCTION IF EXISTS private.skip_arrival_check_owner_rows();
DROP FUNCTION IF EXISTS public.clear_test_arrival_checks();
DROP FUNCTION IF EXISTS public.make_test_arrival_check(integer);
DROP FUNCTION IF EXISTS public.arrival_checks_status();
DROP FUNCTION IF EXISTS public.arrival_check_for_ticket(uuid);
DROP FUNCTION IF EXISTS public.run_arrival_checks();
DROP FUNCTION IF EXISTS private.arrival_checks_run(timestamptz);
DROP FUNCTION IF EXISTS private.arrival_check_mark_missed(uuid, timestamptz);
DROP FUNCTION IF EXISTS private.arrival_check_alert(uuid, timestamptz);
DROP FUNCTION IF EXISTS private.arrival_check_cancel(uuid, timestamptz);
DROP FUNCTION IF EXISTS public.complete_arrival_check(uuid, boolean, text, boolean, text, text, text);
DROP FUNCTION IF EXISTS private.arrival_check_complete(uuid, uuid, boolean, text, boolean, text, text, text, timestamptz);
DROP FUNCTION IF EXISTS private.arrival_check_fact(uuid, text, uuid, timestamptz);
DROP FUNCTION IF EXISTS private.arrival_check_create(text, timestamptz, boolean, timestamptz);
DROP FUNCTION IF EXISTS private.arrival_check_skip_reason(text, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS public.arrival_ingest_bookings(jsonb);
DROP FUNCTION IF EXISTS public.set_arrival_checks(boolean);
-- The switch goes off and stays guarded off; the start line is kept as history.
SELECT set_config('resolve.arrival_checks_switch', 'on', true);
UPDATE public.feature_flags SET enabled = false WHERE key = 'arrival_checks';
SELECT set_config('resolve.arrival_checks_switch', '', true);
-- Tables, the work type, the switch row, guards and the widened scorecard kind list stay, so
-- every kept record and fact still reads back.
