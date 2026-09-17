CREATE TABLE public.ticket_owner_updates (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 ticket_id uuid NOT NULL REFERENCES public.tickets(id),
 property_id uuid NOT NULL REFERENCES public.properties(id),
 owner_record_id uuid NOT NULL REFERENCES public.property_owners(id),
 revision integer NOT NULL CHECK(revision > 0),
 issue text NOT NULL CHECK(length(trim(issue)) BETWEEN 10 AND 2000),
 work_performed text NOT NULL CHECK(length(trim(work_performed)) BETWEEN 10 AND 3000),
 outcome text NOT NULL CHECK(length(outcome) <= 2000),
 reviewed_by uuid NOT NULL,
 reviewed_at timestamptz NOT NULL DEFAULT now(),
 source_updated_at timestamptz NOT NULL,
 is_demo boolean NOT NULL,
 UNIQUE(ticket_id, revision)
);
ALTER TABLE public.ticket_owner_updates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ticket_owner_updates FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.ticket_owner_updates TO authenticated;
CREATE POLICY staff_read ON public.ticket_owner_updates FOR SELECT TO authenticated
 USING(public.is_internal_staff(auth.uid()));
-- Append-only to application roles. A service-only transaction owns inserts.
GRANT SELECT, INSERT ON public.ticket_owner_updates TO service_role;

CREATE OR REPLACE FUNCTION public.save_ticket_owner_update(
 _ticket_id uuid, _actor_id uuid, _expected_ticket_updated_at timestamptz,
 _expected_revision integer, _expected_owner_id uuid, _issue text, _work_performed text, _outcome text, _reviewed boolean
) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE t public.tickets; h public.properties; current_revision integer; result uuid;
BEGIN
 IF NOT coalesce(public.is_internal_staff(_actor_id),false) THEN RAISE EXCEPTION 'Only staff may review owner updates.'; END IF;
 IF _reviewed IS DISTINCT FROM true THEN RAISE EXCEPTION 'Review the update for owner visibility before saving.'; END IF;
 IF _issue IS NULL OR length(trim(_issue)) NOT BETWEEN 10 AND 2000 OR _work_performed IS NULL OR length(trim(_work_performed)) NOT BETWEEN 10 AND 3000 OR _outcome IS NULL OR length(_outcome)>2000 THEN RAISE EXCEPTION 'Provide an issue and work summary within the allowed lengths.'; END IF;
 SELECT * INTO t FROM public.tickets WHERE id=_ticket_id FOR UPDATE;
 IF NOT FOUND OR t.updated_at IS DISTINCT FROM _expected_ticket_updated_at THEN RAISE EXCEPTION 'The Ticket changed. Review it before saving the owner update.'; END IF;
 SELECT * INTO h FROM public.properties WHERE id=t.property_id FOR SHARE;
 IF NOT FOUND OR h.owner_record_id IS NULL OR h.owner_record_id IS DISTINCT FROM _expected_owner_id OR h.is_demo IS DISTINCT FROM t.is_demo THEN RAISE EXCEPTION 'The Ticket needs a current canonical Owner and Property.'; END IF;
 PERFORM 1 FROM public.property_owners WHERE id=h.owner_record_id AND active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'The canonical Owner is inactive.'; END IF;
 SELECT coalesce(max(revision),0) INTO current_revision FROM public.ticket_owner_updates WHERE ticket_id=t.id;
 IF _expected_revision IS DISTINCT FROM current_revision THEN RAISE EXCEPTION 'Another owner update was saved. Review it before saving yours.'; END IF;
 INSERT INTO public.ticket_owner_updates(ticket_id,property_id,owner_record_id,revision,issue,work_performed,outcome,reviewed_by,source_updated_at,is_demo)
 VALUES(t.id,h.id,h.owner_record_id,current_revision+1,trim(_issue),trim(_work_performed),trim(_outcome),_actor_id,t.updated_at,t.is_demo) RETURNING id INTO result;
 RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.save_ticket_owner_update(uuid,uuid,timestamptz,integer,uuid,text,text,text,boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_ticket_owner_update(uuid,uuid,timestamptz,integer,uuid,text,text,text,boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.read_owner_ticket_updates(_program_id uuid,_property_ids uuid[],_preview boolean DEFAULT false)
RETURNS TABLE(ticket_id uuid,property_id uuid,revision integer,issue text,work_performed text,outcome text,reviewed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
 SELECT DISTINCT ON (t.id) t.id,h.id,u.revision,u.issue,u.work_performed,u.outcome,u.reviewed_at
 FROM public.owner_programs p
 JOIN public.property_owners o ON o.id=p.owner_record_id AND o.active
 JOIN public.owner_program_properties e ON e.program_id=p.id AND e.inclusion_status='included'
 JOIN public.properties h ON h.id=e.property_id AND h.owner_record_id=o.id AND h.is_demo=p.is_demo
 JOIN public.tickets t ON t.property_id=h.id AND t.is_demo=p.is_demo
 JOIN public.ticket_owner_updates u ON u.ticket_id=t.id AND u.property_id=h.id AND u.owner_record_id=o.id AND u.is_demo=p.is_demo
 WHERE p.id=_program_id AND p.archived_at IS NULL AND h.id=ANY(_property_ids)
 AND cardinality(_property_ids) BETWEEN 1 AND 100 AND auth.uid() IS NOT NULL
 AND ((_preview IS TRUE AND public.has_role(auth.uid(),'admin')) OR (_preview IS FALSE AND p.owner_user_id=auth.uid() AND p.is_demo=false))
 ORDER BY t.id,u.revision DESC;
$$;
REVOKE ALL ON FUNCTION public.read_owner_ticket_updates(uuid,uuid[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_owner_ticket_updates(uuid,uuid[],boolean) TO authenticated;
