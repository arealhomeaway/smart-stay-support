CREATE OR REPLACE FUNCTION private.demo_owner_link_ok(_actor uuid, _program_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT _actor IS NOT NULL AND EXISTS(
  SELECT 1 FROM public.owner_programs p JOIN auth.users a ON a.id=_actor
  WHERE p.id=_program_id AND p.is_demo AND p.archived_at IS NULL AND p.owner_user_id=_actor
   AND a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until<=now())
   AND a.email_confirmed_at IS NOT NULL AND lower(a.email) LIKE '%@resolve-test.invalid'
   AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor AND role::text='owner')
   AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor AND role::text<>'owner')
   AND NOT EXISTS(SELECT 1 FROM public.owner_programs o WHERE o.owner_user_id=_actor AND o.id<>p.id)
   AND EXISTS(SELECT 1 FROM public.owner_program_properties pp WHERE pp.program_id=p.id)
   AND NOT EXISTS(SELECT 1 FROM public.owner_program_properties pp LEFT JOIN public.properties h ON h.id=pp.property_id
     WHERE pp.program_id=p.id AND (pp.is_demo IS NOT TRUE OR h.is_demo IS NOT TRUE))
   AND (SELECT l.action='owner_program.demo_account_linked' AND l.after_value->>'owner_user_id'=_actor::text
        FROM public.audit_log l WHERE l.entity_type='owner_program' AND l.entity_id=p.id
         AND l.action IN ('owner_program.demo_account_linked','owner_program.demo_account_unlinked')
         AND public.has_role(l.actor_id,'admin')
        ORDER BY l.created_at DESC LIMIT 1) IS TRUE)
$$;
REVOKE ALL ON FUNCTION private.demo_owner_link_ok(uuid,uuid) FROM public, anon;

CREATE OR REPLACE FUNCTION private.owner_program_readable(_actor uuid, _program_id uuid, _preview boolean DEFAULT false)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
 SELECT _actor IS NOT NULL AND EXISTS(
  SELECT 1 FROM auth.users a JOIN public.owner_programs p ON p.id=_program_id
  JOIN public.property_owners o ON o.id=p.owner_record_id AND o.active
  WHERE a.id=_actor AND a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until<=now())
   AND p.archived_at IS NULL
   AND ((_preview IS TRUE AND public.has_role(_actor,'admin'))
    OR (_preview IS FALSE AND p.owner_user_id=_actor
     AND (p.is_demo=false OR private.demo_owner_link_ok(_actor,p.id))
     AND EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor AND role::text='owner')
     AND NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor AND role::text<>'owner')))
 )
$function$;

CREATE OR REPLACE FUNCTION public.owner_owns_program(_program_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT EXISTS (SELECT 1 FROM owner_programs p WHERE p.id=_program_id AND p.owner_user_id=auth.uid() AND p.archived_at IS NULL
  AND (p.is_demo=false OR private.demo_owner_link_ok(auth.uid(),p.id)))
$$;

CREATE OR REPLACE FUNCTION private.owner_badge_actor(_program_id uuid, _actor_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
 SELECT EXISTS(SELECT 1 FROM owner_programs p JOIN property_owners o ON o.id=p.owner_record_id AND o.active
 JOIN auth.users a ON a.id=_actor_id AND a.deleted_at IS NULL AND (a.banned_until IS NULL OR a.banned_until<=now())
 WHERE p.id=_program_id AND p.archived_at IS NULL AND
 ((p.is_demo AND (public.has_role(_actor_id,'admin') OR private.owner_program_readable(_actor_id,p.id,false)))
  OR (NOT p.is_demo AND (public.is_staff(_actor_id) OR private.owner_program_readable(_actor_id,p.id,false)))))
$function$;

CREATE OR REPLACE FUNCTION public.owner_document_access(_document_id uuid, _actor_id uuid DEFAULT NULL::uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
 SELECT EXISTS(SELECT 1 FROM public.documents d JOIN public.owner_programs p ON p.id=d.owner_recipient_program_id AND p.owner_record_id=d.owner_recipient_id
 WHERE d.id=_document_id AND d.deleted_at IS NULL AND d.archived_at IS NULL AND d.is_demo=p.is_demo AND d.visibility='owner_shared'
 AND private.owner_current_property_for_actor(private.owner_read_actor(_actor_id),d.property_id,p.id)
 AND ((d.entity_type='property' AND d.entity_id=d.property_id)
 OR (d.entity_type='ticket' AND EXISTS(SELECT 1 FROM public.tickets t WHERE t.id=d.entity_id AND t.property_id=d.property_id AND t.is_demo=d.is_demo))
 OR (d.entity_type='onboarding_task' AND EXISTS(SELECT 1 FROM public.onboarding_tasks t WHERE t.id=d.entity_id AND t.property_id=d.property_id AND t.is_demo=d.is_demo))))
$function$;

CREATE OR REPLACE FUNCTION public.unlink_demo_owner_account(_program_id uuid, _reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE prog public.owner_programs;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN
  RAISE EXCEPTION 'Only an administrator can unlink a demo homeowner account.'; END IF;
 IF length(trim(coalesce(_reason,''))) < 5 THEN RAISE EXCEPTION 'A reason is required.'; END IF;
 SELECT * INTO prog FROM public.owner_programs WHERE id=_program_id FOR UPDATE;
 IF NOT FOUND OR prog.is_demo IS NOT TRUE THEN RAISE EXCEPTION 'Only a demo homeowner program can be unlinked this way.'; END IF;
 UPDATE public.owner_programs SET owner_user_id=NULL WHERE id=prog.id;
 INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, reason, before_value, after_value)
 VALUES (auth.uid(),'owner_program.demo_account_unlinked','owner_program',prog.id,_reason,
  jsonb_build_object('owner_user_id',prog.owner_user_id), jsonb_build_object('owner_user_id',NULL,'is_demo',true));
 RETURN prog.id;
END $$;
REVOKE ALL ON FUNCTION public.unlink_demo_owner_account(uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.unlink_demo_owner_account(uuid,text) TO authenticated;