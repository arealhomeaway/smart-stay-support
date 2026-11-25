DO $patch$
DECLARE def text;
BEGIN
 SELECT pg_get_functiondef('public.save_owner_card_work(jsonb)'::regprocedure) INTO def;
 def:=replace(def,
 $old$eid:=public.owner_update_time_entry(old_entry,jsonb_build_object('mode','edit','activity',act,'entryDate',_save->>'entryDate','minutes',mins,'addPaths',paths));$old$,
 $new$IF EXISTS(SELECT 1 FROM public.owner_time_entries e WHERE e.id=old_entry AND e.owner_user_id=uid AND e.activity=act AND e.minutes=mins AND e.entry_date=(_save->>'entryDate')::date) AND jsonb_array_length(paths)=0 THEN eid:=old_entry;
   ELSE eid:=public.owner_update_time_entry(old_entry,jsonb_build_object('mode','edit','activity',act,'entryDate',_save->>'entryDate','minutes',mins,'addPaths',paths)); END IF;$new$);
 def:=replace(def,
 $old$ELSIF src='review' THEN
   IF r.status IN ('awaiting_owner','returned') THEN$old$,
 $new$ELSIF src='review' THEN
   IF nullif(_save->>'approvalId','') IS NOT NULL AND nullif(_save->>'decision','') IS NOT NULL AND nullif(_save->>'publicationId','') IS NOT NULL THEN
    SELECT * INTO ap FROM public.approvals WHERE id=(_save->>'approvalId')::uuid;
    IF NOT FOUND OR NOT private.owner_current_property_for_actor(uid,ap.property_id,pid) THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE='42501'; END IF;
    IF ap.status='pending' THEN PERFORM public.respond_owner_approval(ap.id,(_save->>'publicationId')::uuid,ap.updated_at,(_save->>'decision') IN ('yes','approved','authorize'),act); END IF;
   END IF;
   IF r.status IN ('awaiting_owner','returned') THEN$new$);
 EXECUTE def;
 SELECT pg_get_functiondef('public.read_owner_work_history(uuid)'::regprocedure) INTO def;
 def:=replace(def,
 $old$) SELECT coalesce(jsonb_agg(row ORDER BY row->>'savedAt' DESC,row->>'id'),'[]'::jsonb) INTO result FROM rows;$old$,
 $new$UNION ALL
 SELECT jsonb_build_object('id',w.id,'entryId',NULL,'saveId',NULL,'source','opportunity','cardId',w.id,'title',w.title,'kind','Card',
 'date',coalesce(w.completed_at,w.responded_at),'savedAt',coalesce(w.completed_at,w.responded_at),'activity',coalesce(w.owner_response->-1->>'text',''),
 'minutes',0,'superseded',false,'actorId',NULL,'values','{}'::jsonb,'files','[]'::jsonb,'paths','[]'::jsonb,'propertyIds',jsonb_build_array(w.property_id),'flagged',false)
 FROM public.work_items w WHERE w.program_id=_program AND w.kind='opportunity' AND (w.completed_at IS NOT NULL OR w.responded_at IS NOT NULL)
 AND NOT EXISTS(SELECT 1 FROM public.owner_work_saves s WHERE s.program_id=_program AND s.card_id=w.id)
 ) SELECT coalesce(jsonb_agg(row ORDER BY row->>'savedAt' DESC,row->>'id'),'[]'::jsonb) INTO result FROM rows;$new$);
 EXECUTE def;
END $patch$;
