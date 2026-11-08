CREATE OR REPLACE FUNCTION public.save_playbook_draft(_id uuid, _expected_updated_at timestamp with time zone, _content jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _actor uuid := auth.uid(); _old public.playbooks; _new public.playbooks; _key text; _version integer; _step jsonb; _position integer := 0;
BEGIN
  IF _actor IS NULL OR NOT public.can_manage_playbooks(_actor) THEN RAISE EXCEPTION 'Only Admins and Directors can edit playbooks.'; END IF;
  IF _id IS NULL THEN
    PERFORM set_config('resolve.playbook_write','on',true);
    INSERT INTO public.playbooks(title,category,status,active,playbook_key,source)
      VALUES('New draft','other','draft',false,gen_random_uuid()::text,'authored') RETURNING * INTO _old;
    _id := _old.id;
    _expected_updated_at := _old.updated_at;
  END IF;
  SELECT * INTO _old FROM public.playbooks WHERE id = _id;
  IF NOT FOUND OR _old.checklist IS NOT NULL THEN RAISE EXCEPTION 'Ordinary playbook not found.'; END IF;
  _key := coalesce(_old.playbook_key, _old.id::text);
  PERFORM pg_advisory_xact_lock(hashtext('playbook:'||_key));
  SELECT * INTO _old FROM public.playbooks WHERE id = _id FOR UPDATE;
  IF _old.updated_at IS DISTINCT FROM _expected_updated_at THEN RAISE EXCEPTION 'This playbook changed. Reopen it before saving.'; END IF;
  IF nullif(trim(_content->>'title'),'') IS NULL OR nullif(trim(_content->>'category'),'') IS NULL
    OR jsonb_typeof(_content->'steps') IS DISTINCT FROM 'array' OR jsonb_typeof(_content->'applies_to') IS DISTINCT FROM 'array'
    OR jsonb_array_length(_content->'applies_to') = 0 THEN RAISE EXCEPTION 'Title, category and applies to are required.'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(_content->'applies_to') a WHERE a NOT IN ('ticket','work_order','recovery','claim')) THEN RAISE EXCEPTION 'Invalid applies to.'; END IF;
  PERFORM set_config('resolve.playbook_write','on',true);
  IF _old.status = 'draft' THEN
    _new := _old;
  ELSE
    IF EXISTS(SELECT 1 FROM public.playbooks WHERE coalesce(playbook_key,id::text)=_key AND status IN ('draft','in_review') AND id<>_old.id AND checklist IS NULL) THEN
      RAISE EXCEPTION 'A draft version already exists. Edit that version instead.';
    END IF;
    SELECT coalesce(max(version),0)+1 INTO _version FROM public.playbooks WHERE coalesce(playbook_key,id::text)=_key;
    INSERT INTO public.playbooks(title,category,summary,active,playbook_key,version,status,applies_to,matcher,priority_reason,risk_flags,immediate_actions,escalate_if,vendor_brief,source,source_refs,source_version,generated_at,required_evidence,supersedes_id,requires_director)
      VALUES(_old.title,_old.category,_old.summary,false,_key,_version,'draft',_old.applies_to,_old.matcher,_old.priority_reason,_old.risk_flags,_old.immediate_actions,_old.escalate_if,_old.vendor_brief,_old.source,_old.source_refs,_old.source_version,_old.generated_at,_old.required_evidence,_old.id,_old.requires_director) RETURNING * INTO _new;
  END IF;
  UPDATE public.playbooks SET title=trim(_content->>'title'), summary=nullif(trim(_content->>'summary'),''), category=trim(_content->>'category'),
    applies_to=ARRAY(SELECT jsonb_array_elements_text(_content->'applies_to')),
    matcher=_old.matcher||jsonb_build_object('keywords',coalesce(_content->'keywords','[]'::jsonb),'objects',_content->'applies_to'),
    risk_flags=coalesce(_content->'risk_flags','[]'::jsonb), immediate_actions=ARRAY(SELECT jsonb_array_elements_text(coalesce(_content->'immediate_actions','[]'::jsonb))),
    escalate_if=ARRAY(SELECT jsonb_array_elements_text(coalesce(_content->'escalate_if','[]'::jsonb))), required_evidence=ARRAY(SELECT jsonb_array_elements_text(coalesce(_content->'required_evidence','[]'::jsonb))), active=false
    WHERE id=_new.id;
  DELETE FROM public.playbook_steps WHERE playbook_id=_new.id;
  FOR _step IN SELECT value FROM jsonb_array_elements(_content->'steps') LOOP
    IF nullif(trim(_step->>'instruction'),'') IS NULL THEN RAISE EXCEPTION 'Each step needs an instruction.'; END IF;
    _position := _position+1;
    INSERT INTO public.playbook_steps(playbook_id,position,instruction,detail,required,photo_required)
      VALUES(_new.id,_position,trim(_step->>'instruction'),nullif(trim(_step->>'detail'),''),coalesce((_step->>'required')::boolean,true),coalesce((_step->>'photo_required')::boolean,false));
  END LOOP;
  RETURN jsonb_build_object('id',_new.id,'version',_new.version,'created',_new.id<>_old.id);
END $function$
