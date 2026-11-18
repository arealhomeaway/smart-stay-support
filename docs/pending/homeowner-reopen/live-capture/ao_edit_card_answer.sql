CREATE OR REPLACE FUNCTION public.ao_edit_card_answer(_plan_card uuid, _values jsonb, _files jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); pc public.ao_home_plan_cards; c public.ao_library_cards; con public.ao_contributions;
  f jsonb; new_files jsonb := coalesce(_files, '[]'::jsonb); vals jsonb := coalesce(_values, '{}'::jsonb);
  change_id uuid; mid uuid; sib public.ao_home_plan_cards;
BEGIN
  SELECT * INTO pc FROM public.ao_home_plan_cards WHERE id = _plan_card FOR UPDATE;
  IF NOT FOUND OR uid IS NULL OR NOT private.owner_current_property_for_actor(uid, pc.property_id, pc.program_id) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  IF pc.owner_completed_at IS NULL THEN RAISE EXCEPTION 'Send your answer first.'; END IF;
  IF jsonb_typeof(vals) <> 'object' THEN RAISE EXCEPTION 'Your answer could not be read.'; END IF;
  IF jsonb_typeof(new_files) <> 'array' OR jsonb_array_length(new_files) > 20 THEN RAISE EXCEPTION 'Attach up to 20 files.'; END IF;
  SELECT * INTO c FROM public.ao_library_cards WHERE id = pc.card_id;
  SELECT * INTO con FROM public.ao_contributions WHERE plan_card_id = pc.id ORDER BY submitted_at DESC LIMIT 1 FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Your earlier answer could not be found.'; END IF;
  FOR f IN SELECT * FROM jsonb_array_elements(new_files) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.documents d WHERE d.id = (f ->> 'document_id')::uuid AND d.deleted_at IS NULL
                     AND (d.property_id = pc.property_id OR (d.entity_type = 'property' AND d.entity_id = pc.property_id))
                     AND (d.uploaded_by = uid OR con.files @> jsonb_build_array(jsonb_build_object('document_id', f ->> 'document_id')))) THEN
      RAISE EXCEPTION 'A file is not one of your files on this home.';
    END IF;
  END LOOP;
  new_files := coalesce((SELECT jsonb_agg(jsonb_build_object('document_id', x ->> 'document_id', 'name', left(coalesce(x ->> 'name', ''), 300)))
                       FROM jsonb_array_elements(new_files) x), '[]'::jsonb);
  IF con.field_values = vals AND con.files = new_files THEN RAISE EXCEPTION 'Nothing changed.'; END IF;
  mid := public.post_home_chat_message(pc.property_id, 'owner', 'I updated my answer on ' || c.title || '.', '[]'::jsonb, '{}'::uuid[]);
  INSERT INTO public.ao_contribution_changes(plan_card_id, contribution_id, property_id, program_id, changed_by,
      before_values, after_values, before_files, after_files, chat_message_id)
    VALUES (pc.id, con.id, pc.property_id, pc.program_id, uid, con.field_values, vals, con.files, new_files, mid)
    RETURNING id INTO change_id;
  UPDATE public.ao_contributions SET field_values = vals, files = new_files WHERE id = con.id;
  -- A market card answered once for every home keeps one answer: its other homes' copies follow.
  IF c.once_per_owner THEN
    FOR sib IN SELECT * FROM public.ao_home_plan_cards s
                WHERE s.program_id = pc.program_id AND s.card_id = pc.card_id AND s.id <> pc.id AND s.owner_completed_at IS NOT NULL LOOP
      CONTINUE WHEN NOT private.owner_current_property_for_actor(uid, sib.property_id, sib.program_id);
      INSERT INTO public.ao_contribution_changes(plan_card_id, contribution_id, property_id, program_id, changed_by,
          before_values, after_values, before_files, after_files, chat_message_id)
        SELECT sib.id, x.id, sib.property_id, sib.program_id, uid, x.field_values, vals, x.files, new_files, mid
          FROM public.ao_contributions x WHERE x.plan_card_id = sib.id ORDER BY x.submitted_at DESC LIMIT 1;
      UPDATE public.ao_contributions SET field_values = vals, files = new_files
       WHERE id = (SELECT x.id FROM public.ao_contributions x WHERE x.plan_card_id = sib.id ORDER BY x.submitted_at DESC LIMIT 1);
    END LOOP;
  END IF;
  RETURN change_id;
END $function$

