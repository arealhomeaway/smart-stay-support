SELECT md5(pg_get_functiondef('public.auto_assign_ticket()'::regprocedure)) AS function_md5;
SELECT count(*) AS eligible, count(*) FILTER (WHERE external_source = 'breezeway') AS breezeway,
 count(*) FILTER (WHERE external_source = 'ownerrez') AS ownerrez
FROM public.tickets
WHERE status IN ('open','dispatched','in_progress','waiting','awaiting_guest')
 AND archived_at IS NULL AND NOT is_demo AND import_hold IS NULL
 AND lower(coalesce(external_source,'')) <> 'notion'
 AND created_at >= '2026-11-16 00:00:00 America/Chicago'::timestamptz
 AND assigned_to IS NULL AND current_action_owner IS NULL;
