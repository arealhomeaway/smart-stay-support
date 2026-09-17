-- Current opportunities and retained participation are separate read boundaries.
CREATE FUNCTION private.owner_review_readable(_actor uuid,_review_id uuid,_preview boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(SELECT 1 FROM owner_reviews r JOIN owner_programs p ON p.id=r.program_id
 WHERE r.id=_review_id AND private.owner_program_readable(_actor,p.id,_preview)
 AND r.archived_at IS NULL AND r.is_demo=p.is_demo
 AND r.status IN('awaiting_owner','returned','answered','closed')
 AND (r.available_from IS NULL OR r.available_from<=now())
 AND (r.property_id IS NULL OR EXISTS(SELECT 1 FROM private.owner_current_properties(p.id,ARRAY[r.property_id],_preview)))
 AND NOT EXISTS(SELECT 1 FROM owner_review_properties l WHERE l.review_id=r.id AND NOT EXISTS(
  SELECT 1 FROM private.owner_current_properties(p.id,ARRAY[l.property_id],_preview)))
 AND (r.task_type='program_wide' OR r.property_id IS NOT NULL OR EXISTS(SELECT 1 FROM owner_review_properties l WHERE l.review_id=r.id))
 AND (r.ticket_id IS NULL OR EXISTS(SELECT 1 FROM tickets t WHERE t.id=r.ticket_id AND t.is_demo=p.is_demo
  AND EXISTS(SELECT 1 FROM private.owner_current_properties(p.id,ARRAY[t.property_id],_preview))
  AND (r.property_id=t.property_id OR EXISTS(SELECT 1 FROM owner_review_properties l WHERE l.review_id=r.id AND l.property_id=t.property_id))))
 )
$$;
REVOKE ALL ON FUNCTION private.owner_review_readable(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.owner_safe_reviewed_snapshot(_snapshot jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE SET search_path=public AS $$
 SELECT CASE WHEN jsonb_typeof(_snapshot)='object' THEN jsonb_build_object(
  'revision',_snapshot->'revision','issue',_snapshot->'issue','work_performed',_snapshot->'work_performed',
  'outcome',_snapshot->'outcome','reviewed_at',_snapshot->'reviewed_at',
  'owner_request_type',_snapshot->'owner_request_type','owner_request_why',_snapshot->'owner_request_why') ELSE NULL END
$$;
REVOKE ALL ON FUNCTION private.owner_safe_reviewed_snapshot(jsonb) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.read_owner_participation(_section text,_program_id uuid DEFAULT NULL,_preview boolean DEFAULT false,_record_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid,item jsonb) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
 IF _section NOT IN('reviews','entries','badges','events','alerts') OR _section IS NULL THEN RAISE EXCEPTION 'Choose a valid participation record section.'; END IF;
 IF (_program_id IS NULL AND _record_id IS NULL) OR (_preview IS TRUE AND _program_id IS NULL) THEN
  RAISE EXCEPTION 'Choose an explicit participation program or record.';
 END IF;
 IF _section='reviews' THEN
  RETURN QUERY SELECT r.id,jsonb_build_object('id',to_jsonb(r)->'id','program_id',to_jsonb(r)->'program_id','phase',to_jsonb(r)->'phase','stage',to_jsonb(r)->'stage','task_type',to_jsonb(r)->'task_type','decision_path',to_jsonb(r)->'decision_path','respond_by',to_jsonb(r)->'respond_by','status',to_jsonb(r)->'status','owner_decision',to_jsonb(r)->'owner_decision','owner_response',to_jsonb(r)->'owner_response','responded_at',to_jsonb(r)->'responded_at','ticket_id',to_jsonb(r)->'ticket_id','property_id',to_jsonb(r)->'property_id','sort_order',to_jsonb(r)->'sort_order','source_type',to_jsonb(r)->'source_type','onboarding_task_id',to_jsonb(r)->'onboarding_task_id','owner_action_type',to_jsonb(r)->'owner_action_type','available_from',to_jsonb(r)->'available_from','closed_at',to_jsonb(r)->'closed_at','updated_at',to_jsonb(r)->'updated_at','auto_ticket',to_jsonb(r)->'auto_ticket',
   'title',CASE WHEN r.auto_ticket THEN 'Property work to review' ELSE r.title END,
   'recommendation',CASE WHEN r.auto_ticket THEN NULL ELSE r.recommendation END,
   'business_question',CASE WHEN r.auto_ticket THEN NULL ELSE r.business_question END,
   'evidence',CASE WHEN r.auto_ticket THEN NULL ELSE r.evidence END,
   'impact',CASE WHEN r.auto_ticket THEN NULL ELSE r.impact END,
   'outcome',CASE WHEN r.auto_ticket THEN NULL ELSE r.outcome END,
   'attachment_path',CASE WHEN r.auto_ticket THEN NULL ELSE r.attachment_path END,
   'photos',CASE WHEN r.auto_ticket THEN '[]'::jsonb ELSE coalesce(r.photos,'[]'::jsonb) END,
   'property_ids',coalesce((SELECT jsonb_agg(l.property_id ORDER BY l.property_id) FROM owner_review_properties l WHERE l.review_id=r.id),
     CASE WHEN r.property_id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(r.property_id) END))
  FROM owner_reviews r WHERE (_program_id IS NULL OR r.program_id=_program_id) AND (_record_id IS NULL OR r.id=_record_id)
   AND private.owner_review_readable(auth.uid(),r.id,_preview);
 ELSIF _section='entries' THEN
  RETURN QUERY SELECT e.id,jsonb_build_object('id',to_jsonb(e)->'id','program_id',to_jsonb(e)->'program_id','owner_user_id',to_jsonb(e)->'owner_user_id','phase',to_jsonb(e)->'phase','entry_date',to_jsonb(e)->'entry_date','minutes',to_jsonb(e)->'minutes','activity',to_jsonb(e)->'activity','activity_category',to_jsonb(e)->'activity_category','decision_outcome',to_jsonb(e)->'decision_outcome','output',to_jsonb(e)->'output','comments',to_jsonb(e)->'comments','attachment_path',to_jsonb(e)->'attachment_path','review_id',to_jsonb(e)->'review_id','ticket_id',to_jsonb(e)->'ticket_id','owner_update_revision',to_jsonb(e)->'owner_update_revision','amends_entry_id',to_jsonb(e)->'amends_entry_id','correction_reason',to_jsonb(e)->'correction_reason','review_status',to_jsonb(e)->'review_status','reviewed_at',to_jsonb(e)->'reviewed_at','review_note',to_jsonb(e)->'review_note','attested',to_jsonb(e)->'attested','flagged',to_jsonb(e)->'flagged','created_at',to_jsonb(e)->'created_at',
   'reviewed_by',NULL,'owner_update_snapshot',private.owner_safe_reviewed_snapshot(e.owner_update_snapshot),
   'property_ids',coalesce((SELECT jsonb_agg(l.property_id ORDER BY l.property_id) FROM owner_time_entry_properties l WHERE l.entry_id=e.id),'[]'::jsonb))
  FROM owner_time_entries e JOIN owner_programs p ON p.id=e.program_id
  WHERE (_program_id IS NULL OR e.program_id=_program_id) AND (_record_id IS NULL OR e.id=_record_id)
   AND private.owner_program_readable(auth.uid(),p.id,_preview) AND e.is_demo=p.is_demo
   AND e.owner_user_id=p.owner_user_id;
 ELSIF _section='badges' THEN
  RETURN QUERY SELECT b.id,jsonb_build_object('code',b.code,'awarded_at',b.awarded_at,
   'trigger_rule',CASE WHEN b.needs_review THEN 'ARHA is reviewing this achievement.' ELSE 'Recorded participation achievement.' END,'needs_review',b.needs_review)
  FROM owner_badges b WHERE (_program_id IS NULL OR b.program_id=_program_id) AND (_record_id IS NULL OR b.id=_record_id)
   AND private.owner_program_readable(auth.uid(),b.program_id,_preview);
 ELSIF _section='events' THEN
  RETURN QUERY SELECT e.id,jsonb_build_object('id',e.id,'kind',e.kind,'created_at',e.created_at,
   'review_id',CASE WHEN e.kind IN('owner_participation_response','owner_decision') THEN e.review_id ELSE NULL END,
   'detail',CASE WHEN e.kind IN('owner_participation_response','owner_decision') THEN jsonb_build_object(
    'response',e.detail->'response','propertyId',e.detail->'propertyId','ticketId',e.detail->'ticketId',
    'ownerUpdate',private.owner_safe_reviewed_snapshot(e.detail->'ownerUpdate')) ELSE '{}'::jsonb END)
  FROM owner_program_events e WHERE (_program_id IS NULL OR e.program_id=_program_id) AND (_record_id IS NULL OR e.id=_record_id)
   AND e.kind IN('owner_participation_response','owner_decision','program_created','program_updated','program_activated','program_completed','time_entry_reviewed')
   AND private.owner_program_readable(auth.uid(),e.program_id,_preview);
 ELSE
  RETURN QUERY SELECT n.id,jsonb_build_object('id',n.id,'kind',CASE WHEN n.kind IN(
   'ticket_p1','ticket_opened','ticket_resolved','review_ready','progress_celebration','progress_pace','progress_quiet','progress_milestone','progress_deadline')
    THEN n.kind ELSE 'program_update' END,
   'priority',CASE WHEN n.priority IN('p1','p2','p3','p4') THEN n.priority ELSE 'p3' END,
   'ticket_id',n.ticket_id,'review_id',n.review_id,'read_at',n.read_at,'created_at',n.created_at,
   'title',CASE n.kind WHEN 'ticket_p1' THEN 'Urgent property work update' WHEN 'ticket_resolved' THEN 'Property work marked resolved'
    WHEN 'review_ready' THEN 'Participation opportunity ready' WHEN 'progress_celebration' THEN 'Participation milestone recorded'
    WHEN 'progress_pace' THEN 'Review your participation pace' WHEN 'progress_quiet' THEN 'Review your available activities'
    WHEN 'progress_milestone' THEN 'A participation milestone is approaching' WHEN 'progress_deadline' THEN 'Your program closing date is approaching'
    ELSE 'Your participation program has an update' END,
   'body','Open your owner portal to review the current details and any action required. Record only time you actually spend participating.')
  FROM owner_notifications n JOIN owner_programs p ON p.id=n.program_id
  WHERE (_program_id IS NULL OR n.program_id=_program_id) AND (_record_id IS NULL OR n.id=_record_id)
   AND private.owner_program_readable(auth.uid(),p.id,_preview) AND n.owner_user_id=p.owner_user_id
   AND (n.review_id IS NULL OR EXISTS(SELECT 1 FROM owner_reviews r WHERE r.id=n.review_id AND r.program_id=p.id AND private.owner_review_readable(auth.uid(),r.id,_preview)))
   AND (n.ticket_id IS NULL OR EXISTS(SELECT 1 FROM tickets t WHERE t.id=n.ticket_id AND t.is_demo=p.is_demo
     AND EXISTS(SELECT 1 FROM private.owner_current_properties(p.id,ARRAY[t.property_id],_preview))));
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.read_owner_participation(text,uuid,boolean,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_owner_participation(text,uuid,boolean,uuid) TO authenticated;

CREATE FUNCTION public.mark_owner_alerts_read(_ids uuid[]) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE affected integer;
BEGIN
 IF _ids IS NULL OR cardinality(_ids)>100 OR array_position(_ids,NULL) IS NOT NULL THEN RAISE EXCEPTION 'Choose up to 100 valid notifications.'; END IF;
 PERFORM p.id FROM owner_programs p WHERE private.owner_program_readable(auth.uid(),p.id,false) AND p.id IN(SELECT n.program_id FROM owner_notifications n WHERE n.id=ANY(_ids)) ORDER BY p.id FOR UPDATE NOWAIT;
 PERFORM 1 FROM auth.users WHERE auth.users.id=auth.uid() FOR SHARE NOWAIT;
 PERFORM 1 FROM user_roles WHERE user_id=auth.uid() FOR SHARE NOWAIT;
 UPDATE owner_notifications n SET read_at=now() WHERE n.id=ANY(_ids) AND n.read_at IS NULL
  AND EXISTS(SELECT 1 FROM public.read_owner_participation('alerts',n.program_id,false,n.id));
 GET DIAGNOSTICS affected=ROW_COUNT; RETURN affected;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'The program is being updated. Refresh and try again.';
END $$;
REVOKE ALL ON FUNCTION public.mark_owner_alerts_read(uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.mark_owner_alerts_read(uuid[]) TO authenticated;

-- Owners use reviewed approval/opportunity projections, never raw task narratives.
ALTER POLICY "Staff read onboarding tasks" ON public.onboarding_tasks USING(private.is_staff(auth.uid()));
DROP POLICY "Owners read their own reviews" ON owner_reviews;
DROP POLICY "Owners read their program properties" ON owner_program_properties;
DROP POLICY "Owners read their own time entries" ON owner_time_entries;
DROP POLICY "Owners read their entry properties" ON owner_time_entry_properties;
DROP POLICY "Owners read their review properties" ON owner_review_properties;
DROP POLICY "Owners read their badges" ON owner_badges;
DROP POLICY "Owners read their program history" ON owner_program_events;
ALTER POLICY "Signed-in users append program history" ON owner_program_events WITH CHECK(public.is_staff(auth.uid()));
ALTER POLICY "Owners read their own alerts" ON owner_notifications USING(public.is_staff(auth.uid()));
DROP POLICY "Owners mark their own alerts read" ON owner_notifications;


-- All time writers share the same enabled-account and role lock.
CREATE OR REPLACE FUNCTION private.lock_owner_time_program(_program_id uuid,_actor_id uuid,_staff boolean,_new_activity boolean)
RETURNS public.owner_programs LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE program public.owner_programs;
BEGIN
 SELECT * INTO program FROM public.owner_programs WHERE id=_program_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR _actor_id IS NULL OR program.archived_at IS NOT NULL OR program.completed_at IS NOT NULL
  OR program.started_on IS NULL OR NOT isfinite(program.started_on)
  OR (_new_activity AND coalesce(program.status,'') NOT IN ('active','target_reached'))
  OR (NOT _new_activity AND coalesce(program.status,'') NOT IN ('active','target_reached','paused')) THEN
  RAISE EXCEPTION 'This program is not open for this participation change.';
 END IF;
 PERFORM 1 FROM auth.users WHERE id=_actor_id AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now()) FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'An enabled account is required for participation changes.'; END IF;
 PERFORM 1 FROM public.user_roles WHERE user_id=_actor_id FOR SHARE NOWAIT;
 IF _staff THEN
  IF NOT (coalesce(public.has_role(_actor_id,'admin'),false) OR coalesce(public.has_role(_actor_id,'manager'),false))
   OR (program.is_demo AND NOT coalesce(public.has_role(_actor_id,'admin'),false)) THEN
   RAISE EXCEPTION 'Only an authorized supervisor can review or correct participation.';
  END IF;
 ELSE
  PERFORM 1 FROM public.user_roles WHERE user_id=_actor_id FOR SHARE NOWAIT;
  IF program.owner_user_id IS DISTINCT FROM _actor_id OR program.is_demo
   OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor_id AND role::text='owner')
   OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor_id AND role::text<>'owner') THEN
   RAISE EXCEPTION 'That participation program is not available to you.';
  END IF;
 END IF;
 PERFORM 1 FROM public.property_owners WHERE id=program.owner_record_id AND active FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'Participation requires an active canonical Owner.'; END IF;
 RETURN program;
END $$;

CREATE OR REPLACE FUNCTION public.create_owner_matter(_program_id uuid,_property_id uuid,_path text,_title text,_description text,_category text)
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
 PERFORM 1 FROM auth.users WHERE id=auth.uid() FOR SHARE NOWAIT;
 PERFORM 1 FROM public.user_roles WHERE user_id=auth.uid() FOR SHARE NOWAIT;
 IF NOT private.owner_program_readable(auth.uid(),program.id,false) THEN RAISE EXCEPTION 'An enabled owner account is required to open property work.'; END IF;
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

CREATE OR REPLACE FUNCTION public.read_owner_review_update(_review_id uuid,_revision integer)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.owner_reviews; p public.owner_programs; u public.ticket_owner_updates;
BEGIN
 SELECT * INTO r FROM public.owner_reviews WHERE id=_review_id;
 SELECT * INTO p FROM public.owner_programs WHERE id=r.program_id FOR UPDATE NOWAIT;
 IF p.id IS NULL OR auth.uid() IS NULL OR p.owner_user_id IS DISTINCT FROM auth.uid() OR p.is_demo IS DISTINCT FROM false
  OR p.archived_at IS NOT NULL OR p.status IN ('closed','completed') OR r.is_demo IS DISTINCT FROM p.is_demo THEN
  RAISE EXCEPTION 'This reviewed opportunity is not available.';
 END IF;
 PERFORM 1 FROM auth.users WHERE id=auth.uid() FOR SHARE NOWAIT;
 PERFORM 1 FROM public.user_roles WHERE user_id=auth.uid() FOR SHARE NOWAIT;
 IF NOT private.owner_program_readable(auth.uid(),p.id,false) THEN RAISE EXCEPTION 'This reviewed opportunity is not available.'; END IF;
 SELECT * INTO r FROM public.owner_reviews WHERE id=_review_id AND program_id=p.id FOR UPDATE NOWAIT;
 IF NOT FOUND OR r.is_demo IS DISTINCT FROM p.is_demo THEN RAISE EXCEPTION 'This reviewed opportunity changed.'; END IF;
 PERFORM 1 FROM public.property_owners WHERE id=p.owner_record_id AND active FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'This program needs an active canonical Owner.'; END IF;
 -- Scope edits serialize on the same program/review before a response receipt.
 PERFORM 1 FROM owner_review_properties l WHERE l.review_id=r.id ORDER BY l.property_id FOR SHARE NOWAIT;
 PERFORM 1 FROM properties h WHERE h.id=r.property_id OR EXISTS(SELECT 1 FROM owner_review_properties l WHERE l.review_id=r.id AND l.property_id=h.id) ORDER BY h.id FOR SHARE NOWAIT;
 PERFORM 1 FROM owner_program_properties e WHERE e.program_id=p.id ORDER BY e.property_id FOR SHARE NOWAIT;
 IF NOT private.owner_review_readable(auth.uid(),r.id,false) THEN RAISE EXCEPTION 'The opportunity Property scope is no longer available.'; END IF;
 IF r.ticket_id IS NULL THEN
  IF _revision IS NOT NULL THEN RAISE EXCEPTION 'This opportunity has no Ticket update.'; END IF;
  RETURN NULL;
 END IF;
 PERFORM 1 FROM public.tickets t
 JOIN public.properties h ON h.id=t.property_id AND h.id=r.property_id AND h.owner_record_id=p.owner_record_id AND h.is_demo=false AND h.archived_at IS NULL
 JOIN public.property_owners o ON o.id=h.owner_record_id AND o.active
 JOIN public.owner_program_properties e ON e.property_id=h.id AND e.program_id=p.id AND e.inclusion_status='included' AND e.archived_at IS NULL AND e.is_demo=p.is_demo
 WHERE t.id=r.ticket_id AND t.is_demo=false FOR SHARE OF t,h,o,e NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'The Ticket Property is no longer included for this Owner.'; END IF;
 -- NULL explicitly means no reviewed narrative was displayed; do not invent a latest revision.
 IF _revision IS NULL THEN RETURN NULL; END IF;
 SELECT * INTO u FROM public.ticket_owner_updates WHERE ticket_id=r.ticket_id AND property_id=r.property_id
  AND owner_record_id=p.owner_record_id AND revision=_revision AND is_demo=false;
 IF NOT FOUND THEN RAISE EXCEPTION 'The reviewed Ticket revision is not available.'; END IF;
 RETURN jsonb_build_object('revision',u.revision,'issue',u.issue,'work_performed',u.work_performed,'outcome',u.outcome,'reviewed_at',u.reviewed_at,'owner_request_type',u.owner_request_type,'owner_request_why',u.owner_request_why);
EXCEPTION WHEN lock_not_available THEN
 RAISE EXCEPTION 'This opportunity is being updated. Review current information and try your response again.';
END $$;

CREATE FUNCTION private.lock_owner_review_property_scope() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE old_review uuid; new_review uuid;
BEGIN
 IF TG_OP<>'INSERT' THEN old_review:=OLD.review_id; END IF;
 IF TG_OP<>'DELETE' THEN new_review:=NEW.review_id; END IF;
 PERFORM p.id FROM owner_programs p WHERE p.id IN(SELECT r.program_id FROM owner_reviews r WHERE r.id IN(old_review,new_review)) ORDER BY p.id FOR UPDATE NOWAIT;
 PERFORM r.id FROM owner_reviews r WHERE r.id IN(old_review,new_review) ORDER BY r.id FOR UPDATE NOWAIT;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'The opportunity is being updated. Refresh and try again.';
END $$;
REVOKE ALL ON FUNCTION private.lock_owner_review_property_scope() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER lock_owner_review_property_scope BEFORE INSERT OR UPDATE OR DELETE ON owner_review_properties FOR EACH ROW EXECUTE FUNCTION private.lock_owner_review_property_scope();

-- A former staff recipient cannot retain private staff notifications after role revocation.
CREATE FUNCTION private.enabled_staff_notification_recipient(_user_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT _user_id=auth.uid() AND private.is_staff(_user_id) AND EXISTS(SELECT 1 FROM auth.users a WHERE a.id=_user_id AND a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until<=now()))
$$;
REVOKE ALL ON FUNCTION private.enabled_staff_notification_recipient(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.enabled_staff_notification_recipient(uuid) TO authenticated;
ALTER POLICY "Recipients read their own notifications" ON public.staff_notifications USING(private.enabled_staff_notification_recipient(user_id));
ALTER POLICY "Recipients mark their own notifications read" ON public.staff_notifications USING(private.enabled_staff_notification_recipient(user_id)) WITH CHECK(private.enabled_staff_notification_recipient(user_id));
