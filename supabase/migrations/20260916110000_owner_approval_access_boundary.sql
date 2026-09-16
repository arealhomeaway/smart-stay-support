-- Owner approvals expose reviewed publications, never raw internal approval rows.
-- No legacy text is backfilled: staff must explicitly review its owner-facing summary.
CREATE TABLE public.owner_approval_publications (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), approval_id uuid NOT NULL REFERENCES public.approvals(id),
 revision integer NOT NULL CHECK(revision>0), approval_updated_at timestamptz NOT NULL,
 program_id uuid NOT NULL REFERENCES public.owner_programs(id), owner_record_id uuid NOT NULL REFERENCES public.property_owners(id),
 property_id uuid NOT NULL REFERENCES public.properties(id), recipient_id uuid NOT NULL REFERENCES auth.users(id),
 entity_type text NOT NULL, entity_id uuid NOT NULL, title text NOT NULL CHECK(length(trim(title)) BETWEEN 5 AND 180),
 detail text NOT NULL CHECK(length(trim(detail)) BETWEEN 20 AND 4000), amount numeric, currency text NOT NULL,
 property_name text, due_on date, reviewed_by uuid NOT NULL REFERENCES auth.users(id), reviewed_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(approval_id,revision)
);
CREATE TABLE public.owner_approval_receipts (
 approval_id uuid PRIMARY KEY REFERENCES public.approvals(id), publication_id uuid NOT NULL UNIQUE REFERENCES public.owner_approval_publications(id),
 status text NOT NULL CHECK(status IN('approved','declined','changes_requested')), decision_note text,
 decided_at timestamptz NOT NULL, actor_id uuid NOT NULL REFERENCES auth.users(id)
);
ALTER TABLE public.owner_approval_publications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_approval_receipts ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.owner_approval_publications,public.owner_approval_receipts TO authenticated;
GRANT ALL ON public.owner_approval_publications,public.owner_approval_receipts TO service_role;
CREATE POLICY owner_approval_publications_staff ON public.owner_approval_publications FOR SELECT TO authenticated USING(public.is_internal_staff(auth.uid()));
CREATE POLICY owner_approval_receipts_staff ON public.owner_approval_receipts FOR SELECT TO authenticated USING(public.is_internal_staff(auth.uid()));
CREATE FUNCTION private.preserve_owner_approval_receipt() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  IF current_user IS DISTINCT FROM (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public.publish_owner_approval(uuid,timestamptz,integer,uuid,uuid,uuid,text,text,boolean)'::regprocedure) THEN
   RAISE EXCEPTION 'Publish or retain owner approval context only through its checked atomic action.';
  END IF;
  RETURN NEW;
 END IF;
 RAISE EXCEPTION 'Published owner approval context and decision receipts are immutable. Create a new reviewed publication for an open request.';
END $$;
CREATE TRIGGER owner_approval_publications_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.owner_approval_publications FOR EACH ROW EXECUTE FUNCTION private.preserve_owner_approval_receipt();
CREATE TRIGGER owner_approval_receipts_immutable BEFORE INSERT OR UPDATE OR DELETE ON public.owner_approval_receipts FOR EACH ROW EXECUTE FUNCTION private.preserve_owner_approval_receipt();

CREATE FUNCTION private.owner_approval_program(_request public.approvals) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE WHEN count(*)=1 THEN (array_agg(p.id))[1] END
 FROM public.owner_programs p
 WHERE _request.approver_role='owner' AND _request.is_demo=false
 AND p.owner_user_id=_request.approver_id
 AND private.owner_current_property_for_actor(_request.approver_id,_request.property_id,p.id)
$$;
REVOKE ALL ON FUNCTION private.owner_approval_program(public.approvals) FROM PUBLIC,anon,authenticated;

-- Validate the canonical source independently of the approval's text and recipient.
CREATE FUNCTION private.owner_approval_source_current(_request public.approvals) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT CASE _request.entity_type
 WHEN 'property' THEN _request.entity_id=_request.property_id
 WHEN 'ticket' THEN EXISTS(SELECT 1 FROM public.tickets t WHERE t.id=_request.entity_id AND t.property_id=_request.property_id AND t.is_demo=false)
 WHEN 'work_order' THEN EXISTS(SELECT 1 FROM public.work_orders w WHERE w.id=_request.entity_id AND w.property_id=_request.property_id AND w.is_demo=false
  AND w.closed_at IS NULL AND w.approval_id=_request.id AND w.approval_status='pending' AND w.quote_amount=_request.amount
  AND (w.ticket_id IS NULL OR EXISTS(SELECT 1 FROM public.tickets t WHERE t.id=w.ticket_id AND t.property_id=w.property_id AND t.is_demo=false)))
 WHEN 'onboarding_task' THEN EXISTS(SELECT 1 FROM public.onboarding_tasks t WHERE t.id=_request.entity_id AND t.property_id=_request.property_id
  AND t.is_demo=false AND t.archived_at IS NULL AND t.requires_owner_approval)
 WHEN 'financial_request' THEN EXISTS(SELECT 1 FROM public.financial_requests f WHERE f.id=_request.entity_id AND f.property_id=_request.property_id AND f.is_demo=false
  AND f.approval_id=_request.id AND f.status='awaiting_approval' AND f.approved_amount IS NULL AND f.estimate_amount=_request.amount)
 ELSE false END
 AND (_request.amount IS NULL OR (_request.amount>=0 AND _request.amount::text NOT IN('NaN','Infinity','-Infinity')))
$$;
REVOKE ALL ON FUNCTION private.owner_approval_source_current(public.approvals) FROM PUBLIC,anon,authenticated;

-- Match the existing source-before-approval response lock order; NOWAIT fails
-- safely when enrollment/lifecycle/source transactions use an inverse order.
CREATE FUNCTION private.lock_owner_approval(_approval_id uuid,_require_pending boolean DEFAULT true) RETURNS public.approvals
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE request public.approvals%ROWTYPE; source_type text; source_id uuid; program_id uuid;
BEGIN
 SELECT entity_type,entity_id INTO source_type,source_id FROM public.approvals WHERE id=_approval_id;
 CASE source_type
 WHEN 'work_order' THEN PERFORM 1 FROM public.work_orders WHERE id=source_id FOR UPDATE NOWAIT;
 WHEN 'onboarding_task' THEN PERFORM 1 FROM public.onboarding_tasks WHERE id=source_id FOR UPDATE NOWAIT;
 WHEN 'financial_request' THEN PERFORM 1 FROM public.financial_requests WHERE id=source_id FOR UPDATE NOWAIT;
 WHEN 'ticket' THEN PERFORM 1 FROM public.tickets WHERE id=source_id FOR SHARE NOWAIT;
 WHEN 'property' THEN PERFORM 1 FROM public.properties WHERE id=source_id FOR SHARE NOWAIT;
 ELSE RAISE EXCEPTION 'This approval source requires staff handling.';
 END CASE;
 IF NOT FOUND THEN RAISE EXCEPTION 'The approval source is no longer available.'; END IF;
 SELECT * INTO request FROM public.approvals WHERE id=_approval_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR request.entity_type IS DISTINCT FROM source_type OR request.entity_id IS DISTINCT FROM source_id OR (_require_pending AND request.status<>'pending')
  OR request.approver_role IS DISTINCT FROM 'owner' OR request.is_demo IS DISTINCT FROM false THEN
  RAISE EXCEPTION 'The approval changed or a decision was already recorded. Refresh the request.';
 END IF;
 program_id:=private.owner_approval_program(request);
 IF program_id IS NULL THEN RAISE EXCEPTION 'This approval needs one current canonical Owner, Property, program and eligible portal recipient.'; END IF;
 PERFORM 1 FROM public.owner_programs WHERE id=program_id FOR SHARE NOWAIT;
 PERFORM 1 FROM public.properties WHERE id=request.property_id FOR SHARE NOWAIT;
 PERFORM 1 FROM public.property_owners WHERE id=(SELECT owner_record_id FROM public.owner_programs WHERE id=program_id) FOR SHARE NOWAIT;
 PERFORM 1 FROM public.owner_program_properties e WHERE e.program_id=private.owner_approval_program(request) AND e.property_id=request.property_id FOR SHARE NOWAIT;
 PERFORM 1 FROM auth.users WHERE id=request.approver_id FOR SHARE NOWAIT;
 PERFORM 1 FROM public.user_roles WHERE user_id=request.approver_id FOR SHARE NOWAIT;
 IF private.owner_approval_program(request) IS DISTINCT FROM program_id OR NOT coalesce(private.owner_approval_source_current(request),false) THEN
  RAISE EXCEPTION 'The approval source, amount or canonical Owner/Property relationship changed. Ask staff to review the request.';
 END IF;
 RETURN request;
END $$;
REVOKE ALL ON FUNCTION private.lock_owner_approval(uuid,boolean) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.read_owner_approval_publication_context(_approval_id uuid) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE request public.approvals%ROWTYPE; program_id uuid; publication public.owner_approval_publications%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'Only staff can review an approval for publication.'; END IF;
 SELECT * INTO request FROM public.approvals WHERE id=_approval_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'The approval is not available.'; END IF;
 program_id:=private.owner_approval_program(request);
 SELECT * INTO publication FROM public.owner_approval_publications WHERE approval_id=request.id ORDER BY revision DESC LIMIT 1;
 RETURN jsonb_build_object('approvalId',request.id,'expectedUpdatedAt',request.updated_at,'expectedRevision',coalesce(publication.revision,0),
  'programId',program_id,'ownerId',(SELECT owner_record_id FROM public.owner_programs WHERE id=program_id),'recipientId',request.approver_id,
  'ownerName',(SELECT o.name FROM public.owner_programs p JOIN public.property_owners o ON o.id=p.owner_record_id WHERE p.id=program_id),
  'recipientEmail',(SELECT email FROM auth.users WHERE id=request.approver_id),
  'canPublish',request.status='pending' AND program_id IS NOT NULL AND coalesce(private.owner_approval_source_current(request),false),
  'blockedReason',CASE WHEN request.status<>'pending' THEN 'This request already has a decision. Its published context is retained.'
   WHEN program_id IS NULL THEN 'Route this request to the eligible account linked to its current canonical Owner and enrolled Property before publishing.'
   WHEN NOT coalesce(private.owner_approval_source_current(request),false) THEN 'The source, amount or approval link needs staff reconciliation before publication.' END,
  'publishedTitle',publication.title,'publishedDetail',publication.detail);
END $$;
REVOKE ALL ON FUNCTION public.read_owner_approval_publication_context(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_owner_approval_publication_context(uuid) TO authenticated;

CREATE FUNCTION public.publish_owner_approval(_approval_id uuid,_expected_updated_at timestamptz,_expected_revision integer,
 _expected_owner_id uuid,_expected_program_id uuid,_expected_recipient_id uuid,_title text,_detail text,_reviewed boolean) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE request public.approvals%ROWTYPE; program public.owner_programs%ROWTYPE; revision integer; publication_id uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'Only staff can publish a reviewed owner approval.'; END IF;
 IF _reviewed IS DISTINCT FROM true OR length(trim(coalesce(_title,''))) NOT BETWEEN 5 AND 180 OR length(trim(coalesce(_detail,''))) NOT BETWEEN 20 AND 4000 THEN
  RAISE EXCEPTION 'Write an owner-safe title and clear decision context, then confirm the privacy review.';
 END IF;
 request:=private.lock_owner_approval(_approval_id);
 SELECT * INTO program FROM public.owner_programs WHERE id=private.owner_approval_program(request);
 SELECT coalesce(max(p.revision),0) INTO revision FROM public.owner_approval_publications p WHERE approval_id=request.id;
 IF _expected_updated_at IS NULL OR request.updated_at IS DISTINCT FROM _expected_updated_at OR _expected_revision IS DISTINCT FROM revision
  OR _expected_owner_id IS DISTINCT FROM program.owner_record_id OR _expected_program_id IS DISTINCT FROM program.id
  OR _expected_recipient_id IS DISTINCT FROM request.approver_id THEN
  RAISE EXCEPTION 'The approval, recipient or published context changed. Review the current context before publishing; keep your draft.';
 END IF;
 INSERT INTO public.owner_approval_publications(approval_id,revision,approval_updated_at,program_id,owner_record_id,property_id,recipient_id,
  entity_type,entity_id,title,detail,amount,currency,property_name,due_on,reviewed_by)
 VALUES(request.id,revision+1,request.updated_at,program.id,program.owner_record_id,request.property_id,request.approver_id,
  request.entity_type,request.entity_id,trim(_title),trim(_detail),request.amount,CASE WHEN request.currency ~ '^[A-Z]{3}$' THEN request.currency ELSE 'USD' END,
  (SELECT coalesce(nickname,name) FROM public.properties WHERE id=request.property_id),request.due_on,auth.uid()) RETURNING id INTO publication_id;
 INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,after_value)
 VALUES(auth.uid(),'owner_approval_published','approval',request.id,jsonb_build_object('publication_id',publication_id,'revision',revision+1));
 RETURN publication_id;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'The approval context is being updated. Refresh and review it before publishing.';
END $$;
REVOKE ALL ON FUNCTION public.publish_owner_approval(uuid,timestamptz,integer,uuid,uuid,uuid,text,text,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.publish_owner_approval(uuid,timestamptz,integer,uuid,uuid,uuid,text,text,boolean) TO authenticated;

-- Retain reviewed context for both direct owner decisions and staff-transcribed
-- responses. Never publish a staff transcription note as owner-authored text.
CREATE FUNCTION private.retain_owner_approval_receipt() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE publication public.owner_approval_publications%ROWTYPE; request public.approvals%ROWTYPE; actor uuid;
BEGIN
 IF OLD.status IS DISTINCT FROM 'pending' OR NEW.status NOT IN('approved','declined','changes_requested') OR NEW.decided_at IS NULL
  OR NEW.approver_role IS DISTINCT FROM 'owner' OR NEW.is_demo IS DISTINCT FROM false
  OR NEW.approver_id IS DISTINCT FROM OLD.approver_id OR NEW.property_id IS DISTINCT FROM OLD.property_id
  OR NEW.entity_type IS DISTINCT FROM OLD.entity_type OR NEW.entity_id IS DISTINCT FROM OLD.entity_id
  OR NEW.amount IS DISTINCT FROM OLD.amount OR NEW.currency IS DISTINCT FROM OLD.currency THEN RETURN NEW; END IF;
 actor:=coalesce(auth.uid(),NEW.recorded_by);
 IF actor IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO publication FROM public.owner_approval_publications WHERE approval_id=NEW.id ORDER BY revision DESC LIMIT 1;
 IF publication.id IS NULL OR publication.approval_updated_at IS DISTINCT FROM OLD.updated_at
  OR publication.recipient_id IS DISTINCT FROM NEW.approver_id OR publication.property_id IS DISTINCT FROM NEW.property_id
  OR publication.entity_type IS DISTINCT FROM NEW.entity_type OR publication.entity_id IS DISTINCT FROM NEW.entity_id
  OR publication.program_id IS DISTINCT FROM private.owner_approval_program(NEW)
  OR publication.owner_record_id IS DISTINCT FROM (SELECT owner_record_id FROM public.owner_programs WHERE id=publication.program_id)
  OR NOT coalesce(private.owner_approval_source_current(OLD),false) THEN RETURN NEW; END IF;
 -- The approval is already locked. Fail fast on an inverse source/program lock
 -- instead of retaining a receipt through a concurrent enrollment or cost edit.
 request:=private.lock_owner_approval(NEW.id,false);
 INSERT INTO public.owner_approval_receipts(approval_id,publication_id,status,decision_note,decided_at,actor_id)
 VALUES(NEW.id,publication.id,NEW.status,CASE WHEN actor=publication.recipient_id THEN NEW.decision_note ELSE NULL END,NEW.decided_at,actor);
 RETURN NEW;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'The approval context is being updated. Refresh before recording its decision.';
END $$;
REVOKE ALL ON FUNCTION private.retain_owner_approval_receipt() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER retain_owner_approval_receipt AFTER UPDATE ON public.approvals FOR EACH ROW EXECUTE FUNCTION private.retain_owner_approval_receipt();
CREATE FUNCTION public.respond_owner_approval(_approval_id uuid,_publication_id uuid,_expected_updated_at timestamptz,_approved boolean,_note text)
RETURNS timestamptz LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE request public.approvals%ROWTYPE; publication public.owner_approval_publications%ROWTYPE; decided timestamptz;
BEGIN
 IF auth.uid() IS NULL OR _approved IS NULL OR length(coalesce(_note,''))>2000 OR (_approved=false AND length(trim(coalesce(_note,'')))=0) THEN
  RAISE EXCEPTION 'Sign in and provide a valid decision, including a note when requesting changes.';
 END IF;
 -- Do not inspect/lock another recipient's operational source on a guessed id.
 IF NOT EXISTS(SELECT 1 FROM public.approvals a WHERE a.id=_approval_id AND a.approver_id=auth.uid() AND a.approver_role='owner'
  AND a.is_demo=false AND private.owner_approval_program(a) IS NOT NULL) THEN RAISE EXCEPTION 'That approval is not available to this owner account.'; END IF;
 request:=private.lock_owner_approval(_approval_id);
 SELECT * INTO publication FROM public.owner_approval_publications WHERE approval_id=request.id ORDER BY revision DESC LIMIT 1;
 IF publication.id IS NULL OR _publication_id IS DISTINCT FROM publication.id OR _expected_updated_at IS NULL OR request.updated_at IS DISTINCT FROM _expected_updated_at
  OR publication.approval_updated_at IS DISTINCT FROM request.updated_at OR publication.recipient_id IS DISTINCT FROM auth.uid()
  OR publication.program_id IS DISTINCT FROM private.owner_approval_program(request)
  OR publication.owner_record_id IS DISTINCT FROM (SELECT owner_record_id FROM public.owner_programs WHERE id=publication.program_id)
  OR publication.property_id IS DISTINCT FROM request.property_id OR publication.entity_type IS DISTINCT FROM request.entity_type OR publication.entity_id IS DISTINCT FROM request.entity_id THEN
  RAISE EXCEPTION 'A current staff-reviewed summary is required. Review the updated request before responding; your note can be kept.';
 END IF;
 IF request.entity_type IN('work_order','onboarding_task','financial_request') THEN
  decided:=public.record_versioned_owner_response(request.id,auth.uid(),_expected_updated_at,_approved,trim(coalesce(_note,'')));
 ELSE
  decided:=now();
  UPDATE public.approvals SET status=CASE WHEN _approved THEN 'approved' ELSE 'declined' END,decision_note=nullif(trim(_note),''),decided_at=decided WHERE id=request.id;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.owner_approval_receipts r WHERE r.approval_id=request.id AND r.publication_id=publication.id AND r.actor_id=auth.uid()) THEN
  RAISE EXCEPTION 'The exact reviewed decision context could not be retained. No response was saved.';
 END IF;
 -- Work Order delegate already writes its canonical audit. This publication receipt
 -- is additional immutable context; task/finance/generic responses need this audit.
 IF request.entity_type<>'work_order' THEN
  INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,reason,after_value)
  VALUES(auth.uid(),CASE WHEN _approved THEN 'owner_approval_approved' ELSE 'owner_approval_declined' END,'approval',request.id,nullif(trim(_note),''),
   jsonb_build_object('decided_at',decided,'publication_id',publication.id,'revision',publication.revision));
 END IF;
 RETURN decided;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'The approval context is being updated. Refresh and review it before responding.';
END $$;
REVOKE ALL ON FUNCTION public.respond_owner_approval(uuid,uuid,timestamptz,boolean,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.respond_owner_approval(uuid,uuid,timestamptz,boolean,text) TO authenticated;

CREATE FUNCTION public.read_owner_approvals() RETURNS TABLE(id uuid,approval jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 WITH historical AS (
  SELECT a.id,p.approval_updated_at AS updated_at,'other'::text AS kind,p.title,p.detail,p.amount,p.currency,r.status,r.decision_note,r.decided_at,
   p.due_on,p.property_id,p.property_name,p.reviewed_at AS created_at,p.id AS publication_id,p.revision,r.actor_id=p.recipient_id AS recorded_by_owner,false AS can_respond,NULL::text AS blocked_reason
  FROM public.owner_approval_receipts r JOIN public.owner_approval_publications p ON p.id=r.publication_id
  JOIN public.approvals a ON a.id=r.approval_id JOIN public.owner_programs program ON program.id=p.program_id
  WHERE p.recipient_id=auth.uid() AND program.owner_record_id=p.owner_record_id
   AND private.owner_program_readable(auth.uid(),program.id,false)
 ), current_requests AS (
  SELECT a.id,a.updated_at,'other'::text AS kind,coalesce(p.title,CASE WHEN a.status='pending' THEN 'Approval awaiting staff review' ELSE 'Earlier approval decision' END) AS title,p.detail,
   a.amount,CASE WHEN a.currency ~ '^[A-Z]{3}$' THEN a.currency ELSE 'USD' END AS currency,a.status,NULL::text AS decision_note,a.decided_at,
   a.due_on,a.property_id,coalesce(h.nickname,h.name) AS property_name,a.created_at,p.id AS publication_id,p.revision,false AS recorded_by_owner,
   a.status='pending' AND p.id IS NOT NULL AND coalesce(private.owner_approval_source_current(a),false) AS can_respond,
   CASE WHEN a.status<>'pending' THEN 'This earlier decision has no saved owner-reviewed narrative.'
    WHEN p.id IS NULL THEN 'ARHA must review and publish the owner-facing explanation before you can decide this request.'
    WHEN NOT coalesce(private.owner_approval_source_current(a),false) THEN 'The operational request changed. ARHA must reconcile it before you can decide.' END AS blocked_reason
  FROM public.approvals a JOIN public.properties h ON h.id=a.property_id
  LEFT JOIN LATERAL (SELECT x.* FROM public.owner_approval_publications x WHERE x.approval_id=a.id ORDER BY x.revision DESC LIMIT 1) latest ON true
  LEFT JOIN public.owner_approval_publications p ON p.id=latest.id AND p.approval_updated_at=a.updated_at AND p.property_id=a.property_id
   AND p.recipient_id=auth.uid() AND p.program_id=private.owner_approval_program(a) AND p.owner_record_id=h.owner_record_id
   AND p.entity_type=a.entity_type AND p.entity_id=a.entity_id
  WHERE a.approver_id=auth.uid() AND private.owner_approval_program(a) IS NOT NULL
   AND a.status IN('pending','approved','declined','changes_requested','cancelled','withdrawn')
   AND NOT EXISTS(SELECT 1 FROM public.owner_approval_receipts r WHERE r.approval_id=a.id)
 ), rows AS (SELECT * FROM historical UNION ALL SELECT * FROM current_requests)
 SELECT r.id,jsonb_build_object('id',r.id,'updated_at',r.updated_at,'kind',r.kind,'title',r.title,'detail',r.detail,'amount',r.amount,'currency',r.currency,
  'status',r.status,'decision_note',r.decision_note,'decided_at',r.decided_at,'due_on',r.due_on,'evidence_url',NULL,'property_id',r.property_id,
  'property_name',r.property_name,'active_owner',true,'created_at',r.created_at,'publication_id',r.publication_id,'revision',r.revision,
  'recorded_by_owner',r.recorded_by_owner,'can_respond',r.can_respond,'blocked_reason',r.blocked_reason)
 FROM rows r ORDER BY r.created_at DESC,r.id
$$;
REVOKE ALL ON FUNCTION public.read_owner_approvals() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_owner_approvals() TO authenticated;

-- Fail before removing old policies if this migration would create an elevated
-- owner endpoint under an application role or lose the trusted delegate chain.
DO $$ DECLARE writer_owner oid; BEGIN
 SELECT proowner INTO writer_owner FROM pg_proc WHERE oid='public.respond_owner_approval(uuid,uuid,timestamptz,boolean,text)'::regprocedure;
 IF writer_owner::regrole::text IN('anon','authenticated','service_role','authenticator')
  OR writer_owner IS DISTINCT FROM (SELECT proowner FROM pg_proc WHERE oid='public.record_versioned_owner_response(uuid,uuid,timestamptz,boolean,text)'::regprocedure)
  OR EXISTS(SELECT 1 FROM pg_proc WHERE oid IN(
   'public.read_owner_approvals()'::regprocedure,'public.publish_owner_approval(uuid,timestamptz,integer,uuid,uuid,uuid,text,text,boolean)'::regprocedure,
   'public.respond_owner_approval(uuid,uuid,timestamptz,boolean,text)'::regprocedure) AND (NOT prosecdef OR proowner<>writer_owner)) THEN
  RAISE EXCEPTION 'Owner approval boundary requires one trusted non-application function owner and the existing canonical response delegate. No ownership is changed by this migration.';
 END IF;
END $$;
DROP POLICY "Owners read their own approvals" ON public.approvals;
DROP POLICY "Owners decide their own pending approvals" ON public.approvals;
DROP POLICY approvals_update_decider ON public.approvals;
CREATE POLICY approvals_update_decider ON public.approvals FOR UPDATE TO authenticated
 USING(public.is_internal_staff(auth.uid()) AND (public.is_supervisor(auth.uid()) OR approver_id=auth.uid()))
 WITH CHECK(public.is_internal_staff(auth.uid()) AND (public.is_supervisor(auth.uid()) OR approver_id=auth.uid()));

-- A narrow checked helper keeps the existing Work Order preparation writer
-- SECURITY INVOKER and subject to its source RLS while locking private account roles.
CREATE FUNCTION private.work_order_owner_recipient(_work_order_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE wo public.work_orders; home public.properties; owner public.property_owners; program public.owner_programs;
 recipient uuid; recipient_count integer:=0;
BEGIN
 PERFORM 1 FROM auth.users WHERE id=auth.uid() AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now()) FOR SHARE NOWAIT;
 IF NOT FOUND OR NOT coalesce(public.is_internal_staff(auth.uid()),false) THEN RAISE EXCEPTION 'An enabled staff account is required to review the owner recipient.'; END IF;
 PERFORM 1 FROM public.user_roles WHERE user_id=auth.uid() FOR SHARE NOWAIT;
 IF NOT coalesce(public.is_internal_staff(auth.uid()),false) THEN RAISE EXCEPTION 'Staff access changed. Refresh the Work Order.'; END IF;
 SELECT * INTO wo FROM public.work_orders WHERE id=_work_order_id FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'The Work Order is not available.'; END IF;
 SELECT * INTO home FROM public.properties WHERE id=wo.property_id FOR SHARE NOWAIT;
 SELECT * INTO owner FROM public.property_owners WHERE id=home.owner_record_id FOR SHARE NOWAIT;
 IF home.id IS NULL OR home.archived_at IS NOT NULL OR home.is_demo IS DISTINCT FROM wo.is_demo OR owner.id IS NULL OR NOT owner.active THEN
  RAISE EXCEPTION 'The Work Order requires its current canonical Owner and Property.';
 END IF;
 -- Reuse current canonical Property/account eligibility, including target_reached.
 -- No free-text contact or caller-selected portal user determines the recipient.
 FOR program IN SELECT p.* FROM public.owner_programs p
  WHERE p.owner_record_id=owner.id AND p.is_demo=wo.is_demo
   AND private.owner_current_property_for_actor(p.owner_user_id,home.id,p.id)
  ORDER BY p.id FOR SHARE NOWAIT LOOP
  PERFORM 1 FROM public.owner_program_properties e WHERE e.program_id=program.id AND e.property_id=home.id FOR SHARE NOWAIT;
  PERFORM 1 FROM auth.users WHERE id=program.owner_user_id FOR SHARE NOWAIT;
  PERFORM 1 FROM public.user_roles WHERE user_id=program.owner_user_id FOR SHARE NOWAIT;
  IF NOT private.owner_current_property_for_actor(program.owner_user_id,home.id,program.id) THEN
   RAISE EXCEPTION 'The eligible owner recipient changed. Refresh the Work Order before requesting approval.';
  END IF;
  recipient_count:=recipient_count+1;
  IF recipient_count>1 THEN RAISE EXCEPTION 'This Property has more than one eligible owner program. Reconcile canonical enrollment before requesting approval.'; END IF;
  recipient:=program.owner_user_id;
 END LOOP;

 RETURN recipient;
EXCEPTION WHEN lock_not_available THEN RAISE EXCEPTION 'The Work Order or owner enrollment is being updated. Refresh before requesting approval.';
END $$;
REVOKE ALL ON FUNCTION private.work_order_owner_recipient(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION private.work_order_owner_recipient(uuid) TO authenticated,service_role;
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_proc WHERE oid='private.work_order_owner_recipient(uuid)'::regprocedure AND
  (NOT prosecdef OR proowner IS DISTINCT FROM (SELECT proowner FROM pg_proc WHERE oid='public.publish_owner_approval(uuid,timestamptz,integer,uuid,uuid,uuid,text,text,boolean)'::regprocedure))) THEN
  RAISE EXCEPTION 'The checked owner recipient helper must share the trusted approval publication owner.';
 END IF;
END $$;


-- Unapplied. Existing staff table permissions/RLS remain in force.
CREATE OR REPLACE FUNCTION public.prepare_work_order_owner_approval(
 _work_order_id uuid, _expected_updated_at timestamptz, _owner_summary text
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE wo public.work_orders%ROWTYPE; home public.properties%ROWTYPE;
 owner public.property_owners%ROWTYPE;
 publication_context jsonb; request_id uuid; recipient uuid; summary text := trim(coalesce(_owner_summary,''));
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_internal_staff(auth.uid()) THEN
  RAISE EXCEPTION 'You do not have access to request this decision.';
 END IF;
 IF length(summary) NOT BETWEEN 20 AND 4000 THEN
  RAISE EXCEPTION 'Explain the repair and proposed work for the owner in 20–4,000 characters.';
 END IF;
 SELECT * INTO wo FROM public.work_orders WHERE id=_work_order_id FOR UPDATE;
 IF NOT FOUND OR wo.closed_at IS NOT NULL THEN RAISE EXCEPTION 'This Work Order is not available for an approval request.'; END IF;
 IF _expected_updated_at IS NULL OR wo.updated_at IS DISTINCT FROM _expected_updated_at THEN
  RAISE EXCEPTION 'The Work Order changed. Refresh before requesting approval.';
 END IF;
 IF wo.approval_id IS NOT NULL OR wo.approval_status IN ('pending','approved') OR EXISTS(
  SELECT 1 FROM public.approvals WHERE entity_type='work_order' AND entity_id=wo.id AND approver_role='owner' AND status='pending'
 ) THEN RAISE EXCEPTION 'An owner approval already exists. Review it before requesting another.'; END IF;
 IF wo.quote_amount IS NULL OR wo.quote_amount<0 OR wo.quote_amount::text IN ('NaN','Infinity','-Infinity') THEN
  RAISE EXCEPTION 'Record a valid quote before requesting approval.';
 END IF;
 SELECT * INTO home FROM public.properties WHERE id=wo.property_id FOR SHARE;
 IF NOT FOUND OR home.owner_record_id IS NULL OR home.is_demo IS DISTINCT FROM wo.is_demo THEN
  RAISE EXCEPTION 'The Work Order requires a current canonical Owner and Property.';
 END IF;
 SELECT * INTO owner FROM public.property_owners WHERE id=home.owner_record_id FOR SHARE;
 IF NOT FOUND OR NOT owner.active THEN RAISE EXCEPTION 'The canonical Owner is not active.'; END IF;
 IF wo.ticket_id IS NOT NULL THEN
  PERFORM id FROM public.tickets WHERE id=wo.ticket_id AND property_id=home.id AND is_demo=wo.is_demo FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The Work Order Ticket no longer matches this Property.'; END IF;
 END IF;
 recipient:=private.work_order_owner_recipient(wo.id);
 INSERT INTO public.approvals(entity_type,entity_id,property_id,kind,title,detail,amount,
  requested_by,approver_role,approver_id,status,is_demo)
 VALUES('work_order',wo.id,home.id,'maintenance_owner_approval','Owner approval — property repair',summary,wo.quote_amount,
  auth.uid(),'owner',recipient,'pending',wo.is_demo) RETURNING id INTO request_id;
 UPDATE public.work_orders SET approval_id=request_id,approval_status='pending',
  approval_requested_at=now(),approval_requested_by=auth.uid() WHERE id=wo.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'The approval could not be linked to its Work Order.'; END IF;
 INSERT INTO public.work_order_events(work_order_id,author_id,event_type,body,detail,is_demo)
 VALUES(wo.id,auth.uid(),'owner_approval_requested','Owner approval requested',
  jsonb_build_object('approval_id',request_id,'work_order_id',wo.id,'ticket_id',wo.ticket_id,
   'property_id',home.id,'owner_record_id',owner.id,'quote_amount',wo.quote_amount,
   'policy_version',wo.policy_version,'work_order_snapshot',to_jsonb(wo)),wo.is_demo);
 -- This existing action already requires an explicit owner-safe summary. Publish
 -- it atomically only when a canonical, eligible portal recipient is available.
 publication_context:=public.read_owner_approval_publication_context(request_id);
 IF (publication_context->>'canPublish')::boolean THEN
  PERFORM public.publish_owner_approval(request_id,(publication_context->>'expectedUpdatedAt')::timestamptz,
   (publication_context->>'expectedRevision')::integer,(publication_context->>'ownerId')::uuid,
   (publication_context->>'programId')::uuid,(publication_context->>'recipientId')::uuid,
   'Owner approval — property repair',summary,true);
 END IF;
 RETURN request_id;
END $$;
REVOKE ALL ON FUNCTION public.prepare_work_order_owner_approval(uuid,timestamptz,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.prepare_work_order_owner_approval(uuid,timestamptz,text) TO authenticated,service_role;
