-- Read-only. Run again immediately before any approved application.
SELECT n.nspname,p.proname,pg_get_functiondef(p.oid) definition,
 md5(pg_get_functiondef(p.oid)) definition_hash
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE (n.nspname,p.proname) IN (('private','is_director'),('public','is_director'),('public','seat_holder_at'),('public','seat_override_at'),('public','is_onboarding_director'),('private','has_role'));
SELECT to_regprocedure('public.delete_onboarding_property(uuid,text,text)') existing_action;
SELECT lifecycle_status,count(*) FROM public.properties GROUP BY lifecycle_status;
SELECT count(*) properties FROM public.properties;
SELECT count(*) deleted_audits FROM public.audit_log WHERE action='property.deleted';
