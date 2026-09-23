DO $$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.activate_owner_program'::regproc);
  d := replace(d, 'ends_on=_started_on+89', 'ends_on=make_date(extract(year from _started_on)::int,12,31)');
  EXECUTE d;
  SELECT pg_get_functiondef(p.oid) INTO d FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='refresh_owner_badges' LIMIT 1;
  d := replace(d, 'p.started_on+89', 'make_date(extract(year from p.started_on)::int,12,31)');
  EXECUTE d;
END $$;

-- One-time conversion of existing programs to the closing-date-to-December-31 window.
ALTER TABLE public.owner_programs DISABLE TRIGGER USER;
UPDATE public.owner_programs
   SET ends_on = make_date(extract(year from started_on)::int,12,31)
 WHERE started_on IS NOT NULL AND archived_at IS NULL
   AND status NOT IN ('closed','completed','complete');
ALTER TABLE public.owner_programs ENABLE TRIGGER USER;

COMMENT ON COLUMN public.owner_time_entries.review_status IS
  'DEPRECATED: owner hours count immediately; no review/approval state is used.';