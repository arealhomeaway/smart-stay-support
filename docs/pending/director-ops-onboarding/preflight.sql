SELECT position('director_ops' in pg_get_functiondef('public.is_onboarding_director(uuid)'::regprocedure))=0 AS director_fn_unchanged,
 position('OR public.has_role(auth.uid(),''admin''),false) THEN RAISE EXCEPTION ''Only the Director of Onboarding or an Admin can mark' in pg_get_functiondef('public.perform_handoff_step(uuid,text,jsonb,boolean)'::regprocedure))>0 AS mark_ready_check_present,
 (SELECT current_seat_holder IS NOT NULL FROM public.functional_roles WHERE code='director_ops') AS ops_director_filled;
