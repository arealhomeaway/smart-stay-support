-- cost-seg-removal: switch the cost segregation step off in the Standard plan template and
-- archive it on in-progress homes where it is not completed. Completed ones are not touched.
-- One transaction, one audit row. Refuses to run if the counts differ from the preflight.
DO $$
DECLARE
  _step constant uuid := '2dc6f929-eaa5-4e9c-afd0-56400784ad9e';
  _actor constant uuid := (SELECT id FROM public.profiles WHERE email='emily.jimenez@arealhomeaway.com');
  _ids uuid[];
  _done int;
BEGIN
  IF EXISTS (SELECT 1 FROM public.audit_log WHERE action='cost_seg_removal.apply') THEN RAISE EXCEPTION 'cost-seg-removal is already applied'; END IF;
  IF _actor IS NULL THEN RAISE EXCEPTION 'Approving Admin not found'; END IF;
  IF (SELECT count(*) FROM public.onboarding_template_tasks WHERE id=_step AND is_active AND title='Coordinate the cost segregation study') <> 1 THEN
    RAISE EXCEPTION 'Template step is not in the expected state'; END IF;
  SELECT array_agg(t.id ORDER BY t.id) INTO _ids FROM public.onboarding_tasks t JOIN public.onboarding_projects p ON p.property_id=t.property_id
   WHERE t.template_task_id=_step AND t.archived_at IS NULL AND t.status<>'complete' AND p.status='active';
  IF coalesce(array_length(_ids,1),0) <> 8 THEN RAISE EXCEPTION 'Expected 8 open tasks, found %', coalesce(array_length(_ids,1),0); END IF;
  SELECT count(*) INTO _done FROM public.onboarding_tasks WHERE template_task_id=_step AND status='complete';

  IF (SELECT id FROM public.onboarding_template_versions WHERE template_id='84f3a777-44a8-430a-af7e-8f18dc9a7dae' ORDER BY version DESC LIMIT 1)
     <> 'dbd7a6ee-8458-4155-9543-0688046349a3' THEN RAISE EXCEPTION 'The newest saved plan version is no longer version 8'; END IF;

  UPDATE public.onboarding_template_tasks SET is_active=false WHERE id=_step;
  -- New homes start from the newest saved version. Version 9 is version 8 without this one step,
  -- so the 4 other step edits not yet saved as a version stay unsaved, as they are today.
  INSERT INTO public.onboarding_template_versions(template_id, version, snapshot, published_by)
  SELECT v.template_id, 9,
         jsonb_set(v.snapshot, '{steps}', (SELECT jsonb_agg(e ORDER BY o) FROM jsonb_array_elements(v.snapshot->'steps') WITH ORDINALITY x(e, o) WHERE e->>'id' <> _step::text)),
         _actor
    FROM public.onboarding_template_versions v WHERE v.id='dbd7a6ee-8458-4155-9543-0688046349a3';
  UPDATE public.onboarding_tasks
     SET archived_at=now(), archived_by=_actor,
         exception_reason='Voided — not needed: removed from the onboarding plan template',
         exception_by=_actor, exception_at=now()
   WHERE id = ANY(_ids);

  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, before_value, after_value)
  VALUES (_actor, 'cost_seg_removal.apply', 'onboarding_template_task', _step, 'Coordinate the cost segregation study',
          jsonb_build_object('step_active', true, 'open_task_ids', to_jsonb(_ids), 'completed_kept', _done),
          jsonb_build_object('step_active', false, 'archived', array_length(_ids,1), 'new_version', 9));
END $$;