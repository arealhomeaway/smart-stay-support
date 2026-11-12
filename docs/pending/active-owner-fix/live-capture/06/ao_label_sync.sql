CREATE OR REPLACE FUNCTION private.ao_label_sync(_property uuid, _actor uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE lbl public.property_labels; should boolean; live uuid; who text;
BEGIN
  SELECT * INTO lbl FROM public.property_labels WHERE system_key = 'active_owner' AND retired_at IS NULL;
  IF NOT FOUND THEN RETURN 'no_label'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.owner_program_properties e JOIN public.owner_programs p ON p.id = e.program_id
                  JOIN public.properties h ON h.id = e.property_id
                 WHERE e.property_id = _property AND e.inclusion_status = 'included' AND e.archived_at IS NULL
                   AND p.status = 'active' AND p.archived_at IS NULL AND NOT p.is_demo AND NOT h.is_demo) INTO should;
  SELECT id INTO live FROM public.property_label_assignments WHERE property_id = _property AND label_id = lbl.id AND removed_at IS NULL;
  who := CASE WHEN _actor IS NULL THEN 'Resolve' ELSE coalesce(private.actor_label(_actor), 'Resolve') END;
  PERFORM set_config('app.system_label', 'on', true);
  IF should AND live IS NULL THEN
    INSERT INTO public.property_label_assignments(property_id, label_id, added_by) VALUES (_property, lbl.id, _actor);
    INSERT INTO public.property_label_events(label_id, property_id, action, to_name, actor_id, actor_label)
      VALUES (lbl.id, _property, 'added', lbl.name, _actor, who);
    INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_id, entity_label, reason)
      VALUES (_actor, who, 'label_added', 'property', _property, lbl.name, 'Active Owner enrollment');
    PERFORM set_config('app.system_label', '', true);
    RETURN 'added';
  ELSIF NOT should AND live IS NOT NULL THEN
    UPDATE public.property_label_assignments SET removed_at = now(), removed_by = _actor WHERE id = live;
    INSERT INTO public.property_label_events(label_id, property_id, action, from_name, actor_id, actor_label)
      VALUES (lbl.id, _property, 'removed', lbl.name, _actor, who);
    INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_id, entity_label, reason)
      VALUES (_actor, who, 'label_removed', 'property', _property, lbl.name, 'Left the Active Owner program');
    PERFORM set_config('app.system_label', '', true);
    RETURN 'removed';
  END IF;
  PERFORM set_config('app.system_label', '', true);
  RETURN 'unchanged';
END $function$
;
