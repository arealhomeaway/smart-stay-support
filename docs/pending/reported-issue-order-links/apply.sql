CREATE TABLE public.reported_issue_order_links (
 ticket_id uuid NOT NULL REFERENCES public.tickets(id),
 work_order_id uuid NOT NULL REFERENCES public.breezeway_work_orders(id),
 linked_by uuid NOT NULL,
 linked_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(ticket_id,work_order_id)
);
GRANT SELECT ON public.reported_issue_order_links TO authenticated;
GRANT ALL ON public.reported_issue_order_links TO service_role;
ALTER TABLE public.reported_issue_order_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read linked reported issues" ON public.reported_issue_order_links FOR SELECT TO authenticated USING (public.is_staff(auth.uid()) AND EXISTS (SELECT 1 FROM public.tickets t WHERE t.id=ticket_id));

CREATE FUNCTION public.link_reported_issues_breezeway_order(_ticket_ids uuid[],_work_order_id uuid DEFAULT NULL,_task_number bigint DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public,private AS $$
DECLARE actor uuid:=auth.uid(); ids uuid[]; t public.tickets; w public.breezeway_work_orders; home uuid; demo boolean; changed int:=0;
BEGIN
 IF actor IS NULL OR NOT public.is_staff(actor) THEN RAISE EXCEPTION 'Only Resolve staff can link Breezeway work orders.'; END IF;
 SELECT array_agg(DISTINCT i ORDER BY i) INTO ids FROM unnest(_ticket_ids) i;
 IF coalesce(cardinality(ids),0)<2 OR cardinality(ids)>100 THEN RAISE EXCEPTION 'Choose between 2 and 100 reported issues.'; END IF;
 -- Lock every issue in stable order; membership and existing authority are checked inside the transaction.
 FOR t IN SELECT * FROM public.tickets WHERE id=ANY(ids) ORDER BY id FOR UPDATE LOOP
   IF NOT private.can_edit_ticket(actor,t.id) OR (private.is_synthetic_account() AND NOT t.is_demo) THEN RAISE EXCEPTION 'You cannot change every issue in this row.'; END IF;
   IF t.archived_at IS NOT NULL OR t.status IN ('closed','resolved') OR lower(coalesce(t.external_source,''))<>'breezeway' OR t.property_id IS NULL THEN RAISE EXCEPTION 'Every issue must be open at the same home.'; END IF;
   IF home IS NULL THEN home:=t.property_id; demo:=t.is_demo; ELSIF home<>t.property_id OR demo IS DISTINCT FROM t.is_demo THEN RAISE EXCEPTION 'Every issue must be open at the same home.'; END IF;
   changed:=changed+1;
 END LOOP;
 IF changed<>cardinality(ids) THEN RAISE EXCEPTION 'An issue could not be found. Nothing was linked.'; END IF;
 SELECT * INTO w FROM public.breezeway_work_orders WHERE (_work_order_id IS NOT NULL AND id=_work_order_id) OR (_work_order_id IS NULL AND breezeway_task_id=_task_number) FOR UPDATE;
 IF w.id IS NULL THEN RAISE EXCEPTION 'That work order is not in the home list yet.'; END IF;
 IF w.property_id IS DISTINCT FROM home OR w.stage='deleted' THEN RAISE EXCEPTION 'That work order belongs to another home.'; END IF;
 IF w.linked_ticket_id IS NOT NULL AND NOT w.linked_ticket_id=ANY(ids) THEN RAISE EXCEPTION 'That Breezeway work order is already on another ticket.'; END IF;
 IF EXISTS (SELECT 1 FROM public.reported_issue_order_links l WHERE l.work_order_id=w.id AND NOT l.ticket_id=ANY(ids)) THEN RAISE EXCEPTION 'That Breezeway work order is already on another row.'; END IF;
 -- Preserve the mirror's single-ticket pointer and bridge bookkeeping. New links are additive only.
 WITH added AS (
  INSERT INTO public.reported_issue_order_links(ticket_id,work_order_id,linked_by) SELECT i,w.id,actor FROM unnest(ids) i ON CONFLICT DO NOTHING RETURNING ticket_id
 ) INSERT INTO public.ticket_activity(ticket_id,author_id,kind,event_type,body,is_demo)
 SELECT ticket_id,actor,'note','breezeway_linked','Linked Breezeway work order '||w.breezeway_task_id||'.',demo FROM added;
 RETURN jsonb_build_object('ok',true,'workOrderId',w.id,'breezewayTaskId',w.breezeway_task_id);
END $$;
REVOKE ALL ON FUNCTION public.link_reported_issues_breezeway_order(uuid[],uuid,bigint) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.link_reported_issues_breezeway_order(uuid[],uuid,bigint) TO authenticated,service_role;
