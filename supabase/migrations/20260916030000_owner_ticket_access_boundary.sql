-- Owner operational reads use a canonical, current-property projection. Raw
-- Ticket rows remain available only through existing staff/vendor responsibilities.
CREATE FUNCTION private.owner_current_properties(_program_id uuid,_property_ids uuid[],_preview boolean DEFAULT false)
RETURNS TABLE(property_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT h.id FROM public.owner_programs p
 JOIN public.property_owners o ON o.id=p.owner_record_id AND o.active
 JOIN public.owner_program_properties e ON e.program_id=p.id AND e.inclusion_status='included' AND e.archived_at IS NULL AND e.is_demo=p.is_demo
 JOIN public.properties h ON h.id=e.property_id AND h.owner_record_id=o.id AND h.is_demo=p.is_demo AND h.archived_at IS NULL
 WHERE p.id=_program_id AND p.archived_at IS NULL AND h.id=ANY(_property_ids)
 AND cardinality(_property_ids) BETWEEN 1 AND 100 AND auth.uid() IS NOT NULL
 AND ((_preview IS TRUE AND public.has_role(auth.uid(),'admin'))
 OR (_preview IS FALSE AND p.owner_user_id=auth.uid() AND p.is_demo=false));
$$;
REVOKE ALL ON FUNCTION private.owner_current_properties(uuid,uuid[],boolean) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.read_owner_tickets(_program_id uuid,_property_ids uuid[],_preview boolean DEFAULT false)
RETURNS TABLE(id uuid,ref integer,property_id uuid,category text,priority text,status text,
 reported_at timestamptz,resolved_at timestamptz,owner_participation_path text,owner_submitted boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT t.id,t.ref::integer,t.property_id,
 CASE WHEN t.category IN ('maintenance','safety','cleaning','access','guest','owner','vendor','claims','quality','admin','other') THEN t.category ELSE 'other' END,
 CASE WHEN t.priority IN ('p1','p2','p3') THEN t.priority ELSE 'unknown' END,
 CASE WHEN t.status IN ('open','dispatched','in_progress','waiting','awaiting_guest','resolved','closed') THEN t.status ELSE 'unknown' END,
 t.reported_at,t.resolved_at,
 CASE WHEN t.owner_participation_path IN ('inform','consult','approve','emergency') THEN t.owner_participation_path ELSE NULL END,
 t.owner_submitted
 FROM public.tickets t JOIN private.owner_current_properties(_program_id,_property_ids,_preview) h ON h.property_id=t.property_id
 JOIN public.owner_programs p ON p.id=_program_id AND t.is_demo=p.is_demo;
$$;
REVOKE ALL ON FUNCTION public.read_owner_tickets(uuid,uuid[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_owner_tickets(uuid,uuid[],boolean) TO authenticated;

-- Assignment alone cannot turn an owner account into a vendor. The shared helper
-- also protects vendor checklist/activity paths that otherwise bypass Ticket SELECT.
CREATE OR REPLACE FUNCTION private.is_assigned_vendor(_user_id uuid,_ticket_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT coalesce(public.has_role(_user_id,'vendor'),false) AND EXISTS(
  SELECT 1 FROM public.tickets WHERE id=_ticket_id AND vendor_user_id=_user_id
 );
$$;
REVOKE ALL ON FUNCTION private.is_assigned_vendor(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.is_assigned_vendor(uuid,uuid) TO authenticated,service_role;

DROP POLICY "Owners read tickets at their home" ON public.tickets;
DROP POLICY "Owners open matters at their own home" ON public.tickets;
ALTER POLICY tickets_select ON public.tickets USING(
 private.is_staff(auth.uid()) OR private.is_assigned_vendor(auth.uid(),id)
);
ALTER POLICY tickets_update ON public.tickets USING(
 ((private.is_staff(auth.uid()) AND private.can_edit_ticket(auth.uid(),id)) OR private.is_assigned_vendor(auth.uid(),id))
 AND (NOT is_demo OR public.has_role(auth.uid(),'admin'))
) WITH CHECK(
 ((private.is_staff(auth.uid()) AND private.can_edit_ticket(auth.uid(),id)) OR (public.has_role(auth.uid(),'vendor') AND vendor_user_id=auth.uid()))
 AND (NOT is_demo OR public.has_role(auth.uid(),'admin'))
);

-- Owner input cannot assign staff/vendor, change operational state or attach
-- another Owner's property. Ticket creation and its history commit together.
CREATE FUNCTION public.create_owner_matter(_program_id uuid,_property_id uuid,_path text,_title text,_description text,_category text)
RETURNS TABLE(ticket_id uuid,ref integer) LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE program public.owner_programs; new_ticket public.tickets; chosen_owner uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to open property work.'; END IF;
 IF length(trim(coalesce(_title,''))) NOT BETWEEN 4 AND 160 OR length(coalesce(_description,''))>2000
 OR _category IS NULL OR _category NOT IN ('maintenance','cleaning','admin','guest')
 OR _path IS NULL OR _path NOT IN ('inform','consult','approve','emergency') THEN
  RAISE EXCEPTION 'Enter a valid property matter and participation request.';
 END IF;
 SELECT * INTO program FROM public.owner_programs p WHERE p.id=_program_id AND p.owner_user_id=auth.uid() FOR UPDATE NOWAIT;
 IF NOT FOUND OR program.archived_at IS NOT NULL OR program.is_demo OR program.owner_record_id IS NULL
 OR program.status NOT IN ('active','target_reached') OR program.started_on IS NULL THEN
  RAISE EXCEPTION 'An active participation program is required to open property work.';
 END IF;
 PERFORM 1 FROM public.property_owners WHERE id=program.owner_record_id AND active FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'The canonical Owner is not active.'; END IF;
 SELECT owner_record_id INTO chosen_owner FROM public.properties WHERE id=_property_id AND is_demo=false AND archived_at IS NULL FOR SHARE NOWAIT;
 IF NOT FOUND OR chosen_owner IS DISTINCT FROM program.owner_record_id THEN RAISE EXCEPTION 'That home is not currently owned by this program Owner.'; END IF;
 PERFORM 1 FROM public.owner_program_properties WHERE program_id=program.id AND property_id=_property_id
 AND inclusion_status='included' AND archived_at IS NULL AND is_demo=false AND closing_confirmed AND closing_date IS NOT NULL AND closing_date<=current_date FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'That home is not included in your post-closing program.'; END IF;
 INSERT INTO public.tickets(title,description,category,priority,status,record_type,source_channel,initiator_type,
  owner_participation_path,owner_submitted,owner_submitted_by,property_id,created_by,reported_at,is_demo)
 VALUES(trim(_title),nullif(trim(_description),''),_category,CASE WHEN _path='emergency' THEN 'p1' ELSE 'p3' END,
  'open','active_task','owner','owner',_path,true,auth.uid(),_property_id,auth.uid(),now(),false)
 RETURNING * INTO new_ticket;
 INSERT INTO public.owner_program_events(program_id,property_id,kind,summary,actor_id,new_value,detail)
 VALUES(program.id,_property_id,'owner_matter_opened','Homeowner opened property work.',auth.uid(),_path,
  jsonb_build_object('ticketId',new_ticket.id,'ref',new_ticket.ref));
 RETURN QUERY SELECT new_ticket.id,new_ticket.ref::integer;
EXCEPTION WHEN lock_not_available THEN
 RAISE EXCEPTION 'Your program or property is being updated. Refresh and try again.';
END $$;
REVOKE ALL ON FUNCTION public.create_owner_matter(uuid,uuid,text,text,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.create_owner_matter(uuid,uuid,text,text,text,text) TO authenticated;

-- Keep the logging writer invoker-scoped. Only its Ticket validation uses the safe read.
CREATE OR REPLACE FUNCTION public.log_owner_time_entry(_entry jsonb,_property_ids uuid[])
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE program public.owner_programs%ROWTYPE; opportunity public.owner_reviews%ROWTYPE;
 entry_day date; reported_minutes integer; new_id uuid; chosen uuid[]; chosen_property uuid;
BEGIN
 SELECT * INTO program FROM public.owner_programs WHERE id=(_entry->>'programId')::uuid;
 IF NOT FOUND OR auth.uid() IS NULL OR program.owner_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'That participation program is not available to you.'; END IF;
 IF coalesce(program.status,'') NOT IN ('active','target_reached') OR program.started_on IS NULL THEN RAISE EXCEPTION 'Activate this program before logging participation.'; END IF;
 entry_day := (_entry->>'entryDate')::date;
 reported_minutes := (_entry->>'minutes')::integer;
 IF entry_day IS NULL OR entry_day < program.started_on OR entry_day > current_date THEN RAISE EXCEPTION 'Choose a date from the program start through today.'; END IF;
 IF reported_minutes IS NULL OR reported_minutes NOT BETWEEN 1 AND 1440 OR length(trim(coalesce(_entry->>'activity',''))) < 3 OR coalesce(_entry->>'phase','') NOT IN ('onboarding','ongoing') THEN RAISE EXCEPTION 'Enter the actual activity, phase, and minutes.'; END IF;
 SELECT * INTO opportunity FROM public.owner_reviews WHERE id=(_entry->>'reviewId')::uuid AND program_id=program.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'Choose a participation opportunity from this program.'; END IF;
 IF opportunity.status='closed' OR opportunity.available_from > now() THEN RAISE EXCEPTION 'That opportunity is not available.'; END IF;
 SELECT coalesce(array_agg(DISTINCT p),'{}'::uuid[]) INTO chosen FROM unnest(coalesce(_property_ids,'{}'::uuid[])) p;
 IF cardinality(chosen)=0 AND opportunity.task_type IS DISTINCT FROM 'multi_property' AND opportunity.property_id IS NOT NULL THEN chosen := ARRAY[opportunity.property_id]; END IF;
 IF opportunity.task_type='multi_property' AND cardinality(chosen)=0 THEN RAISE EXCEPTION 'Select the opportunity properties this activity involved.'; END IF;
 FOREACH chosen_property IN ARRAY chosen LOOP
  IF chosen_property IS NULL OR (opportunity.task_type IS DISTINCT FROM 'multi_property' AND opportunity.property_id IS NOT NULL AND chosen_property IS DISTINCT FROM opportunity.property_id) THEN RAISE EXCEPTION 'That opportunity belongs to a different property.'; END IF;
  IF opportunity.task_type='multi_property' AND NOT EXISTS(SELECT 1 FROM public.owner_review_properties r WHERE r.review_id=opportunity.id AND r.property_id=chosen_property) THEN RAISE EXCEPTION 'That property is not assigned to this participation opportunity.'; END IF;
  IF NOT EXISTS(SELECT 1 FROM public.owner_program_properties l WHERE l.program_id=program.id AND l.property_id=chosen_property AND l.inclusion_status='included' AND l.closing_date IS NOT NULL AND l.closing_date<=entry_day) THEN RAISE EXCEPTION 'Participation requires an enrolled property and a post-closing date.'; END IF;
 END LOOP;
 IF nullif(_entry->>'ticketId','')::uuid IS DISTINCT FROM opportunity.ticket_id THEN RAISE EXCEPTION 'Time must retain its participation opportunity Ticket link.'; END IF;
 IF nullif(_entry->>'ticketId','') IS NOT NULL AND NOT EXISTS(
  SELECT 1 FROM public.read_owner_tickets(program.id,chosen,false) t WHERE t.id=(_entry->>'ticketId')::uuid AND t.property_id=ANY(chosen)
 ) THEN RAISE EXCEPTION 'Choose a visible ticket from one of the selected properties.'; END IF;
 INSERT INTO public.owner_time_entries(program_id,owner_user_id,phase,entry_date,minutes,activity,activity_category,decision_outcome,output,comments,attachment_path,review_id,ticket_id,attested,is_demo,owner_update_revision)
 VALUES(program.id,auth.uid(),_entry->>'phase',entry_day,reported_minutes,trim(_entry->>'activity'),nullif(_entry->>'activityCategory',''),nullif(_entry->>'output',''),nullif(_entry->>'output',''),nullif(_entry->>'comments',''),nullif(_entry->>'attachmentPath',''),opportunity.id,nullif(_entry->>'ticketId','')::uuid,true,program.is_demo,nullif(_entry->>'ownerUpdateRevision','')::integer)
 RETURNING id INTO new_id;
 INSERT INTO public.owner_time_entry_properties(entry_id,property_id) SELECT new_id,p FROM unnest(chosen) p;
 INSERT INTO public.owner_program_events(program_id,entry_id,review_id,kind,summary,actor_id,new_value,detail)
 VALUES(program.id,new_id,opportunity.id,'time_entry',reported_minutes::text || ' minutes reported: ' || trim(_entry->>'activity'),auth.uid(),reported_minutes::text,
 jsonb_build_object('propertyIds',to_jsonb(chosen),'phase',_entry->>'phase','category',_entry->>'activityCategory'));
 RETURN new_id;
END $$;
