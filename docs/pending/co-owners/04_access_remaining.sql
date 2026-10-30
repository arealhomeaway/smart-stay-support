-- PENDING ONLY. Pass 3A remaining owner access gates. Apply after 01 and 03, only with audited provisioning.
-- Only the owner comparison changes (plus the approved first-answer guard in respond_owner_opportunity).
-- CREATE OR REPLACE preserves owner, ACL, search_path and SECURITY settings.

BEGIN;

CREATE OR REPLACE FUNCTION public.mark_owner_opportunity_viewed(_id uuid)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  UPDATE work_items w SET viewed_at=now() WHERE w.id=_id AND w.kind='opportunity' AND w.status<>'draft' AND w.viewed_at IS NULL
    AND EXISTS (SELECT 1 FROM owner_programs p WHERE p.id=w.program_id AND private.is_program_member(p.id,auth.uid()));
$function$;

CREATE OR REPLACE FUNCTION public.owner_hours_eligibility(_program_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p public.owner_programs;
BEGIN
 SELECT * INTO p FROM owner_programs WHERE id=_program_id;
 IF NOT FOUND OR NOT (private.is_program_member(p.id,auth.uid()) OR coalesce(public.is_internal_staff(auth.uid()),false)) THEN
  RETURN jsonb_build_object('eligible',false,'reason','unavailable');
 END IF;
 IF p.archived_at IS NOT NULL OR p.completed_at IS NOT NULL OR p.status IN ('paused','closed','completed','complete') THEN
  RETURN jsonb_build_object('eligible',false,'reason',CASE WHEN p.status='paused' THEN 'paused' ELSE 'closed' END);
 END IF;
 IF p.status NOT IN ('draft','active','target_reached') OR NOT EXISTS(SELECT 1 FROM property_owners WHERE id=p.owner_record_id AND active)
 OR NOT EXISTS(SELECT 1 FROM owner_program_properties e JOIN properties h ON h.id=e.property_id
   WHERE e.program_id=p.id AND e.inclusion_status='included' AND e.archived_at IS NULL
   AND h.archived_at IS NULL AND h.owner_record_id=p.owner_record_id AND e.is_demo=p.is_demo AND h.is_demo=p.is_demo) THEN
  RETURN jsonb_build_object('eligible',false,'reason','unavailable');
 END IF;
 RETURN jsonb_build_object('eligible',true);
END $function$;

CREATE OR REPLACE FUNCTION public.tag_owner_upload(_document_id uuid, _owner_category text, _work_item_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE d public.documents;
BEGIN
  SELECT * INTO d FROM documents WHERE id = _document_id AND uploaded_by = auth.uid() AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'This file is not yours to update.'; END IF;
  IF _work_item_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM work_items w JOIN owner_programs p ON p.id = w.program_id
     WHERE w.id = _work_item_id AND w.kind = 'opportunity' AND w.property_id = d.property_id
       AND (private.is_program_member(p.id, auth.uid()) OR is_staff(auth.uid()) OR is_onboarding_staff(auth.uid()))) THEN
    RAISE EXCEPTION 'That Opportunity belongs to a different home.';
  END IF;
  UPDATE documents SET owner_category = _owner_category, work_item_id = _work_item_id WHERE id = _document_id;
END $function$;

CREATE OR REPLACE FUNCTION public.respond_owner_review(_review_id uuid, _expected_updated_at timestamp with time zone, _decision text, _response text, _owner_update_revision integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE review public.owner_reviews; program public.owner_programs; snapshot jsonb;
BEGIN
 -- Scope validation locks program then review before any response write.
 snapshot:=public.read_owner_review_update(_review_id,_owner_update_revision);
 SELECT p.* INTO program FROM public.owner_programs p JOIN public.owner_reviews r ON r.program_id=p.id WHERE r.id=_review_id;
 IF NOT FOUND OR auth.uid() IS NULL OR NOT coalesce(private.is_program_member(program.id,auth.uid()),false) OR program.archived_at IS NOT NULL OR program.status IN ('closed','completed') THEN
  RAISE EXCEPTION 'This participation program is not available for your response.';
 END IF;
 SELECT * INTO review FROM public.owner_reviews WHERE id=_review_id AND program_id=program.id FOR UPDATE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'This opportunity is not available.'; END IF;
 IF _expected_updated_at IS NULL OR review.updated_at IS DISTINCT FROM _expected_updated_at THEN RAISE EXCEPTION 'The opportunity changed. Refresh before responding.'; END IF;
 IF review.status NOT IN ('awaiting_owner','returned') OR review.available_from>now() THEN RAISE EXCEPTION 'This opportunity is not currently awaiting your response.'; END IF;
 IF length(trim(coalesce(_decision,''))) NOT BETWEEN 1 AND 60 OR length(coalesce(_response,''))>2000 THEN RAISE EXCEPTION 'Enter a valid response.'; END IF;
 IF review.auto_ticket AND _decision<>'acknowledged' THEN RAISE EXCEPTION 'Use the canonical approval request; this response records participation only.'; END IF;

 UPDATE public.owner_reviews SET owner_decision=_decision,owner_response=nullif(_response,''),
  status=CASE WHEN auto_ticket THEN status ELSE 'answered' END,responded_at=now(),updated_at=clock_timestamp() WHERE id=review.id;
 INSERT INTO public.owner_program_events(program_id,review_id,kind,summary,actor_id,previous_value,new_value,detail)
 VALUES(review.program_id,review.id,CASE WHEN review.auto_ticket THEN 'owner_participation_response' ELSE 'owner_decision' END,
  CASE WHEN review.auto_ticket THEN 'Participation response recorded for property work; no repair approval granted.' ELSE 'Owner response recorded for participation opportunity.' END,
  auth.uid(),review.owner_decision,_decision,jsonb_build_object('previousResponse',review.owner_response,'response',nullif(_response,''),'ownerUpdate',snapshot,'propertyId',review.property_id,'ticketId',review.ticket_id));
 RETURN review.id;
END $function$;

CREATE OR REPLACE FUNCTION private.lock_owner_time_program(_program_id uuid, _actor_id uuid, _staff boolean, _new_activity boolean)
 RETURNS owner_programs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE program public.owner_programs; arrived boolean;
BEGIN
 SELECT * INTO program FROM public.owner_programs WHERE id=_program_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR _actor_id IS NULL OR program.archived_at IS NOT NULL OR program.completed_at IS NOT NULL THEN
  RAISE EXCEPTION 'This program is not open for this participation change.';
 END IF;
 SELECT EXISTS(SELECT 1 FROM public.owner_program_properties e WHERE e.program_id=program.id AND e.inclusion_status='included'
   AND e.archived_at IS NULL AND e.is_demo=program.is_demo AND e.closing_confirmed AND e.closing_date IS NOT NULL
   AND e.closing_date<=private.business_today()) INTO arrived;
 IF _new_activity AND NOT _staff THEN
  IF coalesce(program.status,'') NOT IN ('draft','active','target_reached') THEN
   RAISE EXCEPTION 'This program is not open for this participation change.';
 END IF;

 ELSIF (program.started_on IS NULL OR NOT isfinite(program.started_on)) AND NOT (program.status='draft' AND arrived)
  OR (_new_activity AND coalesce(program.status,'') NOT IN ('active','target_reached','draft'))
  OR (NOT _new_activity AND coalesce(program.status,'') NOT IN ('active','target_reached','paused','draft')) THEN
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
  IF NOT coalesce(private.is_program_member(program.id,_actor_id),false)
   OR (program.is_demo AND NOT (_actor_id=auth.uid() AND private.is_synthetic_account()
        AND coalesce(private.demo_owner_link_ok(_actor_id, program.id),false)))
   OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor_id AND role::text='owner')
   OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor_id AND role::text<>'owner') THEN
    RAISE EXCEPTION 'That participation program is not available to you.';
  END IF;
 END IF;
 PERFORM 1 FROM public.property_owners WHERE id=program.owner_record_id AND active FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'Participation requires an active canonical Owner.'; END IF;
 RETURN program;
END $function$;

CREATE OR REPLACE FUNCTION public.read_owner_participation(_section text, _program_id uuid DEFAULT NULL::uuid, _preview boolean DEFAULT false, _record_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, item jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
   AND (e.owner_user_id=p.owner_user_id OR EXISTS(SELECT 1 FROM public.program_members m WHERE m.program_id=p.id AND m.user_id=e.owner_user_id));
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
   'ticket_p1','ticket_opened','ticket_resolved','review_ready','progress_celebration','progress_pace','progress_quiet','progress_milestone','progress_deadline','opportunity_sent')
    THEN n.kind ELSE 'program_update' END,
   'priority',CASE WHEN n.priority IN('p1','p2','p3','p4') THEN n.priority ELSE 'p3' END,
   'ticket_id',n.ticket_id,'review_id',n.review_id,'read_at',n.read_at,'created_at',n.created_at,
   'title',CASE n.kind WHEN 'ticket_p1' THEN 'Urgent property work update' WHEN 'ticket_resolved' THEN 'Property work marked resolved'
    WHEN 'review_ready' THEN 'Participation opportunity ready' WHEN 'progress_celebration' THEN 'Participation milestone recorded'
    WHEN 'progress_pace' THEN 'Review your participation pace' WHEN 'progress_quiet' THEN 'Review your available activities'
    WHEN 'progress_milestone' THEN 'A participation milestone is approaching' WHEN 'progress_deadline' THEN 'Your program closing date is approaching' WHEN 'opportunity_sent' THEN 'New Opportunity from Your ARHA Team'
    ELSE 'Your participation program has an update' END,
   'body',CASE WHEN n.kind='opportunity_sent' THEN n.body ELSE 'Open your owner portal to review the current details and any action required. Record only time you actually spend participating.' END,'action_path',CASE WHEN n.kind='opportunity_sent' THEN n.action_path END)
  FROM owner_notifications n JOIN owner_programs p ON p.id=n.program_id
  WHERE (_program_id IS NULL OR n.program_id=_program_id) AND (_record_id IS NULL OR n.id=_record_id)
   AND private.owner_program_readable(auth.uid(),p.id,_preview) AND n.owner_user_id=p.owner_user_id
   AND (n.review_id IS NULL OR EXISTS(SELECT 1 FROM owner_reviews r WHERE r.id=n.review_id AND r.program_id=p.id AND private.owner_review_readable(auth.uid(),r.id,_preview)))
   AND (n.ticket_id IS NULL OR EXISTS(SELECT 1 FROM tickets t WHERE t.id=n.ticket_id AND t.is_demo=p.is_demo
     AND EXISTS(SELECT 1 FROM private.owner_current_properties(p.id,ARRAY[t.property_id],_preview))));
 END IF;
END $function$;

CREATE OR REPLACE FUNCTION public.can_view_owner_library_video(_library_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN NOT EXISTS (SELECT 1 FROM public.owner_opportunity_library l WHERE l.id = _library_id) THEN false
    WHEN public.is_internal_staff(auth.uid()) THEN true
    WHEN public.has_role(auth.uid(), 'vendor'::app_role) THEN false
    ELSE (
      EXISTS (SELECT 1 FROM public.owner_programs p WHERE private.is_program_member(p.id, auth.uid()) AND p.status = 'active')
      AND EXISTS (SELECT 1 FROM public.owner_opportunity_library l WHERE l.id = _library_id AND l.active)
    ) OR EXISTS (
      SELECT 1 FROM public.work_items w JOIN public.owner_programs p ON p.id = w.program_id
      WHERE w.library_template_id = _library_id AND w.kind = 'opportunity'
        AND private.is_program_member(p.id, auth.uid()) AND w.retired_at IS NULL AND w.status NOT IN ('archived', 'draft')
    )
  END
$function$;

CREATE OR REPLACE FUNCTION public.create_owner_matter(_program_id uuid, _property_id uuid, _path text, _title text, _description text, _category text)
 RETURNS TABLE(ticket_id uuid, ref integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE program public.owner_programs; new_ticket public.tickets; chosen_owner uuid;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to open property work.'; END IF;
 IF length(trim(coalesce(_title,''))) NOT BETWEEN 4 AND 160 OR length(coalesce(_description,''))>2000
 OR _category IS NULL OR _category NOT IN ('maintenance','cleaning','admin','guest')
 OR _path IS NULL OR _path NOT IN ('inform','consult','approve','emergency') THEN
  RAISE EXCEPTION 'Enter a valid property matter and participation request.';
 END IF;
 SELECT * INTO program FROM public.owner_programs p WHERE p.id=_program_id AND private.is_program_member(p.id,auth.uid()) FOR UPDATE NOWAIT;
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
END $function$;

CREATE OR REPLACE FUNCTION public.read_owner_review_update(_review_id uuid, _revision integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.owner_reviews; p public.owner_programs; u public.ticket_owner_updates;
BEGIN
 SELECT * INTO r FROM public.owner_reviews WHERE id=_review_id;
 SELECT * INTO p FROM public.owner_programs WHERE id=r.program_id FOR UPDATE NOWAIT;
 IF p.id IS NULL OR auth.uid() IS NULL OR NOT coalesce(private.is_program_member(p.id,auth.uid()),false) OR p.is_demo IS DISTINCT FROM false
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
END $function$;

CREATE OR REPLACE FUNCTION public.manage_owner_review_conversation(_id uuid, _action text, _body text DEFAULT ''::text, _title text DEFAULT ''::text, _what text DEFAULT ''::text, _why text DEFAULT ''::text, _expected_updated_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE r public.owner_reviews; _event text; _name text; _staff boolean; _owner uuid;
BEGIN
 SELECT * INTO r FROM public.owner_reviews WHERE id=_id AND archived_at IS NULL FOR UPDATE;
 IF auth.uid() IS NULL OR r.id IS NULL OR r.status='prepared' THEN RAISE EXCEPTION 'This activity is not available.'; END IF;
 _staff:=public.is_onboarding_staff(auth.uid()) OR public.is_staff(auth.uid());
 SELECT owner_user_id INTO _owner FROM public.owner_programs WHERE id=r.program_id;
 IF NOT _staff AND (NOT coalesce(private.is_program_member(r.program_id,auth.uid()),false) OR _action<>'reply') THEN RAISE EXCEPTION 'Only ARHA staff can manage this conversation.'; END IF;
 IF _action='edit' THEN
 IF length(trim(_title))<3 OR length(_title)>200 OR length(_what)>5000 OR length(_why)>5000 THEN RAISE EXCEPTION 'Check the title and instructions.'; END IF;
 IF _expected_updated_at IS DISTINCT FROM r.updated_at THEN RAISE EXCEPTION 'This activity changed. Refresh before saving.'; END IF;
 UPDATE public.owner_reviews SET title=trim(_title),recommendation=_what,impact=_why WHERE id=r.id;
 INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,entity_label,before_value,after_value) VALUES(auth.uid(),'owner_activity_edited','owner_review',r.id,r.title,jsonb_build_object('title',r.title,'what',r.recommendation,'why',r.impact),jsonb_build_object('title',_title,'what',_what,'why',_why));
 RETURN;
 END IF;
 IF _action NOT IN ('reply','resolve','reopen') THEN RAISE EXCEPTION 'Choose a supported conversation action.'; END IF;
 IF _action='reply' AND (length(trim(_body))<1 OR length(_body)>5000) THEN RAISE EXCEPTION 'Type a message of up to 5,000 characters.'; END IF;
 _event:=CASE _action WHEN 'resolve' THEN 'resolved' WHEN 'reopen' THEN 'reopened' ELSE NULL END;
 SELECT coalesce(full_name,CASE WHEN _staff THEN 'ARHA staff' ELSE 'The homeowner' END) INTO _name FROM public.profiles WHERE id=auth.uid();
 PERFORM public.append_owner_review_message(r.id,CASE WHEN _event IS NULL THEN CASE WHEN _staff THEN 'staff' ELSE 'homeowner' END ELSE 'system' END,coalesce(_name,'ARHA'),_event,CASE WHEN _event IS NULL THEN trim(_body) WHEN _event='resolved' THEN 'Conversation resolved by ARHA' ELSE 'Conversation reopened by ARHA' END);
 -- Conversation events do not change owner completion, hours, or the linked internal Task.
END $function$;

CREATE OR REPLACE FUNCTION public.append_owner_review_message(_id uuid, _author_type text, _name text, _event text, _body text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r public.owner_reviews; _staff boolean; _owner uuid;
BEGIN
 SELECT * INTO r FROM public.owner_reviews WHERE id=_id AND archived_at IS NULL;
 _staff:=public.is_onboarding_staff(auth.uid()) OR public.is_staff(auth.uid());
 SELECT owner_user_id INTO _owner FROM public.owner_programs WHERE id=r.program_id;
 IF auth.uid() IS NULL OR r.id IS NULL OR r.status='prepared' OR (_staff AND NOT public.active_owner_may_act(coalesce(r.is_demo,false))) OR (coalesce(private.is_synthetic_account(),false) AND NOT coalesce(r.is_demo,false)) THEN RAISE EXCEPTION 'This activity is not available.'; END IF;
 IF (_author_type IN ('staff','system') AND NOT _staff) OR (_author_type='homeowner' AND (NOT coalesce(private.is_program_member(r.program_id,auth.uid()),false) OR _staff)) THEN RAISE EXCEPTION 'Conversation author is not permitted.'; END IF;
 IF _event IS NOT NULL AND (_author_type<>'system' OR _event NOT IN ('resolved','reopened')) THEN RAISE EXCEPTION 'Invalid conversation event.'; END IF;
 INSERT INTO public.owner_request_messages(review_id,property_id,program_id,task_id,author_id,author_type,author_name,event,body,is_demo)
 VALUES(r.id,r.property_id,r.program_id,r.onboarding_task_id,auth.uid(),_author_type,_name,_event,_body,coalesce(r.is_demo,false));
 -- In-app only. No email or new notification producer is introduced by this cleanup.
 INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,entity_label,after_value)
 VALUES(auth.uid(),'owner_activity_conversation','owner_review',r.id,r.title,jsonb_build_object('event',_event,'internal_task_changed',false));
END $function$;

CREATE OR REPLACE FUNCTION public.start_optional_opportunity(_template_id uuid, _property_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE t record; _prog uuid; _existing uuid; _id uuid; _demo boolean;
BEGIN
  IF _property_id IS NULL THEN RAISE EXCEPTION 'Choose which home you would like to work on.'; END IF;
  SELECT * INTO t FROM owner_opportunity_library WHERE id=_template_id AND active;
  IF t IS NULL THEN RAISE EXCEPTION 'This Opportunity is no longer offered.'; END IF;
  SELECT p.id, coalesce(p.is_demo,false) INTO _prog, _demo FROM owner_program_properties pp JOIN owner_programs p ON p.id=pp.program_id
   WHERE pp.property_id=_property_id AND pp.inclusion_status='included' AND pp.archived_at IS NULL
     AND p.archived_at IS NULL AND private.is_program_member(p.id,auth.uid()) LIMIT 1;
  IF _prog IS NULL THEN RAISE EXCEPTION 'That home is not part of your program.'; END IF;
  SELECT id INTO _existing FROM work_items WHERE library_template_id=_template_id AND property_id=_property_id AND status<>'archived';
  IF _existing IS NOT NULL THEN RETURN _existing; END IF;
  _id := gen_random_uuid();
  INSERT INTO work_items(id, department, kind, property_id, source_table, source_id, program_id, title, owner_content,
      functional_role, required, blocks_handoff, is_demo, source, library_template_id, response_types, sent_at, viewed_at, status)
  VALUES (_id, 'onboarding', 'opportunity', _property_id, 'owner_opportunity_library', _id, _prog, t.title,
      jsonb_build_object('title',t.title,'summary',t.summary,'what',t.what,'why',t.why,'how',t.how,
        'ways_to_document',t.ways_to_document,'suggested_minutes',t.suggested_minutes,'image_key',t.image_key,
        'category',t.category,'resource_label',t.resource_label,'resource_url',t.resource_url),
      'owner', false, false, _demo, 'optional_library', _template_id, '{}', now(), now(), 'open');
  RETURN _id;
END $function$;

CREATE OR REPLACE FUNCTION private.opportunity_documentation_response()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.work_item_id IS NOT NULL AND NEW.work_item_id IS DISTINCT FROM (CASE WHEN TG_OP='UPDATE' THEN OLD.work_item_id END)
     AND EXISTS (SELECT 1 FROM work_items w JOIN owner_programs p ON p.id=w.program_id
                 WHERE w.id=NEW.work_item_id AND w.kind='opportunity' AND private.is_program_member(p.id,NEW.uploaded_by)) THEN
    UPDATE work_items SET responded_at=now(), viewed_at=coalesce(viewed_at, now()) WHERE id=NEW.work_item_id;
    PERFORM private.notify_opportunity_staff(NEW.work_item_id, 'added documentation');
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.respond_owner_opportunity(_id uuid, _kind text, _decision text, _text text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE w record; t record; _appr uuid; _result text := null; _owner text; _note text;
BEGIN
  SELECT wi.* INTO w FROM work_items wi JOIN owner_programs p ON p.id=wi.program_id
   WHERE wi.id=_id AND wi.kind='opportunity' AND wi.status NOT IN ('draft','archived') AND private.is_program_member(p.id,auth.uid())
   FOR UPDATE OF wi;
  IF w IS NULL THEN RAISE EXCEPTION 'This Opportunity is not available to you.'; END IF;
  IF _kind NOT IN ('acknowledge','feedback','decision') OR NOT (_kind = ANY (w.response_types)) THEN
    RAISE EXCEPTION 'This Opportunity does not take that kind of response.'; END IF;
  IF _kind='feedback' AND coalesce(trim(_text),'')='' THEN RAISE EXCEPTION 'Type your feedback before submitting.'; END IF;
  IF _kind='decision' AND coalesce(_decision,'') NOT IN ('authorize','changes') THEN RAISE EXCEPTION 'Choose a decision.'; END IF;
  IF length(coalesce(_text,'')) > 5000 THEN RAISE EXCEPTION 'Please keep your response under 5,000 characters.'; END IF;
  SELECT coalesce(pr.full_name,'The homeowner') INTO _owner FROM profiles pr WHERE pr.id=auth.uid();
  _owner := coalesce(_owner,'The homeowner');

  -- Specific business action <-> specific owner business decision.
  -- Only an ARHA Business Decision linked to a Task of the SAME property that is
  -- itself waiting on a legitimate owner approval. Nothing else is touched.
  IF _kind='decision' AND w.source='arha' AND w.source_task_id IS NOT NULL THEN
    SELECT * INTO t FROM onboarding_tasks WHERE id=w.source_task_id AND property_id=w.property_id AND archived_at IS NULL FOR UPDATE;
    IF t.id IS NOT NULL AND coalesce(t.requires_owner_approval,false) AND t.owner_approval_status='approved' THEN
      RAISE EXCEPTION 'This decision was already answered by an owner on this program.';
    END IF;
    IF t.id IS NOT NULL AND coalesce(t.requires_owner_approval,false) AND t.owner_approval_status IN ('awaiting_owner','changes_requested','pending') THEN
      SELECT id INTO _appr FROM approvals WHERE entity_type='onboarding_task' AND entity_id=t.id AND property_id=t.property_id AND status='pending' ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
      _note := _owner||' '||CASE WHEN _decision='authorize' THEN 'authorized this work' ELSE 'requested changes' END
               ||' in Opportunity "'||w.title||'"'||coalesce(': '||nullif(trim(coalesce(_text,'')),''),'');
      IF _decision='authorize' THEN
        IF _appr IS NOT NULL THEN
          UPDATE approvals SET status='approved', decision_note=_note, decided_at=now(), responded_at=now(), response_channel='owner_portal' WHERE id=_appr;
        END IF;
        UPDATE onboarding_tasks SET owner_approval_status='approved' WHERE id=t.id;
        _result := 'approved';
      ELSE
        -- Request stays pending; the Task keeps waiting on this one authorization.
        IF _appr IS NOT NULL THEN UPDATE approvals SET decision_note=_note WHERE id=_appr; END IF;
        _result := 'still_waiting';
      END IF;
    END IF;
  END IF;

  UPDATE work_items SET responded_at=now(), viewed_at=coalesce(viewed_at, now()),
    owner_response = owner_response || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'kind',_kind,'decision',_decision,'text',nullif(trim(coalesce(_text,'')),''),'at',now(),
      'by',_owner,'task_id',CASE WHEN _result IS NOT NULL THEN w.source_task_id END,'task_approval',_result)))
   WHERE id=_id;
  PERFORM private.notify_opportunity_staff(_id, CASE WHEN _kind<>'decision' THEN 'responded'
    WHEN _decision='authorize' THEN 'authorized this work' ELSE 'requested changes' END);
END $function$;

CREATE OR REPLACE FUNCTION public.post_owner_request_message(_id uuid, _body text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE w record; _owner uuid; _staff boolean; _type text; _name text; _mid uuid; _home text;
BEGIN
  IF coalesce(trim(_body),'')='' THEN RAISE EXCEPTION 'Type a message before sending.'; END IF;
  IF length(_body) > 5000 THEN RAISE EXCEPTION 'Please keep your message under 5,000 characters.'; END IF;
  SELECT wi.*, p.owner_user_id AS prog_owner INTO w FROM work_items wi LEFT JOIN owner_programs p ON p.id=wi.program_id
   WHERE wi.id=_id AND wi.kind='opportunity' AND wi.status NOT IN ('draft','archived');
  IF w.id IS NULL THEN RAISE EXCEPTION 'This request is not available.'; END IF;
  _staff := public.is_onboarding_staff(auth.uid()) OR public.is_staff(auth.uid());
  IF w.prog_owner IS NOT NULL AND private.is_program_member(w.program_id, auth.uid()) AND NOT _staff THEN
    IF w.status='complete' THEN RAISE EXCEPTION 'ARHA has resolved this request. Contact your ARHA team if something else is needed.'; END IF;
    _type := 'homeowner';
    SELECT coalesce(full_name,'The homeowner') INTO _name FROM profiles WHERE id=auth.uid();
  ELSIF _staff THEN
    IF w.status='complete' THEN RAISE EXCEPTION 'Reopen this request before sending another message.'; END IF;
    IF w.prog_owner IS NULL THEN RAISE EXCEPTION 'The homeowner does not have portal access yet, so this cannot be sent.'; END IF;
    _type := 'staff';
    SELECT coalesce(full_name,'Your ARHA team') INTO _name FROM profiles WHERE id=auth.uid();
  ELSE
    RAISE EXCEPTION 'This request is not available.';
  END IF;
  INSERT INTO owner_request_messages(work_item_id, property_id, program_id, task_id, author_id, author_type, author_name, body, is_demo)
  VALUES (w.id, w.property_id, w.program_id, w.source_task_id, auth.uid(), _type, coalesce(_name, CASE WHEN _type='staff' THEN 'Your ARHA team' ELSE 'The homeowner' END), trim(_body), coalesce(w.is_demo,false))
  RETURNING id INTO _mid;
  IF _type='homeowner' THEN
    UPDATE work_items SET responded_at=now(), viewed_at=coalesce(viewed_at, now()) WHERE id=w.id;
    PERFORM private.notify_opportunity_staff(w.id, 'replied');
  ELSE
    SELECT public.format_property_label(to_jsonb(properties))->>'primary' INTO _home FROM properties WHERE id=w.property_id;
    INSERT INTO owner_notifications(program_id, owner_user_id, kind, priority, title, body, action_path, email_status, is_demo)
    VALUES (w.program_id, w.prog_owner, 'opportunity_reply', 'p3', 'New message from Your ARHA Team', w.title||' · '||_home,
      '/owner?home='||w.property_id||'&opportunity='||w.id,
      CASE WHEN coalesce(w.is_demo,false) THEN 'skipped' ELSE 'pending' END, coalesce(w.is_demo,false));
  END IF;
  RETURN _mid;
END $function$;

CREATE OR REPLACE FUNCTION public.owner_str_reports()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'activePrograms', (SELECT count(*) FROM public.owner_programs o
        WHERE private.is_program_member(o.id, auth.uid()) AND o.archived_at IS NULL AND o.status <> 'completed'
          AND EXISTS (SELECT 1 FROM private.str_program_properties(o.id))),
    'reports', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', r.id, 'version', r.version, 'propertyName', public.format_property_label(to_jsonb(p))->>'primary',
        'periodStart', r.period_start, 'periodEnd', r.period_end,
        'generatedAt', r.generated_at, 'releasedAt', r.released_at,
        'revised', r.version > 1, 'snapshot', r.snapshot) ORDER BY p.name)
      FROM public.str_participation_reports r
      JOIN public.owner_programs o ON o.id = r.program_id
      JOIN public.properties p ON p.id = r.property_id
      WHERE r.status = 'released' AND o.status = 'completed' AND private.is_program_member(o.id, auth.uid())
        AND o.archived_at IS NULL), '[]'::jsonb))
  WHERE auth.uid() IS NOT NULL
$function$;

COMMIT;
