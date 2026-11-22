-- Undo cost-seg-removal: switch the step back on and unarchive exactly the tasks this change archived.
DO $$
DECLARE _a record;
BEGIN
  SELECT * INTO _a FROM public.audit_log WHERE action='cost_seg_removal.apply' ORDER BY created_at DESC LIMIT 1;
  IF _a.id IS NULL THEN RAISE EXCEPTION 'cost-seg-removal was not applied'; END IF;
  UPDATE public.onboarding_template_tasks SET is_active=true WHERE id='2dc6f929-eaa5-4e9c-afd0-56400784ad9e';
  -- Saved versions are never changed or deleted. Undo saves the next version as an exact copy of version 8.
  INSERT INTO public.onboarding_template_versions(template_id, version, snapshot, published_by)
  SELECT v.template_id, (SELECT max(version)+1 FROM public.onboarding_template_versions WHERE template_id=v.template_id), v.snapshot, _a.actor_id
    FROM public.onboarding_template_versions v WHERE v.id='dbd7a6ee-8458-4155-9543-0688046349a3';
  UPDATE public.onboarding_tasks SET archived_at=NULL, archived_by=NULL, exception_reason=NULL, exception_by=NULL, exception_at=NULL
   WHERE id IN (SELECT jsonb_array_elements_text(_a.before_value->'open_task_ids')::uuid)
     AND exception_reason='Voided — not needed: removed from the onboarding plan template';
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, before_value, after_value)
  VALUES (_a.actor_id, 'cost_seg_removal.undo', 'onboarding_template_task', _a.entity_id, _a.entity_label, _a.after_value, _a.before_value);
END $$;
