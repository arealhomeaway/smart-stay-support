SELECT to_regprocedure('private.is_staff(uuid)') staff, to_regprocedure('private.is_director(uuid)') director,
       to_regprocedure('public.is_onboarding_director(uuid)') onb, to_regprocedure('public.is_supervisor(uuid)') sup,
       (SELECT count(*) FROM public.arrival_checks WHERE status='open') open_checks;
