BEGIN;

ALTER TABLE public.playbook_approvals ADD COLUMN version integer;

CREATE FUNCTION public.can_manage_playbooks(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private AS $$
  SELECT public.has_role(_user_id, 'admin') OR public.is_director(_user_id) OR public.is_onboarding_director(_user_id)
$$;
REVOKE ALL ON FUNCTION public.can_manage_playbooks(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_playbooks(uuid) TO authenticated, service_role;

CREATE FUNCTION private.guard_authored_playbook_write() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, private AS $$
DECLARE _checklist boolean;
BEGIN
  IF TG_TABLE_NAME = 'playbooks' THEN
    IF TG_OP = 'DELETE' THEN
      RAISE EXCEPTION 'Archive playbooks instead of deleting them.';
    END IF;
    IF NEW.checklist IS NOT NULL THEN RETURN NEW; END IF;
    IF TG_OP = 'UPDATE' AND OLD.checklist IS NOT NULL THEN RETURN NEW; END IF;
  ELSIF TG_TABLE_NAME = 'playbook_steps' THEN
    IF TG_OP = 'DELETE' THEN
      SELECT checklist IS NOT NULL INTO _checklist FROM public.playbooks WHERE id = OLD.playbook_id;
    ELSE
      SELECT checklist IS NOT NULL INTO _checklist FROM public.playbooks WHERE id = NEW.playbook_id;
    END IF;
    IF _checklist THEN
      IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
    END IF;
  ELSE
    IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Approval history never changes.'; END IF;
    SELECT checklist IS NOT NULL INTO _checklist FROM public.playbooks WHERE id = NEW.playbook_id;
    IF _checklist THEN RETURN NEW; END IF;
  END IF;
  IF auth.uid() IS NOT NULL AND coalesce(current_setting('resolve.playbook_write',true),'') <> 'on' THEN
    RAISE EXCEPTION 'Use the audited playbook editing action.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER authored_playbooks_guard BEFORE INSERT OR UPDATE OR DELETE ON public.playbooks FOR EACH ROW EXECUTE FUNCTION private.guard_authored_playbook_write();
CREATE TRIGGER authored_playbook_steps_guard BEFORE INSERT OR UPDATE OR DELETE ON public.playbook_steps FOR EACH ROW EXECUTE FUNCTION private.guard_authored_playbook_write();
CREATE TRIGGER authored_playbook_history_guard BEFORE INSERT OR UPDATE OR DELETE ON public.playbook_approvals FOR EACH ROW EXECUTE FUNCTION private.guard_authored_playbook_write();

CREATE FUNCTION public.save_playbook_draft(_id uuid, _expected_updated_at timestamptz, _content jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
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
END $$;
REVOKE ALL ON FUNCTION public.save_playbook_draft(uuid,timestamptz,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_playbook_draft(uuid,timestamptz,jsonb) TO authenticated, service_role;

CREATE FUNCTION public.change_playbook_state(_id uuid, _expected_updated_at timestamptz, _action text, _note text DEFAULT '') RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE _actor uuid:=auth.uid(); _old public.playbooks; _sibling public.playbooks; _key text; _to text; _role text;
BEGIN
  IF _actor IS NULL OR NOT public.is_internal_staff(_actor) THEN RAISE EXCEPTION 'Staff access required.'; END IF;
  IF _action NOT IN ('approve','archive','note','submit') THEN RAISE EXCEPTION 'Invalid playbook action.'; END IF;
  IF _action IN ('approve','archive') AND NOT public.can_manage_playbooks(_actor) THEN RAISE EXCEPTION 'Only Admins and Directors can approve or archive playbooks.'; END IF;
  SELECT * INTO _old FROM public.playbooks WHERE id=_id;
  IF NOT FOUND OR _old.checklist IS NOT NULL THEN RAISE EXCEPTION 'Ordinary playbook not found.'; END IF;
  _key:=coalesce(_old.playbook_key,_old.id::text);
  PERFORM pg_advisory_xact_lock(hashtext('playbook:'||_key));
  SELECT * INTO _old FROM public.playbooks WHERE id=_id FOR UPDATE;
  IF _old.updated_at IS DISTINCT FROM _expected_updated_at THEN RAISE EXCEPTION 'This playbook changed. Reopen it before saving.'; END IF;
  IF _action='approve' AND _old.status NOT IN ('draft','in_review') THEN RAISE EXCEPTION 'Only a draft or review version can be approved.'; END IF;
  IF _action='submit' AND _old.status <> 'draft' THEN RAISE EXCEPTION 'Only a draft can be sent for review.'; END IF;
  IF _action='note' AND nullif(trim(_note),'') IS NULL THEN RAISE EXCEPTION 'Write a review note first.'; END IF;
  PERFORM set_config('resolve.playbook_write','on',true);
  _role:=CASE WHEN public.has_role(_actor,'admin') THEN 'admin' WHEN public.is_director(_actor) THEN 'director_ops' WHEN public.is_onboarding_director(_actor) THEN 'onboarding_director' ELSE 'staff' END;
  _to:=CASE _action WHEN 'approve' THEN 'approved' WHEN 'archive' THEN 'retired' WHEN 'submit' THEN 'in_review' ELSE _old.status END;
  IF _action='approve' THEN
    FOR _sibling IN SELECT * FROM public.playbooks WHERE coalesce(playbook_key,id::text)=_key AND id<>_id AND checklist IS NULL AND status IN ('active','approved') FOR UPDATE LOOP
      UPDATE public.playbooks SET status='retired',active=false,retired_at=now() WHERE id=_sibling.id;
      INSERT INTO public.playbook_approvals(playbook_id,from_status,to_status,actor_id,actor_role,note,version) VALUES(_sibling.id,_sibling.status,'retired',_actor,_role,'Replaced by version '||_old.version,_sibling.version);
    END LOOP;
    UPDATE public.work_types SET playbook_id=_id WHERE playbook_id IN (SELECT id FROM public.playbooks WHERE coalesce(playbook_key,id::text)=_key AND id<>_id AND checklist IS NULL);
  END IF;
  UPDATE public.playbooks SET status=_to, review_note=nullif(trim(_note),''),
    active=CASE WHEN _action='approve' THEN true WHEN _action='archive' THEN false ELSE active END,
    approved_by=CASE WHEN _action='approve' THEN _actor ELSE approved_by END, approved_at=CASE WHEN _action='approve' THEN now() ELSE approved_at END,
    effective_on=CASE WHEN _action='approve' THEN current_date ELSE effective_on END,
    retired_at=CASE WHEN _action='archive' THEN now() ELSE retired_at END,
    submitted_by=CASE WHEN _action='submit' THEN _actor ELSE submitted_by END, submitted_at=CASE WHEN _action='submit' THEN now() ELSE submitted_at END WHERE id=_id;
  INSERT INTO public.playbook_approvals(playbook_id,from_status,to_status,actor_id,actor_role,note,version) VALUES(_id,_old.status,_to,_actor,_role,nullif(trim(_note),''),_old.version);
  RETURN jsonb_build_object('id',_id,'version',_old.version);
END $$;
REVOKE ALL ON FUNCTION public.change_playbook_state(uuid,timestamptz,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.change_playbook_state(uuid,timestamptz,text,text) TO authenticated, service_role;
COMMIT;