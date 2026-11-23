-- ao-auto-enroll preflight (read only). Every row must say ok = true before apply.
SELECT 'enrollment step is the reviewed version' AS check_name,
  md5(pg_get_functiondef('public.active_owner_enrollment_step'::regproc)) = '8842731f0f948c76cc877236b24d7a32' AS ok
UNION ALL SELECT 'Director check is the reviewed version',
  md5(pg_get_functiondef('public.is_onboarding_director'::regproc)) = '0949edaf9adffa4dd89fb0280f3d517d'
UNION ALL SELECT 'wrapper not there yet',
  NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'active_owner_auto_enrollment_step')
UNION ALL SELECT 'setup items table not there yet',
  to_regclass('public.active_owner_setup_items') IS NULL
UNION ALL SELECT 'no app setting already uses the flag name',
  NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname IN ('public','private') AND p.prokind = 'f' AND pg_get_functiondef(p.oid) LIKE '%ao_auto_enroll_actor%')
UNION ALL SELECT 'the 8 live Active Owner homes are all enrolled with a login',
  (SELECT count(*) FROM public.owner_program_properties opp JOIN public.owner_programs p ON p.id = opp.program_id
    JOIN public.properties h ON h.id = opp.property_id
   WHERE opp.inclusion_status = 'included' AND NOT h.is_demo AND p.archived_at IS NULL AND p.status = 'active'
     AND p.owner_user_id IS NOT NULL) = 8
UNION ALL SELECT 'no live home is labelled Active Owner without a live program (first 5 minute check enrolls 0)',
  NOT EXISTS (SELECT 1 FROM public.onboarding_projects op JOIN public.properties h ON h.id = op.property_id
   WHERE op.status <> 'cancelled' AND NOT h.is_demo AND h.archived_at IS NULL
     AND (op.owner_type = 'Active Owner' OR 'active_owner' = ANY(op.modules))
     AND NOT EXISTS (SELECT 1 FROM public.owner_program_properties opp JOIN public.owner_programs p ON p.id = opp.program_id
       WHERE opp.property_id = h.id AND opp.inclusion_status = 'included' AND p.archived_at IS NULL
         AND p.status NOT IN ('draft','closed','completed','complete')));
