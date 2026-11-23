-- ao-module-sync undo. Removes only the module this change added, on only these two projects; History and audit are kept.
DO $undo$
DECLARE n int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.audit_log WHERE action = 'ao_module_sync.apply') THEN RAISE EXCEPTION 'ao-module-sync was never applied.'; END IF;
  IF EXISTS (SELECT 1 FROM public.audit_log WHERE action = 'ao_module_sync.undo') THEN RAISE EXCEPTION 'ao-module-sync is already undone.'; END IF;
  -- Project changes need a signed-in onboarding account (database rule); this runs as the Admin who approved it.
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub','98bd6696-4018-4965-b645-0471c5ae3925','role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '98bd6696-4018-4965-b645-0471c5ae3925', true);
  INSERT INTO public.onboarding_project_events (project_id, property_id, kind, summary, detail, prior_value, new_value, actor, is_demo)
  SELECT op.id, op.property_id, 'scope_changed', 'Active Owner setting change undone', NULL,
         array_to_string(op.modules, ', '), array_to_string(array_remove(op.modules, 'active_owner'), ', '),
         '98bd6696-4018-4965-b645-0471c5ae3925', false
    FROM public.onboarding_projects op
   WHERE op.id IN ('b36734a1-af43-49f6-a732-01ba91c98df5','e57c1c02-2600-4547-a3a9-cffa541ce4fc') AND 'active_owner' = ANY(op.modules);
  UPDATE public.onboarding_projects SET modules = array_remove(modules, 'active_owner')
   WHERE id IN ('b36734a1-af43-49f6-a732-01ba91c98df5','e57c1c02-2600-4547-a3a9-cffa541ce4fc') AND 'active_owner' = ANY(modules);
  GET DIAGNOSTICS n = ROW_COUNT;
  INSERT INTO public.audit_log (actor_id, actor_label, action, entity_type, entity_label, reason, after_value)
  VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'ao_module_sync.undo', 'onboarding_project', 'Active Owner module matched to enrollment',
    'Undo of ao-module-sync.', jsonb_build_object('projects_changed', n));
END $undo$;
