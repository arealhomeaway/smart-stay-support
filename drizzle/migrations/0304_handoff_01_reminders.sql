-- lovable-cron-fallback-reviewed: Emily asked for a daily 8 AM Central handoff reminder; the job runs at 13:00 and 14:00 UTC (2 runs a day) and acts only in the 8 AM Central hour, so it stays on 8 AM through daylight saving changes.
-- Handoff reminders (Emily, Nov 7, 2026; register O4). Undo: 01_undo_handoff_reminders.sql. No BEGIN/COMMIT.
--
-- For each onboarding project with a handoff date (onboarding_projects.target_handoff_on) that is
-- not handed off yet, remind the Operations Supervisor and the Director of Operations 7 days
-- before, 2 days before and on the day, in app and email, once per project, date and reminder.
-- If the date moves, the reminders follow the new date (a new date is a new key). No reminder
-- after the handoff is accepted, for a cancelled or completed project, a demo home, or a project
-- with no date. A reminder with an empty role is logged with no recipients and not retried.

CREATE TABLE public.handoff_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  property_id uuid NOT NULL,
  handoff_on date NOT NULL,
  kind text NOT NULL CHECK (kind IN ('seven_days', 'two_days', 'day_of')),
  sent_on date NOT NULL,
  recipients uuid[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT handoff_reminders_once UNIQUE (project_id, handoff_on, kind)
);
COMMENT ON TABLE public.handoff_reminders IS
  'One row per handoff reminder sent by run_handoff_reminders. The unique key (project, handoff date, reminder) makes each reminder fire once; a moved date is a new key.';

GRANT SELECT ON public.handoff_reminders TO authenticated;
GRANT ALL ON public.handoff_reminders TO service_role;
ALTER TABLE public.handoff_reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read handoff reminders" ON public.handoff_reminders
  FOR SELECT TO authenticated USING (private.is_staff(auth.uid()));

CREATE OR REPLACE FUNCTION public.run_handoff_reminders(_now timestamptz DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _local timestamp := _now AT TIME ZONE 'America/Chicago';
  _today date := (_now AT TIME ZONE 'America/Chicago')::date;
  _sup uuid;
  _dir uuid;
  _p record;
  _kind text;
  _log uuid;
  _label text;
  _title text;
  _body text;
  _who uuid;
  _sent uuid[];
  _count integer := 0;
BEGIN
  IF extract(hour FROM _local) <> 8 THEN
    RETURN 0;
  END IF;
  _sup := public.seat_holder_at('ops_supervisor', _now);
  _dir := public.seat_holder_at('director_ops', _now);

  FOR _p IN
    SELECT pr.id, pr.property_id, pr.target_handoff_on AS handoff_on, (pr.target_handoff_on - _today) AS days_left, to_jsonb(h) AS home
      FROM public.onboarding_projects pr
      JOIN public.properties h ON h.id = pr.property_id
     WHERE pr.target_handoff_on IS NOT NULL
       AND pr.target_handoff_on - _today IN (7, 2, 0)
       AND coalesce(pr.status, '') NOT IN ('cancelled', 'complete')
       AND pr.handoff_state IS DISTINCT FROM 'accepted'
       AND pr.ops_accepted_at IS NULL
       AND h.handoff_accepted_at IS NULL
       AND NOT coalesce(pr.is_demo, false)
       AND NOT coalesce(h.is_demo, false)
  LOOP
    _kind := CASE _p.days_left WHEN 7 THEN 'seven_days' WHEN 2 THEN 'two_days' ELSE 'day_of' END;
    _log := NULL;
    INSERT INTO public.handoff_reminders(project_id, property_id, handoff_on, kind, sent_on)
    VALUES (_p.id, _p.property_id, _p.handoff_on, _kind, _today)
    ON CONFLICT ON CONSTRAINT handoff_reminders_once DO NOTHING
    RETURNING id INTO _log;
    CONTINUE WHEN _log IS NULL;

    _label := coalesce(public.format_property_label(_p.home)->>'primary', 'A home');
    _title := CASE _kind
      WHEN 'seven_days' THEN 'Handoff in 7 days: '
      WHEN 'two_days' THEN 'Handoff in 2 days: '
      ELSE 'Handoff today: ' END || _label;
    _body := 'Handoff date: ' || to_char(_p.handoff_on, 'FMDay, FMMonth FMDD')
      || '. Anything still open carries over to Operations.';

    _sent := '{}';
    FOR _who IN SELECT DISTINCT x FROM unnest(ARRAY[_sup, _dir]) x WHERE x IS NOT NULL LOOP
      PERFORM public.notify_staff(
        _who, 'handoff_reminder', _title, _body,
        'onboarding_project', _p.id, '/property/' || _p.property_id::text || '?tab=handoff',
        'normal', NULL, true, false);
      _sent := _sent || _who;
    END LOOP;
    UPDATE public.handoff_reminders SET recipients = _sent WHERE id = _log;
    _count := _count + 1;
  END LOOP;
  RETURN _count;
END;
$function$;
REVOKE ALL ON FUNCTION public.run_handoff_reminders(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.run_handoff_reminders(timestamptz) TO service_role;

SELECT cron.schedule(
  'handoff-reminders',
  '0 13,14 * * *',
  $$SELECT public.run_handoff_reminders()$$
);
