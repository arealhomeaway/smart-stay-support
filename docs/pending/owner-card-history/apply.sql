CREATE TABLE public.owner_work_saves (
 id uuid PRIMARY KEY,
 program_id uuid NOT NULL REFERENCES public.owner_programs(id),
 actor_id uuid NOT NULL,
 source text NOT NULL DEFAULT 'work',
 card_id uuid,
 title text NOT NULL DEFAULT 'Added work',
 entry_id uuid REFERENCES public.owner_time_entries(id),
 field_values jsonb NOT NULL DEFAULT '{}'::jsonb,
 files jsonb NOT NULL DEFAULT '[]'::jsonb,
 property_ids uuid[] NOT NULL DEFAULT '{}',
 saved_at timestamptz NOT NULL DEFAULT now(),
 supersedes uuid REFERENCES public.owner_work_saves(id),
 flagged boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.owner_work_saves TO authenticated;
GRANT ALL ON public.owner_work_saves TO service_role;
ALTER TABLE public.owner_work_saves ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_work_saves_read ON public.owner_work_saves FOR SELECT TO authenticated
 USING ((private.is_staff(auth.uid()) OR private.owner_program_readable(auth.uid(),program_id,false))
 AND (NOT private.is_synthetic_account() OR EXISTS(SELECT 1 FROM public.owner_programs p WHERE p.id=program_id AND p.is_demo)));

CREATE OR REPLACE FUNCTION public.save_owner_card_work(_save jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); prog public.owner_programs; pc public.ao_home_plan_cards; r public.owner_reviews;
 w public.work_items; ap public.approvals; old public.owner_work_saves; receipt public.owner_work_saves;
 sid uuid:=(_save->>'saveKey')::uuid; pid uuid:=(_save->>'programId')::uuid;
 card uuid:=nullif(_save->>'cardId','')::uuid; src text:=coalesce(_save->>'source','work');
 eid uuid; rid uuid; mins integer:=coalesce((_save->>'minutes')::integer,0);
 vals jsonb:=coalesce(_save->'values','{}'::jsonb); paths jsonb:=coalesce(_save->'paths','[]'::jsonb);
 files jsonb:=coalesce(_save->'files','[]'::jsonb); homes uuid[]; act text:=coalesce(_save->>'activity','');
 phase text; title text:='Added work'; issue boolean:=false; tmp uuid; old_entry uuid;
BEGIN
 prog:=private.lock_owner_time_program(pid,uid,false,card IS NULL);
 PERFORM pg_advisory_xact_lock(hashtextextended('owner-work-save:'||sid::text,0));
 SELECT * INTO receipt FROM public.owner_work_saves WHERE id=sid;
 IF FOUND THEN
  IF receipt.actor_id IS DISTINCT FROM uid OR receipt.program_id IS DISTINCT FROM pid THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE='42501'; END IF;
  RETURN receipt.id;
 END IF;
 homes:=ARRAY(SELECT jsonb_array_elements_text(coalesce(_save->'propertyIds','[]'::jsonb))::uuid);
 IF card IS NOT NULL THEN
  IF src='plan' THEN
   SELECT * INTO pc FROM public.ao_home_plan_cards WHERE id=card AND program_id=pid FOR UPDATE;
   IF NOT FOUND OR NOT private.owner_current_property_for_actor(uid,pc.property_id,pid) THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE='42501'; END IF;
   rid:=pc.owner_review_id; homes:=ARRAY[pc.property_id];
   SELECT c.title INTO title FROM public.ao_library_cards c WHERE c.id=pc.card_id;
  ELSIF src='review' THEN
   SELECT * INTO r FROM public.owner_reviews WHERE id=card AND program_id=pid FOR UPDATE;
   IF NOT FOUND THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE='42501'; END IF;
   rid:=r.id; title:=r.title;
  ELSIF src='opportunity' THEN
   SELECT * INTO w FROM public.work_items WHERE id=card;
   IF NOT FOUND OR NOT private.owner_current_property_for_actor(uid,w.property_id,pid) THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE='42501'; END IF;
   title:=w.title; homes:=ARRAY[w.property_id];
  ELSIF src IN ('approval','action') THEN
   SELECT * INTO ap FROM public.approvals WHERE id=card;
   IF NOT FOUND OR NOT private.owner_current_property_for_actor(uid,ap.property_id,pid) THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE='42501'; END IF;
   title:=ap.title; homes:=ARRAY[ap.property_id];
  END IF;
 END IF;
 IF nullif(_save->>'editSaveId','') IS NOT NULL THEN
  SELECT * INTO old FROM public.owner_work_saves WHERE id=(_save->>'editSaveId')::uuid FOR UPDATE;
  IF NOT FOUND OR old.actor_id IS DISTINCT FROM uid OR old.program_id IS DISTINCT FROM pid THEN RAISE EXCEPTION 'Not allowed' USING ERRCODE='42501'; END IF;
  old_entry:=old.entry_id;
 ELSIF nullif(_save->>'editEntryId','') IS NOT NULL THEN old_entry:=(_save->>'editEntryId')::uuid;
 END IF;
 issue:=card IS NOT NULL AND (rid IS NULL AND src IN ('plan','review'));
 IF rid IS NOT NULL THEN SELECT * INTO r FROM public.owner_reviews WHERE id=rid; END IF;
 phase:=CASE WHEN r.phase IN ('onboarding','ongoing') THEN r.phase ELSE coalesce(_save->>'phase','ongoing') END;
 -- A receipt is the replay key and card link, never a second hour total.
 INSERT INTO public.owner_work_saves(id,program_id,actor_id,source,card_id,title,field_values,files,property_ids,supersedes,flagged)
 VALUES(sid,pid,uid,src,card,coalesce(title,'Added work'),vals,files,homes,old.id,issue);
 IF mins>0 THEN
  IF old_entry IS NOT NULL THEN
   eid:=public.owner_update_time_entry(old_entry,jsonb_build_object('mode','edit','activity',act,'entryDate',_save->>'entryDate','minutes',mins,'addPaths',paths));
  ELSE
   -- Invalid legacy scope is flagged, not guessed; preserve the exact card link in the receipt.
   IF rid IS NOT NULL AND (r.task_type NOT IN ('property_specific','multi_property','program_wide') OR r.task_type IS NULL OR r.status NOT IN ('awaiting_owner','answered','returned')) THEN issue:=true; rid:=NULL; END IF;
   eid:=public.log_owner_time_entry(jsonb_build_object('programId',pid,'phase',phase,'entryDate',_save->>'entryDate','minutes',mins,
    'activity',CASE WHEN length(trim(act))>=3 THEN act ELSE coalesce(title,'Added work') END,
    'confirmed',true,'reviewId',rid,'ticketId',CASE WHEN rid IS NOT NULL THEN r.ticket_id ELSE NULL END,
    'attachmentPaths',paths,'attachmentPath',paths->>0,'cardSaveKey',sid),homes);
   IF length(trim(act))<3 THEN issue:=true; END IF;
  END IF;
  UPDATE public.owner_work_saves SET entry_id=eid,flagged=issue WHERE id=sid;
  IF issue THEN UPDATE public.owner_time_entries SET flagged=true WHERE id=eid; END IF;
 END IF;
 IF card IS NOT NULL AND coalesce(_save->>'mode','save')<>'add' THEN
  IF src='plan' THEN
   IF pc.owner_completed_at IS NULL THEN tmp:=public.ao_submit_card(card,vals,files);
   ELSE
    IF NOT EXISTS(SELECT 1 FROM public.ao_contributions c WHERE c.plan_card_id=card AND c.field_values=vals AND c.files=files) THEN
     tmp:=public.ao_edit_card_answer(card,vals,files);
    END IF;
   END IF;
  ELSIF src='review' THEN
   IF r.status IN ('awaiting_owner','returned') THEN
    tmp:=public.respond_owner_review(card,r.updated_at,CASE WHEN r.auto_ticket THEN 'acknowledged' ELSE coalesce(nullif(_save->>'decision',''),'acknowledged') END,act,r.owner_update_revision);
   ELSIF nullif(act,'') IS NOT NULL THEN tmp:=public.owner_item_add(card,act); END IF;
  ELSIF src='opportunity' THEN
   IF nullif(_save->>'decision','') IS NOT NULL THEN
    PERFORM public.respond_owner_opportunity(card,'decision',_save->>'decision',act);
   ELSIF 'feedback'=ANY(w.response_types) THEN
    PERFORM public.respond_owner_opportunity(card,'feedback',NULL,act);
   ELSE PERFORM public.complete_owner_opportunity(card); END IF;
  ELSIF src IN ('approval','action') AND ap.status='pending' AND nullif(_save->>'decision','') IS NOT NULL THEN
   PERFORM public.respond_owner_approval(card,(_save->>'publicationId')::uuid,ap.updated_at,(_save->>'decision') IN ('yes','approved','authorize'),act);
  ELSE issue:=true; UPDATE public.owner_work_saves SET flagged=true WHERE id=sid;
  END IF;
 END IF;
 RETURN sid;
END $$;
REVOKE ALL ON FUNCTION public.save_owner_card_work(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_owner_card_work(jsonb) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.read_owner_work_history(_program uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE result jsonb; owner_access boolean:=private.owner_program_readable(auth.uid(),_program,false);
BEGIN
 IF NOT (coalesce(owner_access,false) OR private.is_staff(auth.uid())) OR (private.is_synthetic_account() AND NOT EXISTS(SELECT 1 FROM public.owner_programs WHERE id=_program AND is_demo)) THEN
  RAISE EXCEPTION 'Not allowed' USING ERRCODE='42501';
 END IF;
 WITH hours AS (
  SELECT e.*,EXISTS(SELECT 1 FROM public.owner_time_entries x WHERE x.amends_entry_id=e.id) AS superseded
  FROM public.owner_time_entries e JOIN public.owner_programs p ON p.id=e.program_id
  WHERE e.program_id=_program AND e.is_demo=p.is_demo
 ), rows AS (
 SELECT jsonb_build_object('id',e.id,'entryId',e.id,'saveId',s.id,'source',coalesce(s.source,'work'),'cardId',s.card_id,
 'title',coalesce(s.title,e.activity),'kind',CASE WHEN s.card_id IS NOT NULL THEN 'Card' ELSE 'Added work' END,
 'date',e.entry_date,'savedAt',e.created_at,'activity',concat_ws(E'\n',e.activity,nullif(s.field_values->>'link','')),'minutes',e.minutes,'superseded',e.superseded,
 'actorId',e.owner_user_id,'values',coalesce(s.field_values,'{}'::jsonb),'files',coalesce(s.files,'[]'::jsonb),
 'paths',coalesce(e.attachment_paths,'[]'::jsonb),'propertyIds',coalesce((SELECT jsonb_agg(property_id) FROM public.owner_time_entry_properties WHERE entry_id=e.id),'[]'::jsonb),
 'flagged',e.flagged) AS row FROM hours e LEFT JOIN LATERAL(SELECT * FROM public.owner_work_saves z WHERE z.entry_id=e.id ORDER BY saved_at DESC LIMIT 1) s ON true
 UNION ALL
 SELECT jsonb_build_object('id',s.id,'entryId',NULL,'saveId',s.id,'source',s.source,'cardId',s.card_id,'title',s.title,'kind',CASE WHEN s.card_id IS NULL THEN 'Added work' ELSE 'Card' END,
 'date',s.saved_at AT TIME ZONE 'America/Chicago','savedAt',s.saved_at,'activity',concat_ws(E'\n',s.field_values->>'activity',nullif(s.field_values->>'link','')),'minutes',0,
 'superseded',EXISTS(SELECT 1 FROM public.owner_work_saves x WHERE x.supersedes=s.id),'actorId',s.actor_id,'values',s.field_values,'files',s.files,'paths','[]'::jsonb,'propertyIds',to_jsonb(s.property_ids),'flagged',s.flagged)
 FROM public.owner_work_saves s WHERE s.program_id=_program AND s.entry_id IS NULL
 UNION ALL
 SELECT jsonb_build_object('id',c.id,'entryId',NULL,'saveId',NULL,'source','plan','cardId',c.plan_card_id,'title',l.title,'kind','Card',
 'date',c.submitted_at AT TIME ZONE 'America/Chicago','savedAt',c.submitted_at,'activity',coalesce(c.field_values->>'activity',c.field_values::text),'minutes',0,
 'superseded',false,'actorId',c.submitted_by,'values',c.field_values,'files',c.files,'paths','[]'::jsonb,'propertyIds',jsonb_build_array(c.property_id),'flagged',false)
 FROM public.ao_contributions c JOIN public.ao_library_cards l ON l.id=c.card_id
 WHERE c.program_id=_program AND NOT EXISTS(SELECT 1 FROM public.owner_work_saves s WHERE s.program_id=_program AND s.source='plan' AND s.card_id=c.plan_card_id)
 UNION ALL
 SELECT jsonb_build_object('id',r.id,'entryId',NULL,'saveId',NULL,'source','review','cardId',r.id,'title',r.title,'kind','Card','date',r.responded_at,
 'savedAt',r.responded_at,'activity',r.owner_response,'minutes',0,'superseded',false,'actorId',NULL,'values','{}'::jsonb,'files','[]'::jsonb,'paths','[]'::jsonb,
 'propertyIds',CASE WHEN r.property_id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(r.property_id) END,'flagged',false)
 FROM public.owner_reviews r WHERE r.program_id=_program AND r.responded_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.ao_home_plan_cards pc WHERE pc.owner_review_id=r.id)
 AND NOT EXISTS(SELECT 1 FROM public.owner_work_saves s WHERE s.program_id=_program AND s.card_id=r.id)
 ) SELECT coalesce(jsonb_agg(row ORDER BY row->>'savedAt' DESC,row->>'id'),'[]'::jsonb) INTO result FROM rows;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.read_owner_work_history(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_owner_work_history(uuid) TO authenticated,service_role;

CREATE OR REPLACE FUNCTION public.log_owner_time_entry(_entry jsonb, _property_ids uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE program public.owner_programs; opportunity public.owner_reviews; enrollment public.owner_program_properties;
 home public.properties; link record; chosen uuid[]; context_ids uuid[]; chosen_property uuid;
 entry_day date; reported_minutes integer; new_id uuid; ticket public.tickets; manual boolean;
 paths jsonb; path_item text;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to record participation.'; END IF;
 IF _entry IS NULL OR jsonb_typeof(_entry) IS DISTINCT FROM 'object' OR (_entry->'confirmed') IS DISTINCT FROM 'true'::jsonb THEN
  RAISE EXCEPTION 'Confirm that this entry records the time you personally spent.';
 END IF;
 program:=private.lock_owner_time_program((_entry->>'programId')::uuid,auth.uid(),false,true);
 entry_day:=(_entry->>'entryDate')::date; reported_minutes:=(_entry->>'minutes')::integer;
 manual:=nullif(_entry->>'reviewId','') IS NULL;
 IF entry_day IS NULL OR NOT isfinite(entry_day) OR entry_day>private.business_today() THEN
  RAISE EXCEPTION 'Choose a date no later than today.';
 END IF;
 IF length(trim(coalesce(_entry->>'activity',''))) < 3 THEN
  RAISE EXCEPTION 'What did you do? needs at least 3 characters.';
 END IF;
 IF length(trim(coalesce(_entry->>'activity',''))) > 2000 THEN
  RAISE EXCEPTION 'What did you do? can be up to 2,000 characters.';
 END IF;
 IF reported_minutes IS NULL OR reported_minutes NOT BETWEEN 1 AND 1440 THEN
  RAISE EXCEPTION 'Minutes spent must be a whole number from 1 to 1,440.';
 END IF;
 IF length(coalesce(_entry->>'output',''))>1000 OR length(coalesce(_entry->>'comments',''))>1000 THEN
  RAISE EXCEPTION 'Notes can be up to 1,000 characters.';
 END IF;
 IF coalesce(_entry->>'phase','') NOT IN ('onboarding','ongoing')
  OR length(coalesce(_entry->>'activityCategory',''))>80 OR length(coalesce(_entry->>'output',''))>1000
  OR length(coalesce(_entry->>'comments',''))>1000 OR length(coalesce(_entry->>'attachmentPath',''))>400 THEN
   RAISE EXCEPTION 'This could not save. Your entry is still here. Please try again, and if it happens again, message your ARHA contact.';
 END IF;
 paths:=coalesce(_entry->'attachmentPaths','[]'::jsonb);
 IF jsonb_typeof(paths) IS DISTINCT FROM 'array' OR jsonb_array_length(paths)>10 THEN
  RAISE EXCEPTION 'Attach at most ten files to one entry.';
 END IF;
 FOR path_item IN SELECT jsonb_array_elements_text(paths) LOOP
  IF path_item IS NULL OR length(trim(path_item)) NOT BETWEEN 1 AND 400 THEN
   RAISE EXCEPTION 'One of the attached files could not be recorded. Try again.';
   END IF;
 END LOOP;
 IF jsonb_array_length(paths)>0 AND nullif(_entry->>'attachmentPath','') IS DISTINCT FROM (paths->>0) THEN
  RAISE EXCEPTION 'The attached files could not be recorded. Try again.';
 END IF;
 IF cardinality(coalesce(_property_ids,'{}'::uuid[]))>25 OR array_position(_property_ids,NULL) IS NOT NULL THEN
  RAISE EXCEPTION 'Choose at most 25 valid properties.';
 END IF;
 SELECT coalesce(array_agg(DISTINCT p ORDER BY p),'{}'::uuid[]) INTO chosen FROM unnest(coalesce(_property_ids,'{}'::uuid[])) p;
 IF manual THEN
   IF nullif(_entry->>'ticketId','') IS NOT NULL THEN
   RAISE EXCEPTION 'A self-recorded activity cannot carry a Ticket link.';
   END IF;
  context_ids:=chosen;
 ELSE
  SELECT * INTO opportunity FROM public.owner_reviews WHERE id=(_entry->>'reviewId')::uuid AND program_id=program.id FOR SHARE NOWAIT;
  IF NOT FOUND OR opportunity.archived_at IS NOT NULL OR opportunity.is_demo IS DISTINCT FROM program.is_demo
   OR coalesce(opportunity.status,'') NOT IN ('awaiting_owner','answered','returned') OR opportunity.available_from>now() OR opportunity.available_from::date>entry_day
   OR opportunity.phase IS DISTINCT FROM (_entry->>'phase') THEN
   RAISE EXCEPTION 'Choose an available participation opportunity from this program.';
   END IF;
  IF opportunity.task_type NOT IN ('property_specific','multi_property','program_wide') OR opportunity.task_type IS NULL THEN
   RAISE EXCEPTION 'This opportunity needs a valid participation scope.';
  END IF;
  IF opportunity.task_type='property_specific' THEN
   IF opportunity.property_id IS NULL THEN RAISE EXCEPTION 'This opportunity needs its canonical Property.'; END IF;
   IF cardinality(chosen)=0 THEN chosen:=ARRAY[opportunity.property_id]; END IF;
   IF chosen IS DISTINCT FROM ARRAY[opportunity.property_id] THEN RAISE EXCEPTION 'That opportunity belongs to a different Property.'; END IF;
  ELSIF opportunity.task_type='multi_property' AND cardinality(chosen)=0 THEN
   RAISE EXCEPTION 'Select the opportunity properties this activity involved.';
   ELSIF opportunity.task_type='program_wide' AND opportunity.property_id IS NOT NULL THEN
   RAISE EXCEPTION 'The program-wide opportunity has conflicting Property context.';
   END IF;
  context_ids:=chosen;
  IF opportunity.property_id IS NOT NULL THEN context_ids:=array_append(context_ids,opportunity.property_id); END IF;
  FOR link IN SELECT r.property_id FROM public.owner_review_properties r WHERE r.review_id=opportunity.id ORDER BY r.property_id FOR SHARE NOWAIT LOOP
   context_ids:=array_append(context_ids,link.property_id);
   IF opportunity.task_type='property_specific' AND link.property_id IS DISTINCT FROM opportunity.property_id THEN
    RAISE EXCEPTION 'The opportunity Property links changed. Ask the team to reconcile them.';
   END IF;
   END LOOP;
  IF opportunity.task_type='multi_property' AND EXISTS(SELECT 1 FROM unnest(chosen) p WHERE NOT EXISTS(
   SELECT 1 FROM public.owner_review_properties r WHERE r.review_id=opportunity.id AND r.property_id=p
  )) THEN RAISE EXCEPTION 'That Property is not assigned to this participation opportunity.'; END IF;
 END IF;
 FOR chosen_property IN SELECT DISTINCT p FROM unnest(context_ids) p ORDER BY p LOOP
  SELECT * INTO enrollment FROM public.owner_program_properties e WHERE e.program_id=program.id AND e.property_id=chosen_property FOR SHARE NOWAIT;
  IF NOT FOUND OR enrollment.inclusion_status IS DISTINCT FROM 'included' OR enrollment.archived_at IS NOT NULL
   OR enrollment.is_demo IS DISTINCT FROM program.is_demo THEN
   RAISE EXCEPTION 'Tag only homes included in this program.';
   END IF;
  SELECT * INTO home FROM public.properties h WHERE h.id=chosen_property FOR SHARE NOWAIT;
  IF NOT FOUND OR home.owner_record_id IS DISTINCT FROM program.owner_record_id OR home.archived_at IS NOT NULL
   OR home.is_demo IS DISTINCT FROM program.is_demo THEN RAISE EXCEPTION 'That Property is no longer available to this Owner.'; END IF;
 END LOOP;
 IF NOT manual THEN
  IF nullif(_entry->>'ticketId','')::uuid IS DISTINCT FROM opportunity.ticket_id THEN
   RAISE EXCEPTION 'Time must retain its participation opportunity Ticket link.';
  END IF;
  IF opportunity.ticket_id IS NOT NULL THEN
    SELECT * INTO ticket FROM public.tickets WHERE id=opportunity.ticket_id FOR SHARE NOWAIT;
   IF NOT FOUND OR ticket.property_id IS DISTINCT FROM opportunity.property_id OR NOT ticket.property_id=ANY(chosen)
    OR ticket.is_demo IS DISTINCT FROM program.is_demo THEN RAISE EXCEPTION 'The opportunity Ticket context changed.'; END IF;
  END IF;
 END IF;
 -- Double save guard (Nov 21): the same homeowner, program, date, minutes and description saved in the
 -- last 10 minutes is already on file.
 IF private.owner_time_recent_repeat(program.id,auth.uid(),entry_day,reported_minutes,trim(_entry->>'activity'),NULL,NULL) AND NOT EXISTS (SELECT 1 FROM public.owner_work_saves s WHERE s.id=nullif(_entry->>'cardSaveKey','')::uuid AND s.program_id=program.id AND s.actor_id=auth.uid() AND s.entry_id IS NULL) THEN
  RAISE EXCEPTION 'Already saved.';
 END IF;
 INSERT INTO public.owner_time_entries(program_id,owner_user_id,phase,entry_date,minutes,activity,activity_category,decision_outcome,output,comments,attachment_path,attachment_paths,review_id,ticket_id,attested,is_demo,owner_update_revision,review_status)
 VALUES(program.id,auth.uid(),_entry->>'phase',entry_day,reported_minutes,trim(_entry->>'activity'),nullif(_entry->>'activityCategory',''),nullif(_entry->>'output',''),nullif(_entry->>'output',''),nullif(_entry->>'comments',''),nullif(_entry->>'attachmentPath',''),paths,opportunity.id,opportunity.ticket_id,true,program.is_demo,
  CASE WHEN manual THEN NULL ELSE nullif(_entry->>'ownerUpdateRevision','')::integer END,'submitted')
 RETURNING id INTO new_id;
 INSERT INTO public.owner_time_entry_properties(entry_id,property_id) SELECT new_id,p FROM unnest(chosen) p;
  UPDATE public.owner_program_properties e SET last_owner_activity_at=now() WHERE e.program_id=program.id AND e.property_id=ANY(chosen);
 UPDATE public.owner_programs SET last_owner_activity_at=now() WHERE id=program.id;
 INSERT INTO public.owner_program_events(program_id,entry_id,review_id,kind,summary,actor_id,new_value,detail)
 VALUES(program.id,new_id,opportunity.id,'time_entry',reported_minutes::text||' minutes reported: '||trim(_entry->>'activity'),auth.uid(),reported_minutes::text,
  jsonb_build_object('propertyIds',to_jsonb(chosen),'phase',_entry->>'phase','category',_entry->>'activityCategory','selfRecorded',manual,'attachmentCount',jsonb_array_length(paths)));
 RETURN new_id;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'The program or opportunity is being updated. Refresh and try again.';
END $function$
;
