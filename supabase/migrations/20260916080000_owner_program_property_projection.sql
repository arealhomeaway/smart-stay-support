-- Explicit owner-safe Program/Property reads. Existing historical participation
-- remains stored; current operational access requires canonical current enrollment.
CREATE FUNCTION private.owner_read_actor(_actor_id uuid DEFAULT NULL) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN _actor_id IS NULL THEN auth.uid()
  WHEN current_setting('role',true)='service_role' THEN _actor_id
  WHEN _actor_id=auth.uid() THEN auth.uid() ELSE NULL END
$$;
REVOKE ALL ON FUNCTION private.owner_read_actor(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.owner_program_readable(_actor uuid,_program_id uuid,_preview boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT _actor IS NOT NULL AND EXISTS(
  SELECT 1 FROM auth.users a JOIN public.owner_programs p ON p.id=_program_id
  JOIN public.property_owners o ON o.id=p.owner_record_id AND o.active
  WHERE a.id=_actor AND a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until<=now())
   AND p.archived_at IS NULL
   AND ((_preview IS TRUE AND public.has_role(_actor,'admin'))
    OR (_preview IS FALSE AND p.owner_user_id=_actor AND p.is_demo=false
     AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor AND role::text='owner')
     AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor AND role::text<>'owner')))
 )
$$;
REVOKE ALL ON FUNCTION private.owner_program_readable(uuid,uuid,boolean) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION private.owner_current_property_for_actor(_actor uuid,_property_id uuid,_program_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT EXISTS(
  SELECT 1 FROM public.owner_programs p
  JOIN public.owner_program_properties e ON e.program_id=p.id AND e.property_id=_property_id
   AND e.inclusion_status='included' AND e.archived_at IS NULL AND e.is_demo=p.is_demo
  JOIN public.properties h ON h.id=e.property_id AND h.owner_record_id=p.owner_record_id
   AND h.archived_at IS NULL AND h.is_demo=p.is_demo
  WHERE (_program_id IS NULL OR p.id=_program_id) AND private.owner_program_readable(_actor,p.id,false)
 )
$$;
REVOKE ALL ON FUNCTION private.owner_current_property_for_actor(uuid,uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.owner_property_access(_property_id uuid,_actor_id uuid DEFAULT NULL)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT private.owner_current_property_for_actor(private.owner_read_actor(_actor_id),_property_id,NULL)
$$;
REVOKE ALL ON FUNCTION public.owner_property_access(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.owner_property_access(uuid,uuid) TO authenticated,service_role;

-- Existing Ticket reader now also observes account and actual owner-role revocation.
CREATE OR REPLACE FUNCTION private.owner_current_properties(_program_id uuid,_property_ids uuid[],_preview boolean DEFAULT false)
RETURNS TABLE(property_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT h.id FROM public.owner_programs p
 JOIN public.owner_program_properties e ON e.program_id=p.id AND e.inclusion_status='included' AND e.archived_at IS NULL AND e.is_demo=p.is_demo
 JOIN public.properties h ON h.id=e.property_id AND h.owner_record_id=p.owner_record_id AND h.is_demo=p.is_demo AND h.archived_at IS NULL
 WHERE p.id=_program_id AND h.id=ANY(_property_ids) AND cardinality(_property_ids) BETWEEN 1 AND 100
 AND private.owner_program_readable(auth.uid(),p.id,_preview)
$$;
REVOKE ALL ON FUNCTION private.owner_current_properties(uuid,uuid[],boolean) FROM PUBLIC,anon,authenticated;

-- Authority and actual-cost delegates must use the same current scope as Ticket reads.
CREATE OR REPLACE FUNCTION public.read_owner_ticket_authority(_program_id uuid,_property_ids uuid[],_preview boolean DEFAULT false)
RETURNS TABLE(id uuid,ticket_id uuid,property_id uuid,phase text,quote_amount numeric,
 approved_amount numeric,approval_id uuid,approval_status text,contractual_exception boolean,emergency_reason text,
 receipt_id uuid,receipt_status text,receipt_amount numeric,receipt_decided_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT w.id,w.ticket_id,w.property_id,w.phase,w.quote_amount,w.approved_amount,w.approval_id,w.approval_status,
  w.contractual_exception,CASE WHEN length(trim(w.emergency_reason))>0 THEN 'Emergency basis recorded' ELSE NULL END,
  a.id,a.status,a.amount,a.decided_at
 FROM private.owner_current_properties(_program_id,_property_ids,_preview) visible
 JOIN public.properties h ON h.id=visible.property_id
 JOIN public.owner_programs p ON p.id=_program_id
 JOIN public.tickets t ON t.property_id=h.id AND t.is_demo=p.is_demo
 JOIN public.work_orders w ON w.ticket_id=t.id AND w.property_id=h.id AND w.is_demo=p.is_demo
 LEFT JOIN public.approvals a ON a.id=w.approval_id AND a.entity_type='work_order'
  AND a.entity_id=w.id AND a.property_id=h.id AND a.approver_role='owner' AND a.is_demo=p.is_demo
$$;
REVOKE ALL ON FUNCTION public.read_owner_ticket_authority(uuid,uuid[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_owner_ticket_authority(uuid,uuid[],boolean) TO authenticated;
CREATE FUNCTION public.read_owner_programs(_program_id uuid DEFAULT NULL,_preview boolean DEFAULT false,_actor_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid,program jsonb) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT p.id,jsonb_build_object(
  'id',p.id,'status',p.status,'owner_user_id',p.owner_user_id,
  'owner_name',o.name,'owner_email',o.email,'owner_phone',p.owner_phone,
  'started_on',p.started_on,'ends_on',p.ends_on,'activated_at',p.activated_at,
  'operating_target_hours',p.operating_target_hours,'onboarding_milestone_hours',p.onboarding_milestone_hours,
  'onboarding_milestone_day',p.onboarding_milestone_day,'onboarding_lead',p.onboarding_lead,
  'operations_lead',p.operations_lead,'dfy_confirmed',p.dfy_confirmed,'completed_at',p.completed_at,
  'notify_email',p.notify_email,'notify_sms_p1',p.notify_sms_p1,'notify_push',p.notify_push)
 FROM public.owner_programs p JOIN public.property_owners o ON o.id=p.owner_record_id
 WHERE (_program_id IS NULL OR p.id=_program_id)
 AND (_preview IS FALSE OR _program_id IS NOT NULL)
 AND private.owner_program_readable(private.owner_read_actor(_actor_id),p.id,_preview)
$$;
REVOKE ALL ON FUNCTION public.read_owner_programs(uuid,boolean,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_owner_programs(uuid,boolean,uuid) TO authenticated,service_role;

CREATE FUNCTION public.read_owner_properties(_property_ids uuid[],_program_id uuid DEFAULT NULL,_preview boolean DEFAULT false,_actor_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid,program_id uuid,program_status text,property jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT h.id,p.id,p.status,jsonb_build_object('id',to_jsonb(h)->'id','name',to_jsonb(h)->'name','nickname',to_jsonb(h)->'nickname','market',to_jsonb(h)->'market','lifecycle_status',to_jsonb(h)->'lifecycle_status','onboarding_stage',to_jsonb(h)->'onboarding_stage','is_demo',to_jsonb(h)->'is_demo','active',to_jsonb(h)->'active','primary_photo_url',to_jsonb(h)->'primary_photo_url','primary_photo_thumb_url',to_jsonb(h)->'primary_photo_thumb_url','primary_photo_source',to_jsonb(h)->'primary_photo_source','bedrooms',to_jsonb(h)->'bedrooms','bathrooms',to_jsonb(h)->'bathrooms','max_guests',to_jsonb(h)->'max_guests','neighborhood',to_jsonb(h)->'neighborhood','min_stay_months',to_jsonb(h)->'min_stay_months','property_type',to_jsonb(h)->'property_type','listing_public_url',to_jsonb(h)->'listing_public_url','check_in_time',to_jsonb(h)->'check_in_time','check_out_time',to_jsonb(h)->'check_out_time','address_line1',to_jsonb(h)->'address_line1','unit',to_jsonb(h)->'unit','city',to_jsonb(h)->'city','state',to_jsonb(h)->'state','postal_code',to_jsonb(h)->'postal_code','updated_at',to_jsonb(h)->'updated_at','ownerrez_synced_at',to_jsonb(h)->'ownerrez_synced_at','planned_closing_on',to_jsonb(h)->'planned_closing_on','actual_closing_on',to_jsonb(h)->'actual_closing_on','actual_access_on',to_jsonb(h)->'actual_access_on','handoff_accepted_at',to_jsonb(h)->'handoff_accepted_at','living_area_sqft',to_jsonb(h)->'living_area_sqft')
 FROM public.owner_programs p
 JOIN public.owner_program_properties e ON e.program_id=p.id AND e.inclusion_status='included' AND e.archived_at IS NULL AND e.is_demo=p.is_demo
 JOIN public.properties h ON h.id=e.property_id AND h.owner_record_id=p.owner_record_id AND h.archived_at IS NULL AND h.is_demo=p.is_demo
 WHERE h.id=ANY(_property_ids) AND cardinality(_property_ids) BETWEEN 1 AND 100
 AND (_program_id IS NULL OR p.id=_program_id) AND (_preview IS FALSE OR _program_id IS NOT NULL)
 AND private.owner_program_readable(private.owner_read_actor(_actor_id),p.id,_preview)
$$;
REVOKE ALL ON FUNCTION public.read_owner_properties(uuid[],uuid,boolean,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_owner_properties(uuid[],uuid,boolean,uuid) TO authenticated,service_role;

CREATE FUNCTION public.read_owner_program_properties(_program_id uuid,_preview boolean DEFAULT false)
RETURNS TABLE(id uuid,enrollment jsonb) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT e.id,jsonb_build_object(
  'id',e.id,'property_id',e.property_id,'closing_date',e.closing_date,'closing_confirmed',e.closing_confirmed,
  'added_on',e.added_on,'inclusion_status',e.inclusion_status,'onboarding_status',e.onboarding_status,
  'launch_status',e.launch_status,'coverage_status',e.coverage_status,'last_owner_activity_at',e.last_owner_activity_at,
  'current_access',coalesce(e.inclusion_status='included' AND e.archived_at IS NULL AND h.archived_at IS NULL
   AND h.owner_record_id=p.owner_record_id AND h.is_demo=p.is_demo,false),
  'properties',CASE WHEN e.inclusion_status='included' AND e.archived_at IS NULL AND h.archived_at IS NULL
   AND h.owner_record_id=p.owner_record_id AND h.is_demo=p.is_demo THEN
    jsonb_build_object('name',h.name,'nickname',h.nickname,'address_line1',h.address_line1,'city',h.city,'state',h.state,'primary_photo_url',h.primary_photo_url)
   ELSE NULL END)
 FROM public.owner_programs p JOIN public.owner_program_properties e ON e.program_id=p.id AND e.is_demo=p.is_demo
 LEFT JOIN public.properties h ON h.id=e.property_id
 WHERE p.id=_program_id AND private.owner_program_readable(auth.uid(),p.id,_preview)
$$;
REVOKE ALL ON FUNCTION public.read_owner_program_properties(uuid,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_owner_program_properties(uuid,boolean) TO authenticated;

-- Preferences are an explicit, narrow action, never unrestricted program UPDATE.
CREATE FUNCTION public.save_owner_alert_preferences(_email boolean,_sms_p1 boolean,_push boolean,_phone text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE chosen uuid; matches integer;
BEGIN
 IF _email IS NULL OR _sms_p1 IS NULL OR _push IS NULL OR length(coalesce(_phone,''))>32 THEN
  RAISE EXCEPTION 'Choose valid notification preferences and a phone number of at most 32 characters.';
 END IF;
 SELECT count(*),(array_agg(p.id))[1] INTO matches,chosen FROM public.owner_programs p
 WHERE private.owner_program_readable(auth.uid(),p.id,false);
 IF matches<>1 THEN RAISE EXCEPTION 'One current participation program must be linked to this account.'; END IF;
 PERFORM 1 FROM public.owner_programs WHERE id=chosen FOR UPDATE NOWAIT;
 PERFORM 1 FROM auth.users WHERE id=auth.uid() FOR SHARE NOWAIT;
 PERFORM 1 FROM public.user_roles WHERE user_id=auth.uid() FOR SHARE NOWAIT;
 PERFORM 1 FROM public.property_owners WHERE id=(SELECT owner_record_id FROM public.owner_programs WHERE id=chosen) FOR SHARE NOWAIT;
 IF NOT private.owner_program_readable(auth.uid(),chosen,false) THEN RAISE EXCEPTION 'This participation program is no longer available.'; END IF;
 UPDATE public.owner_programs SET notify_email=_email,notify_sms_p1=_sms_p1,notify_push=_push,owner_phone=nullif(trim(_phone),'') WHERE id=chosen;
 RETURN chosen;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'The program is being updated. Refresh and try again.';
END $$;
REVOKE ALL ON FUNCTION public.save_owner_alert_preferences(boolean,boolean,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_owner_alert_preferences(boolean,boolean,boolean,text) TO authenticated;

DROP POLICY "Owners read their own program" ON public.owner_programs;
DROP POLICY "Owners read properties in their program" ON public.properties;
