-- Undo for template-version-names. Puts every renamed step name back from the audit row apply.sql wrote.
-- One transaction; the version lock is lifted only for this and switched back on; writes its own audit row.
DO $undo$
DECLARE
  actor constant uuid := '98bd6696-4018-4965-b645-0471c5ae3925';
  a jsonb; e jsonb; n int := 0;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);
  SELECT before_value INTO a FROM public.audit_log WHERE action = 'template_version_names.apply' ORDER BY created_at DESC LIMIT 1;
  IF a IS NULL THEN RAISE EXCEPTION 'template-version-names was not applied; nothing to undo.'; END IF;

  ALTER TABLE public.onboarding_template_versions DISABLE TRIGGER block_template_version_mutation;
  FOR e IN SELECT * FROM jsonb_array_elements(a->'steps') LOOP
    UPDATE public.onboarding_template_versions v
       SET snapshot = jsonb_set(v.snapshot, ARRAY['steps', e->>'i', 'title'], e->'title')
     WHERE v.id = (e->>'version_id')::uuid
       AND v.snapshot->'steps'->((e->>'i')::int)->>'id' IS NOT DISTINCT FROM e->>'step_id';
    IF NOT FOUND THEN RAISE EXCEPTION 'Step % in version % moved; nothing put back.', e->>'step_id', e->>'version_id'; END IF;
    n := n + 1;
  END LOOP;
  ALTER TABLE public.onboarding_template_versions ENABLE TRIGGER block_template_version_mutation;

  INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason, before_value, after_value)
  VALUES (actor, 'Admin', 'template_version_names.undo', 'onboarding_template_versions', 'Saved template versions',
    'Undo of template-version-names: saved step names put back as they were.', NULL, jsonb_build_object('steps', n));
END $undo$;
