CREATE OR REPLACE FUNCTION private.str_report_create_version(_program uuid, _property uuid, _actor uuid, _reason text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE per record; built jsonb; v int; rid uuid; prev uuid; st text; u uuid; pname text;
BEGIN
  SELECT * INTO per FROM private.str_program_period(_program);
  IF per.period_start IS NULL THEN RAISE EXCEPTION 'The program has no start date.'; END IF;
  built := private.str_report_build(_program, _property, per.period_start, per.period_end, true, true);
  SELECT coalesce(max(version),0)+1 INTO v FROM public.str_participation_reports WHERE program_id=_program AND property_id=_property;
  SELECT id INTO prev FROM public.str_participation_reports
   WHERE program_id=_program AND property_id=_property AND status='released';
  st := CASE WHEN jsonb_array_length(built->'blockers') = 0 THEN 'released' ELSE 'pending_review' END;
  INSERT INTO public.str_participation_reports(program_id, property_id, version, status, period_start, period_end,
    snapshot, source_refs, blockers, revision_reason, supersedes_id, released_at, released_by, created_by)
  VALUES (_program, _property, v, st, per.period_start, per.period_end,
    private.str_report_owner_safe(built || jsonb_build_object('version', v), false),
    private.str_report_refs(built), built->'blockers', _reason, prev,
    CASE WHEN st='released' THEN now() END, CASE WHEN st='released' THEN _actor END, _actor)
  RETURNING id INTO rid;
  IF st = 'released' AND prev IS NOT NULL THEN
    UPDATE public.str_participation_reports SET status='superseded', superseded_at=now() WHERE id=prev;
  END IF;
  IF st = 'pending_review' THEN
    SELECT public.format_property_label(to_jsonb(properties))->>'primary' INTO pname FROM public.properties WHERE id=_property;
    FOR u IN SELECT * FROM private.cleaner_leadership_ids() LOOP
      INSERT INTO public.staff_notifications(user_id, kind, title, body, entity_type, entity_id, link_path, priority)
      VALUES (u, 'str_report_review', format('STR report v%s for %s needs review before release', v, pname),
        format('%s activity record(s) are under review. Resolve or intentionally exclude them to release the owner report.',
               jsonb_array_length(built->'blockers')),
        'property', _property, '/str-participation-report?property='||_property, 'normal');
    END LOOP;
  END IF;
  RETURN rid;
END $function$
;