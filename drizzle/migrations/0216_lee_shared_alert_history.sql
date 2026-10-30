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
   AND private.owner_program_readable(auth.uid(),p.id,_preview) AND (n.owner_user_id IS NULL OR n.owner_user_id=p.owner_user_id OR EXISTS(SELECT 1 FROM public.program_members m WHERE m.program_id=p.id AND m.user_id=n.owner_user_id))
   AND (n.review_id IS NULL OR EXISTS(SELECT 1 FROM owner_reviews r WHERE r.id=n.review_id AND r.program_id=p.id AND private.owner_review_readable(auth.uid(),r.id,_preview)))
   AND (n.ticket_id IS NULL OR EXISTS(SELECT 1 FROM tickets t WHERE t.id=n.ticket_id AND t.is_demo=p.is_demo
     AND EXISTS(SELECT 1 FROM private.owner_current_properties(p.id,ARRAY[t.property_id],_preview))));
 END IF;
END $function$
;
