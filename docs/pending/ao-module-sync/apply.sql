-- ao-module-sync (staged Nov 23). Apply only on the exact words: Approved: apply ao-module-sync
-- Turns the Active Owner module on for exactly 3400 N Fern Avenue and 624 Daniel Court, which are already
-- enrolled with live programs and Owner Type Active Owner. One History line per home, one audit row.
-- No owner-facing change: no program, card, login, notice or email is touched. Undo: apply.undo.sql.
DO $apply$
DECLARE n int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.audit_log WHERE action = 'ao_module_sync.apply') THEN
    RAISE EXCEPTION 'ao-module-sync is already applied.';
  END IF;
  SELECT count(*) INTO n FROM public.onboarding_projects op JOIN public.properties h ON h.id = op.property_id
   WHERE op.id IN ('b36734a1-af43-49f6-a732-01ba91c98df5','e57c1c02-2600-4547-a3a9-cffa541ce4fc')
     AND h.id IN ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d','2ac3120b-cec9-4735-b4b6-c130bdab63fd')
     AND op.owner_type = 'Active Owner' AND NOT ('active_owner' = ANY(op.modules)) AND NOT h.is_demo AND h.archived_at IS NULL
     AND EXISTS (SELECT 1 FROM public.owner_program_properties l JOIN public.owner_programs p ON p.id = l.program_id
       WHERE l.property_id = h.id AND l.inclusion_status = 'included' AND p.archived_at IS NULL AND p.status = 'active' AND p.owner_user_id IS NOT NULL);
  IF n <> 2 THEN RAISE EXCEPTION 'Preflight changed: % of 2 homes still match. Nothing applied.', n; END IF;

  -- Project changes need a signed-in onboarding account (database rule); this runs as the Admin who approved it.
  PERFORM set_config('request.jwt.claims', jsonb_build_object('sub','98bd6696-4018-4965-b645-0471c5ae3925','role','authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', '98bd6696-4018-4965-b645-0471c5ae3925', true);

  INSERT INTO public.onboarding_project_events (project_id, property_id, kind, summary, detail, prior_value, new_value, actor, is_demo)
  SELECT op.id, op.property_id, 'scope_changed', 'Active Owner setting matched to the home''s enrollment', NULL,
         array_to_string(op.modules, ', '), array_to_string(op.modules || ARRAY['active_owner'], ', '),
         '98bd6696-4018-4965-b645-0471c5ae3925', false
    FROM public.onboarding_projects op
   WHERE op.id IN ('b36734a1-af43-49f6-a732-01ba91c98df5','e57c1c02-2600-4547-a3a9-cffa541ce4fc');

  UPDATE public.onboarding_projects SET modules = modules || ARRAY['active_owner']
   WHERE id IN ('b36734a1-af43-49f6-a732-01ba91c98df5','e57c1c02-2600-4547-a3a9-cffa541ce4fc')
     AND NOT ('active_owner' = ANY(modules));
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'Expected 2 homes, changed %. Nothing applied.', n; END IF;

  INSERT INTO public.audit_log (actor_id, actor_label, action, entity_type, entity_label, reason, after_value)
  VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'ao_module_sync.apply', 'onboarding_project', 'Active Owner module matched to enrollment',
    'Active Owner setting matched to the home''s enrollment: 3400 N Fern Avenue and 624 Daniel Court. Undo: docs/pending/ao-module-sync/apply.undo.sql.',
    jsonb_build_object('projects', jsonb_build_array('b36734a1-af43-49f6-a732-01ba91c98df5','e57c1c02-2600-4547-a3a9-cffa541ce4fc'), 'added', 'active_owner'));
END $apply$;
