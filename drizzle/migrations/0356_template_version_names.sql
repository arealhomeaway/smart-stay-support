-- template-version-names: in the 9 saved template versions, the 28 step names that still say
-- Lead Designer or Staging Team get the same fixed renames design-review-director gave the live steps.
-- Only the step name changes. Every other part of each version (other step fields, stages, version
-- number, published date and publisher) stays as it is. The version lock is lifted for this change only
-- and switched back on in the same transaction. Tasks (completed, archived or open) are not touched.
-- One transaction, one audit row `template_version_names.apply`. Undo: docs/pending/template-version-names/apply.undo.sql.
DO $tvn$
DECLARE
  actor constant uuid := '98bd6696-4018-4965-b645-0471c5ae3925';
  renames constant jsonb := $j${
    "Confirm approval of the design plan/budget with Lead Designer": "Confirm approval of the design plan/budget with the Director of Onboarding",
    "Submit the design for Lead Designer review": "Submit the design for Director of Onboarding review",
    "Confirm with staging team that ROKU tv's were set": "Confirm with the Stager that ROKU tv's were set",
    "Confirm with staging team that ROKU TVs were set up": "Confirm with the Stager that ROKU TVs were set up",
    "Create a Task Summary Sheet for the Staging Team": "Create a Task Summary Sheet for the Stager",
    "Request staging team provide photos of unused decor": "Request the Stager provide photos of unused decor",
    "Ask the staging team about a pre-cleaning": "Ask the Stager about a pre-cleaning",
    "Send the staging instructions and task summary sheet to the staging team": "Send the staging instructions and task summary sheet to the Stager",
    "Purchase curtain panels and have sent to staging team for pressing": "Purchase curtain panels and have sent to the Stager for pressing"
  }$j$::jsonb;
  b jsonb; vids uuid[]; n_steps int; n_versions int; n_rows int; n_left int;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', actor, 'role', 'authenticated')::text, true);
  IF NOT EXISTS (SELECT 1 FROM public.audit_log WHERE action = 'design_review_director.apply') THEN
    RAISE EXCEPTION 'design-review-director is not applied; nothing changed.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.audit_log WHERE action = 'template_version_names.apply')
     AND NOT EXISTS (SELECT 1 FROM public.audit_log WHERE action = 'template_version_names.undo'
                       AND created_at > (SELECT max(created_at) FROM public.audit_log WHERE action = 'template_version_names.apply')) THEN
    RAISE EXCEPTION 'template-version-names is already applied; nothing changed.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.onboarding_template_versions v, jsonb_array_elements(v.snapshot->'steps') e
              WHERE e->>'title' ~* 'lead designer|staging team' AND NOT renames ? (e->>'title')) THEN
    RAISE EXCEPTION 'A saved step name with Lead Designer or Staging Team has no fixed rename; nothing changed.';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object('version_id', v.id, 'template_id', v.template_id, 'version', v.version,
                                               'i', e.ord - 1, 'step_id', e.step->>'id', 'title', e.step->>'title') ORDER BY v.id, e.ord), '[]'),
         count(*), count(DISTINCT v.id), coalesce(array_agg(DISTINCT v.id), '{}')
    INTO b, n_steps, n_versions, vids
    FROM public.onboarding_template_versions v, jsonb_array_elements(v.snapshot->'steps') WITH ORDINALITY e(step, ord)
   WHERE renames ? (e.step->>'title');
  IF n_steps <> 28 OR n_versions <> 9 THEN
    RAISE EXCEPTION 'Expected 28 steps in 9 saved versions, found % in %; nothing changed.', n_steps, n_versions;
  END IF;

  ALTER TABLE public.onboarding_template_versions DISABLE TRIGGER block_template_version_mutation;
  UPDATE public.onboarding_template_versions v
     SET snapshot = jsonb_set(v.snapshot, '{steps}', (
       SELECT jsonb_agg(CASE WHEN renames ? (e.step->>'title')
                             THEN jsonb_set(e.step, '{title}', to_jsonb(renames->>(e.step->>'title')))
                             ELSE e.step END ORDER BY e.ord)
         FROM jsonb_array_elements(v.snapshot->'steps') WITH ORDINALITY e(step, ord)))
   WHERE v.id = ANY(vids);
  GET DIAGNOSTICS n_rows = ROW_COUNT;
  ALTER TABLE public.onboarding_template_versions ENABLE TRIGGER block_template_version_mutation;

  SELECT count(*) INTO n_left FROM public.onboarding_template_versions v, jsonb_array_elements(v.snapshot->'steps') e
   WHERE e->>'title' ~* 'lead designer|staging team';
  IF n_rows <> 9 OR n_left <> 0 THEN
    RAISE EXCEPTION 'Check failed (versions changed %, names left %); nothing changed.', n_rows, n_left;
  END IF;

  INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason, before_value, after_value)
  VALUES (actor, 'Admin', 'template_version_names.apply', 'onboarding_template_versions', 'Saved template versions',
    'Saved template version step names now say Director of Onboarding and Stager, like the live steps. Only the names changed. Undo: docs/pending/template-version-names/apply.undo.sql.',
    jsonb_build_object('steps', b),
    jsonb_build_object('versions', n_rows, 'steps', n_steps, 'names_left', n_left, 'renames', renames));
END $tvn$;