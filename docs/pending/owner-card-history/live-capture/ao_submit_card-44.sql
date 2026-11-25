CREATE OR REPLACE FUNCTION public.ao_submit_card(_plan_card uuid, _values jsonb, _files jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); pc public.ao_home_plan_cards; f jsonb; new_files jsonb := coalesce(_files, '[]'::jsonb); cid uuid;
BEGIN
  IF jsonb_typeof(new_files) <> 'array' OR jsonb_array_length(new_files) > 20 THEN RAISE EXCEPTION 'Attach up to 20 files.'; END IF;
  SELECT * INTO pc FROM public.ao_home_plan_cards WHERE id = _plan_card;
  IF NOT FOUND OR uid IS NULL OR NOT private.owner_current_property_for_actor(uid, pc.property_id, pc.program_id) THEN
    RAISE EXCEPTION 'Not allowed' USING ERRCODE = '42501';
  END IF;
  FOR f IN SELECT * FROM jsonb_array_elements(new_files) LOOP
    IF NOT EXISTS (SELECT 1 FROM public.documents d WHERE d.id = (f ->> 'document_id')::uuid AND d.deleted_at IS NULL
                     AND (d.property_id = pc.property_id OR (d.entity_type = 'property' AND d.entity_id = pc.property_id))
                     AND d.uploaded_by = uid) THEN
      RAISE EXCEPTION 'A file is not one of your files on this home.';
    END IF;
  END LOOP;
  new_files := coalesce((SELECT jsonb_agg(jsonb_build_object('document_id', x ->> 'document_id', 'name', left(coalesce(x ->> 'name', ''), 300)))
                       FROM jsonb_array_elements(new_files) x), '[]'::jsonb);
  cid := public.ao_submit_card(_plan_card, _values);
  IF jsonb_array_length(new_files) > 0 THEN
    UPDATE public.ao_contributions x SET files = new_files
     WHERE x.id = cid
        OR (x.program_id = pc.program_id AND x.card_id = pc.card_id AND x.submitted_by = uid AND x.submitted_at = now());
  END IF;
  RETURN cid;
END $function$
;
