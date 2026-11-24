CREATE OR REPLACE FUNCTION public.is_onboarding_director(_user_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.functional_roles
    WHERE code IN ('onboarding_director','director_onboarding','director_ops') AND current_seat_holder = _user_id)
$function$;
DO $$ DECLARE d text := pg_get_functiondef('public.perform_handoff_step(uuid,text,jsonb,boolean)'::regprocedure);
  old text := 'IF NOT coalesce(auth.uid()=public.seat_holder(''onboarding_director'') OR public.has_role(auth.uid(),''admin''),false)';
  new text := 'IF NOT coalesce(auth.uid()=public.seat_holder(''onboarding_director'') OR auth.uid()=public.seat_holder(''director_ops'') OR public.has_role(auth.uid(),''admin''),false)';
BEGIN
  IF position(old in d)=0 THEN RAISE EXCEPTION 'mark ready check not found; stop'; END IF;
  EXECUTE replace(d, old, new);
END $$;