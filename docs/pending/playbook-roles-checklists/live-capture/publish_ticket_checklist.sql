CREATE OR REPLACE FUNCTION public.publish_ticket_checklist(_category text, _title text, _checklist jsonb, _sop_url text DEFAULT NULL::text, _note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE cur record; new_id uuid; uid uuid := auth.uid();
BEGIN
  IF uid IS NULL OR NOT (private.has_role(uid, 'admin') OR private.is_director(uid)) THEN
    RAISE EXCEPTION 'Only an Admin or the Operations Director can publish a ticket checklist.';
  END IF;
  IF _category NOT IN ('lockout','cleaning','maintenance','other_complaint','damage','booking') THEN
    RAISE EXCEPTION 'Unknown checklist category.';
  END IF;
  IF jsonb_typeof(_checklist -> 'steps') <> 'array' OR jsonb_array_length(_checklist -> 'steps') = 0 THEN
    RAISE EXCEPTION 'A checklist needs at least one step.';
  END IF;
  IF length(trim(coalesce(_title, ''))) = 0 THEN RAISE EXCEPTION 'A checklist needs a title.'; END IF;
  PERFORM set_config('resolve.checklist_publish', 'on', true);
  SELECT id, version, playbook_key INTO cur FROM public.playbooks
    WHERE checklist IS NOT NULL AND checklist_category = _category AND status = 'approved'
    FOR UPDATE;
  IF cur.id IS NOT NULL THEN
    UPDATE public.playbooks SET status = 'retired', retired_at = now() WHERE id = cur.id;
  END IF;
  INSERT INTO public.playbooks (category, title, active, playbook_key, version, status, approved_by, approved_at,
      effective_on, applies_to, source, supersedes_id, review_note, checklist, checklist_category, sop_url)
  VALUES ('checklist', trim(_title), false, coalesce(cur.playbook_key, 'checklist:' || _category),
      coalesce(cur.version, 0) + 1, 'approved', uid, now(), current_date, ARRAY['ticket'], 'authored',
      cur.id, nullif(trim(coalesce(_note, '')), ''), _checklist, _category, nullif(trim(coalesce(_sop_url, '')), ''))
  RETURNING id INTO new_id;
  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, entity_label, reason, before_value, after_value)
  VALUES (uid, 'ticket_checklist_published', 'playbook', new_id, trim(_title), nullif(trim(coalesce(_note, '')), ''),
      CASE WHEN cur.id IS NULL THEN NULL ELSE jsonb_build_object('id', cur.id, 'version', cur.version) END,
      jsonb_build_object('category', _category, 'version', coalesce(cur.version, 0) + 1));
  RETURN new_id;
END $function$

