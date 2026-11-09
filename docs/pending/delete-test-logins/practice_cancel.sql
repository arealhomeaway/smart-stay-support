-- Practice only: appended after 01 in one step, then cancelled by this error so nothing is kept.
-- Reports what 01 would change. Never part of the real run.
DO $$
DECLARE msg text;
BEGIN
  SELECT 'PRACTICE CANCELLED, nothing kept. '
      || 'links cleared: ' || (SELECT string_agg(tbl || '.' || col || '=' || expected, ', ' ORDER BY tbl, col) FROM dtl_links)
      || ' | deleted: ' || (SELECT string_agg(tbl || '=' || n, ', ' ORDER BY tbl) FROM (SELECT tbl, count(*) n FROM dtl_delete GROUP BY tbl) d)
      || ' | audit lines ' || (SELECT v #>> '{}' FROM dtl_record WHERE k = 'audit_lines_before') || ' -> ' || (SELECT count(*) FROM public.audit_log)
      || ' | audit lines given a (former) name: ' || (SELECT count(*) FROM public.audit_log WHERE actor_label LIKE '%(former)' AND actor_id IS NULL)
      || ' | profiles ' || (SELECT count(*) FROM public.profiles) || ', roles ' || (SELECT count(*) FROM public.user_roles)
      || ' | test account list ' || (SELECT value::text FROM public.app_settings WHERE key = 'test_account_ids')
      || ' | removal line accounts ' || (SELECT jsonb_array_length(before_value->'accounts') FROM public.audit_log WHERE action = 'user.test_signins_deleted')
    INTO msg;
  RAISE EXCEPTION '%', msg;
END $$;
