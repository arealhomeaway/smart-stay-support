CREATE OR REPLACE FUNCTION public.read_owner_approvals()
 RETURNS TABLE(id uuid, approval jsonb)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 WITH historical AS (
  SELECT a.id,p.approval_updated_at AS updated_at,coalesce(a.kind,'other')::text AS kind,a.entity_type::text AS entity_type,p.title,p.detail,p.amount,p.currency,r.status,r.decision_note,r.decided_at,
   p.due_on,p.property_id,p.property_name,p.reviewed_at AS created_at,p.id AS publication_id,p.revision,r.actor_id=p.recipient_id AS recorded_by_owner,false AS can_respond,NULL::text AS blocked_reason
  FROM public.owner_approval_receipts r JOIN public.owner_approval_publications p ON p.id=r.publication_id
  JOIN public.approvals a ON a.id=r.approval_id JOIN public.owner_programs program ON program.id=p.program_id
  WHERE p.recipient_id=auth.uid() AND program.owner_record_id=p.owner_record_id
   AND private.owner_program_readable(auth.uid(),program.id,false)
 ), current_requests AS (
  SELECT a.id,a.updated_at,coalesce(a.kind,'other')::text AS kind,a.entity_type::text AS entity_type,p.title,p.detail,
   a.amount,CASE WHEN a.currency ~ '^[A-Z]{3}$' THEN a.currency ELSE 'USD' END AS currency,a.status,NULL::text AS decision_note,a.decided_at,
   a.due_on,a.property_id,public.format_property_label(to_jsonb(h))->>'primary' AS property_name,a.created_at,p.id AS publication_id,p.revision,false AS recorded_by_owner,
   a.status='pending' AND coalesce(private.owner_approval_source_current(a),false) AS can_respond,
   CASE WHEN a.status='pending' AND NOT coalesce(private.owner_approval_source_current(a),false) THEN 'The operational request changed. ARHA must reconcile it before you can decide.' END AS blocked_reason
  FROM public.approvals a JOIN public.properties h ON h.id=a.property_id
  LEFT JOIN LATERAL (SELECT x.* FROM public.owner_approval_publications x WHERE x.approval_id=a.id ORDER BY x.revision DESC LIMIT 1) latest ON true
  JOIN public.owner_approval_publications p ON p.id=latest.id AND p.approval_updated_at=a.updated_at AND p.property_id=a.property_id
   AND p.recipient_id=auth.uid() AND p.program_id=private.owner_approval_program(a) AND p.owner_record_id=h.owner_record_id
   AND p.entity_type=a.entity_type AND p.entity_id=a.entity_id
  WHERE a.approver_id=auth.uid() AND private.owner_approval_program(a) IS NOT NULL
   AND a.status IN('pending','approved','declined','changes_requested','cancelled','withdrawn')
   AND NOT EXISTS(SELECT 1 FROM public.owner_approval_receipts r WHERE r.approval_id=a.id)
 ), rows AS (SELECT * FROM historical UNION ALL SELECT * FROM current_requests)
 SELECT r.id,jsonb_build_object('id',r.id,'updated_at',r.updated_at,'kind',r.kind,'entity_type',r.entity_type,'title',r.title,'detail',r.detail,'amount',r.amount,'currency',r.currency,
  'status',r.status,'decision_note',r.decision_note,'decided_at',r.decided_at,'due_on',r.due_on,'evidence_url',NULL,'property_id',r.property_id,
  'property_name',r.property_name,'active_owner',true,'created_at',r.created_at,'publication_id',r.publication_id,'revision',r.revision,
  'recorded_by_owner',r.recorded_by_owner,'can_respond',r.can_respond,'blocked_reason',r.blocked_reason)
 FROM rows r ORDER BY r.created_at DESC,r.id
$function$
;