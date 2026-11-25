-- Restore the live definition captured Nov 25, 2026 (before.sql).
CREATE OR REPLACE FUNCTION public.shift_handoff_defaults(_at timestamp with time zone DEFAULT now())
 RETURNS TABLE(team text, user_id uuid, role_code text, note text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_me uuid := auth.uid();
  v_at timestamptz := greatest(now(), least(coalesce(_at, now()), now() + interval '16 hours'));
  v_sup uuid := public.seat_holder_at('ops_supervisor', greatest(now(), least(coalesce(_at, now()), now() + interval '16 hours')));
  v_team text;
  c record;
BEGIN
  IF v_me IS NULL OR NOT private.is_staff(v_me) THEN
    RAISE EXCEPTION 'Only the team can hand off work.';
  END IF;
  FOREACH v_team IN ARRAY ARRAY['guest_experience', 'property_operations'] LOOP
    SELECT * INTO c FROM public.coordinator_for(v_team, v_at);
    IF c.user_id IS NOT NULL AND c.user_id <> v_me THEN
      team := v_team; user_id := c.user_id; role_code := c.role_code; note := c.note;
    ELSIF v_sup IS NOT NULL AND v_sup <> v_me THEN
      team := v_team; user_id := v_sup; role_code := 'ops_supervisor';
      note := 'Nobody else is on shift, so it goes to the Operations Supervisor.';
    ELSE
      team := v_team; user_id := NULL; role_code := NULL;
      note := 'Nobody else is on shift. Choose who gets it.';
    END IF;
    RETURN NEXT;
  END LOOP;
  team := 'supervisor';
  user_id := CASE WHEN v_sup IS DISTINCT FROM v_me THEN v_sup END;
  role_code := 'ops_supervisor';
  note := NULL;
  RETURN NEXT;
END
$function$;
