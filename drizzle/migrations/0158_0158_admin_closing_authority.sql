-- Existing reason/event/audit correction action unchanged; adds Admin to closing-correction authority.
CREATE OR REPLACE FUNCTION private.can_correct_actual_closing(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT _uid IS NOT NULL AND (public.has_role(_uid,'admin') OR public.has_role(_uid,'manager')
 OR public.seat_holder_at('director_ops')=_uid OR public.seat_holder_at('director_onboarding')=_uid)
$$;