CREATE OR REPLACE FUNCTION public.change_playbook_state(_id uuid, _expected_updated_at timestamp with time zone, _action text, _note text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE _actor uuid:=auth.uid(); _old public.playbooks; _sibling public.playbooks; _key text; _to text; _role text;
BEGIN
  IF _actor IS NULL OR NOT public.is_internal_staff(_actor) THEN RAISE EXCEPTION 'Staff access required.'; END IF;
  IF _action NOT IN ('approve','archive','note','submit') THEN RAISE EXCEPTION 'Invalid playbook action.'; END IF;
  IF NOT public.can_save_playbooks(_actor) THEN RAISE EXCEPTION 'Only Admins, Directors and the Operations Supervisor can change playbooks.'; END IF;
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
END $function$;
