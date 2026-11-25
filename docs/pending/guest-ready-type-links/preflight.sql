SELECT id,label,work_type_id,rule,rule_days,match_priority,updated_at FROM public.guest_ready_standards WHERE id IN ('0949c472-9d93-498c-886b-b7a010af175b','4b46e22f-6f65-418d-a2fd-e5f0fc99b2b3','c6d61d7e-d08b-4ebd-87dd-0762a6a941dd');
SELECT * FROM public.work_types WHERE id='a5b90e0e-39fc-4d96-860b-d77fb5b793d7' OR lower(name) IN ('minor items','pest control');
SELECT count(*) FROM public.routine_controls WHERE kind='maintenance_review' AND title ~* 'lawn|landscap|yard|mow|irrigation|sprinkler' AND status IN ('due','in_progress');
SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='routine_controls' AND column_name IN ('due_on','guest_ready_standard_id');
