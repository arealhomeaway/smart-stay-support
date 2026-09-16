-- A reviewed owner request belongs to the immutable canonical Ticket narrative.
-- Existing revisions stay NULL/NULL; no private Ticket text is inferred or copied.
ALTER TABLE public.ticket_owner_updates
 ADD COLUMN owner_request_type text,
 ADD COLUMN owner_request_why text,
 ADD CONSTRAINT ticket_owner_updates_request CHECK(
  (owner_request_type IS NULL AND owner_request_why IS NULL)
  OR (owner_request_type IS NOT NULL AND owner_request_why IS NOT NULL
   AND owner_request_type IN ('review_comment','review_decide','provide_information','attend_respond','action_payment','information_only','research_recommend')
   AND length(trim(owner_request_why)) BETWEEN 10 AND 1000));

-- The older writer cannot clear an explicit request by omitting its fields.
DROP FUNCTION public.save_ticket_owner_update(uuid,uuid,timestamptz,integer,uuid,text,text,text,boolean);
CREATE FUNCTION public.save_ticket_owner_update(
 _ticket_id uuid, _actor_id uuid, _expected_ticket_updated_at timestamptz,
 _expected_revision integer, _expected_owner_id uuid, _issue text, _work_performed text, _outcome text, _reviewed boolean,
 _owner_request_type text, _owner_request_why text
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE t public.tickets; h public.properties; current_revision integer; result uuid;
BEGIN
 IF NOT coalesce(public.is_internal_staff(_actor_id),false) THEN RAISE EXCEPTION 'Only staff may review owner updates.'; END IF;
 IF _reviewed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Review the update for owner visibility before saving.'; END IF;
 IF _issue IS NULL OR length(trim(_issue)) NOT BETWEEN 10 AND 2000 OR _work_performed IS NULL OR length(trim(_work_performed)) NOT BETWEEN 10 AND 3000 OR _outcome IS NULL OR length(_outcome)>2000 THEN RAISE EXCEPTION 'Provide an issue and work summary within the allowed lengths.'; END IF;
 IF _owner_request_type IS NULL OR _owner_request_type NOT IN ('review_comment','review_decide','provide_information','attend_respond','action_payment','information_only','research_recommend')
  OR _owner_request_why IS NULL OR length(trim(_owner_request_why)) NOT BETWEEN 10 AND 1000 THEN
  RAISE EXCEPTION 'Choose the owner request and explain why it is needed. Financial approval is determined separately.';
 END IF;
 SELECT * INTO t FROM public.tickets WHERE id=_ticket_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR t.updated_at IS DISTINCT FROM _expected_ticket_updated_at THEN RAISE EXCEPTION 'The Ticket changed. Review it before saving the owner update.'; END IF;
 SELECT * INTO h FROM public.properties WHERE id=t.property_id FOR SHARE NOWAIT;
 IF NOT FOUND OR h.owner_record_id IS NULL OR h.owner_record_id IS DISTINCT FROM _expected_owner_id OR h.is_demo IS DISTINCT FROM t.is_demo OR h.archived_at IS NOT NULL THEN RAISE EXCEPTION 'The Ticket needs a current canonical Owner and Property.'; END IF;
 PERFORM 1 FROM public.property_owners WHERE id=h.owner_record_id AND active FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'The canonical Owner is inactive.'; END IF;
 SELECT coalesce(max(revision),0) INTO current_revision FROM public.ticket_owner_updates WHERE ticket_id=t.id;
 IF _expected_revision IS DISTINCT FROM current_revision THEN RAISE EXCEPTION 'Another owner update was saved. Review it before saving yours.'; END IF;
 INSERT INTO public.ticket_owner_updates(ticket_id,property_id,owner_record_id,revision,issue,work_performed,outcome,reviewed_by,source_updated_at,is_demo,owner_request_type,owner_request_why)
 VALUES(t.id,h.id,h.owner_record_id,current_revision+1,trim(_issue),trim(_work_performed),trim(_outcome),_actor_id,t.updated_at,t.is_demo,_owner_request_type,trim(_owner_request_why)) RETURNING id INTO result;
 RETURN result;
EXCEPTION WHEN lock_not_available THEN
 RAISE EXCEPTION 'The Ticket or owner update is being changed. Review current information and try again.';
END $$;
REVOKE ALL ON FUNCTION public.save_ticket_owner_update(uuid,uuid,timestamptz,integer,uuid,text,text,text,boolean,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.save_ticket_owner_update(uuid,uuid,timestamptz,integer,uuid,text,text,text,boolean,text,text) TO service_role;

CREATE FUNCTION public.preserve_ticket_owner_update() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 RAISE EXCEPTION 'Reviewed Ticket updates are immutable. Publish a new reviewed revision.';
END $$;
REVOKE ALL ON FUNCTION public.preserve_ticket_owner_update() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER preserve_ticket_owner_update BEFORE UPDATE OR DELETE ON public.ticket_owner_updates
 FOR EACH ROW EXECUTE FUNCTION public.preserve_ticket_owner_update();

DROP FUNCTION public.read_owner_ticket_updates(uuid,uuid[],boolean);
CREATE FUNCTION public.read_owner_ticket_updates(_program_id uuid,_property_ids uuid[],_preview boolean DEFAULT false)
RETURNS TABLE(ticket_id uuid,property_id uuid,revision integer,issue text,work_performed text,outcome text,reviewed_at timestamptz,owner_request_type text,owner_request_why text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT DISTINCT ON(t.id) t.id,h.id,u.revision,u.issue,u.work_performed,u.outcome,u.reviewed_at,u.owner_request_type,u.owner_request_why
 FROM private.owner_current_properties(_program_id,_property_ids,_preview) visible
 JOIN public.properties h ON h.id=visible.property_id
 JOIN public.owner_programs p ON p.id=_program_id
 JOIN public.tickets t ON t.property_id=h.id AND t.is_demo=p.is_demo
 JOIN public.ticket_owner_updates u ON u.ticket_id=t.id AND u.property_id=h.id AND u.owner_record_id=p.owner_record_id AND u.is_demo=p.is_demo
 ORDER BY t.id,u.revision DESC
$$;
REVOKE ALL ON FUNCTION public.read_owner_ticket_updates(uuid,uuid[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_owner_ticket_updates(uuid,uuid[],boolean) TO authenticated;

-- Corrections keep their early copy/return path; never re-read or reclassify old participation.
CREATE OR REPLACE FUNCTION public.capture_owner_time_update() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE original public.owner_time_entries; p public.owner_programs; u public.ticket_owner_updates;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.owner_update_revision IS DISTINCT FROM OLD.owner_update_revision OR NEW.owner_update_snapshot IS DISTINCT FROM OLD.owner_update_snapshot
   OR (OLD.owner_update_revision IS NOT NULL AND (NEW.ticket_id IS DISTINCT FROM OLD.ticket_id OR NEW.program_id IS DISTINCT FROM OLD.program_id OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id OR NEW.review_id IS DISTINCT FROM OLD.review_id OR NEW.is_demo IS DISTINCT FROM OLD.is_demo)) THEN
   RAISE EXCEPTION 'The reviewed owner update is immutable. Preserve it through a correction.';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.amends_entry_id IS NOT NULL THEN
  SELECT * INTO original FROM public.owner_time_entries WHERE id=NEW.amends_entry_id;
  IF NOT FOUND OR NEW.program_id IS DISTINCT FROM original.program_id OR NEW.owner_user_id IS DISTINCT FROM original.owner_user_id
   OR NEW.ticket_id IS DISTINCT FROM original.ticket_id OR NEW.review_id IS DISTINCT FROM original.review_id OR NEW.is_demo IS DISTINCT FROM original.is_demo THEN
   RAISE EXCEPTION 'A correction must preserve the original participation context.';
  END IF;
  NEW.owner_update_revision:=original.owner_update_revision;
  NEW.owner_update_snapshot:=original.owner_update_snapshot;
  RETURN NEW;
 END IF;
 NEW.owner_update_snapshot:=NULL;
 IF NEW.owner_update_revision IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO p FROM public.owner_programs WHERE id=NEW.program_id FOR UPDATE;
 IF NOT FOUND OR p.owner_user_id IS DISTINCT FROM NEW.owner_user_id OR p.owner_record_id IS NULL OR p.archived_at IS NOT NULL
  OR p.is_demo IS DISTINCT FROM NEW.is_demo OR p.status NOT IN ('active','target_reached') THEN RAISE EXCEPTION 'The reviewed update program is no longer eligible.'; END IF;
 SELECT * INTO u FROM public.ticket_owner_updates WHERE ticket_id=NEW.ticket_id AND revision=NEW.owner_update_revision;
 IF NOT FOUND OR u.owner_record_id IS DISTINCT FROM p.owner_record_id OR u.is_demo IS DISTINCT FROM p.is_demo OR NEW.entry_date < u.reviewed_at::date THEN
  RAISE EXCEPTION 'Choose the owner update you reviewed on this participation date.';
 END IF;
 PERFORM 1 FROM public.properties h JOIN public.owner_program_properties e ON e.property_id=h.id
  WHERE h.id=u.property_id AND h.owner_record_id=p.owner_record_id AND h.is_demo=p.is_demo AND e.program_id=p.id AND e.inclusion_status='included' FOR SHARE OF h,e;
 IF NOT FOUND THEN RAISE EXCEPTION 'The reviewed update Property is no longer included for this Owner.'; END IF;
 PERFORM 1 FROM public.property_owners WHERE id=p.owner_record_id AND active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'The canonical Owner is inactive.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.owner_reviews r WHERE r.id=NEW.review_id AND r.program_id=p.id AND r.ticket_id=u.ticket_id)
 OR NOT EXISTS(SELECT 1 FROM public.tickets t WHERE t.id=u.ticket_id AND t.property_id=u.property_id AND t.is_demo=p.is_demo) THEN
  RAISE EXCEPTION 'The reviewed update does not match this opportunity and Ticket.';
 END IF;
 NEW.owner_update_snapshot:=jsonb_build_object('revision',u.revision,'issue',u.issue,'work_performed',u.work_performed,'outcome',u.outcome,'reviewed_at',u.reviewed_at,'owner_request_type',u.owner_request_type,'owner_request_why',u.owner_request_why);
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.capture_owner_time_update() FROM PUBLIC,anon,authenticated;

-- Exact response revision; metadata is read from the reviewed row, never owner input.
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
REVOKE ALL ON FUNCTION public.read_owner_review_update(uuid,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_owner_review_update(uuid,integer) TO authenticated,service_role;
