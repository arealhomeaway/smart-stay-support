-- Read only. Expect: no new objects yet; existing gate triggers present; claim counts.
SELECT to_regclass('public.claim_line_items') AS line_items, to_regclass('public.claim_platform_log') AS platform_log,
       to_regprocedure('public.claims_default_filing_deadline()') AS deadline_fn;
SELECT tgname FROM pg_trigger WHERE tgrelid = 'public.claims'::regclass AND NOT tgisinternal ORDER BY 1;
SELECT stage, count(*), count(deadline_on) AS with_deadline FROM public.claims GROUP BY 1 ORDER BY 1;
SELECT md5(pg_get_functiondef('public.guard_claim_workflow'::regproc)) AS workflow_gate_hash;
-- Nov 23 addition: the cancel-on-deadline-change trigger is not there yet; no filing alerts exist yet.
SELECT to_regprocedure('public.claims_retract_filing_alerts()') AS retract_fn,
       (SELECT count(*) FROM public.staff_notifications WHERE kind IN ('claim_filing_reminder', 'claim_filing_overdue')) AS filing_alerts,
       (SELECT count(*) FROM public.audit_log WHERE action LIKE 'claims_coordinator_view.%') AS applied_before;
