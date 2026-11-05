BEGIN;
CREATE TABLE public.help_ticket_bulk_updates (
 id uuid PRIMARY KEY, author_id uuid NOT NULL, request jsonb NOT NULL, receipt jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), notifications_started_at timestamptz
);
GRANT SELECT ON public.help_ticket_bulk_updates TO authenticated;
GRANT ALL ON public.help_ticket_bulk_updates TO service_role;
ALTER TABLE public.help_ticket_bulk_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY help_bulk_author_read ON public.help_ticket_bulk_updates FOR SELECT TO authenticated
 USING(author_id=auth.uid() AND (public.has_role(auth.uid(),'admin') OR public.is_director(auth.uid())));

CREATE FUNCTION public.bulk_update_help_tickets(_batch_id uuid,_tickets jsonb,_status text,_note text,_notify boolean DEFAULT false) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _actor uuid:=auth.uid(); _request jsonb; _prior help_ticket_bulk_updates; _row help_tickets; _expected text;
 _event uuid; _receipt jsonb; _out jsonb:='[]'; _author text; _now timestamptz:=now(); _count integer;
BEGIN
 IF _actor IS NULL OR NOT (public.has_role(_actor,'admin') OR public.is_director(_actor)) THEN RAISE EXCEPTION 'Only leadership can manage help tickets.'; END IF;
 IF _batch_id IS NULL OR _status IS NULL OR _status NOT IN ('new','reviewing','planned','in_progress','resolved','closed') THEN RAISE EXCEPTION 'Choose a valid status.'; END IF;
 IF jsonb_typeof(_tickets) IS DISTINCT FROM 'array' OR jsonb_array_length(_tickets)=0 THEN RAISE EXCEPTION 'Select at least one Help ticket.'; END IF;
 IF _note IS NULL OR length(trim(_note))>5000 OR _notify IS NULL THEN RAISE EXCEPTION 'The note is too long or notification choice is missing.'; END IF;
 _request:=jsonb_build_object('tickets',_tickets,'status',_status,'note',trim(_note),'notify',_notify);
 PERFORM pg_advisory_xact_lock(hashtext('help-bulk:'||_batch_id::text));
 SELECT * INTO _prior FROM help_ticket_bulk_updates WHERE id=_batch_id;
 IF FOUND THEN
  IF _prior.author_id<>_actor OR _prior.request<>_request THEN RAISE EXCEPTION 'This saved selection does not match. Refresh the list.'; END IF;
  RETURN _prior.receipt;
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(_tickets) t WHERE nullif(t->>'id','') IS NULL OR nullif(t->>'expectedUpdatedAt','') IS NULL) THEN RAISE EXCEPTION 'Ticket selection is incomplete.'; END IF;
 SELECT count(DISTINCT t->>'id') INTO _count FROM jsonb_array_elements(_tickets) t;
 IF _count<>jsonb_array_length(_tickets) THEN RAISE EXCEPTION 'Select each Help ticket only once.'; END IF;
 -- Deterministic row locks avoid deadlocks; validate every row before any write.
 PERFORM 1 FROM help_tickets WHERE id IN(SELECT (t->>'id')::uuid FROM jsonb_array_elements(_tickets) t) ORDER BY id FOR UPDATE;
 IF (SELECT count(*) FROM help_tickets WHERE id IN(SELECT (t->>'id')::uuid FROM jsonb_array_elements(_tickets) t))<>_count THEN RAISE EXCEPTION 'A selected Help ticket is missing. Refresh the list.'; END IF;
 FOR _row IN SELECT * FROM help_tickets WHERE id IN(SELECT (t->>'id')::uuid FROM jsonb_array_elements(_tickets) t) ORDER BY id LOOP
  SELECT t->>'expectedUpdatedAt' INTO _expected FROM jsonb_array_elements(_tickets) t WHERE t->>'id'=_row.id::text;
  IF _row.updated_at IS DISTINCT FROM _expected::timestamptz THEN RAISE EXCEPTION 'A selected Help ticket changed. Refresh the list before saving.'; END IF;
 END LOOP;
 SELECT coalesce(full_name,email,'ARHA leadership') INTO _author FROM profiles WHERE id=_actor;
 _author:=coalesce(_author,'ARHA leadership');
 FOR _row IN SELECT * FROM help_tickets WHERE id IN(SELECT (t->>'id')::uuid FROM jsonb_array_elements(_tickets) t) ORDER BY id LOOP
  UPDATE help_tickets SET status=_status,updated_at=_now,last_activity_at=_now WHERE id=_row.id;
  INSERT INTO help_ticket_events(ticket_id,kind,from_status,to_status,body,author_id,author_name)
   VALUES(_row.id,'status',_row.status,_status,nullif(trim(_note),''),_actor,_author) RETURNING id INTO _event;
  IF nullif(trim(_note),'') IS NOT NULL THEN
   INSERT INTO help_ticket_events(ticket_id,kind,body,author_id,author_name) VALUES(_row.id,CASE WHEN _notify THEN 'reply' ELSE 'note' END,trim(_note),_actor,_author);
  END IF;
  _out:=_out||jsonb_build_array(jsonb_build_object('id',_row.id,'ticket_number',_row.ticket_number,'submitted_by',_row.submitted_by,'submitter_email',_row.submitter_email,'description',_row.description,'status',_status,'event_id',_event));
 END LOOP;
 _receipt:=jsonb_build_object('batchId',_batch_id,'count',_count,'status',_status,'note',trim(_note),'notify',_notify,'tickets',_out);
 INSERT INTO help_ticket_bulk_updates(id,author_id,request,receipt) VALUES(_batch_id,_actor,_request,_receipt);
 RETURN _receipt;
END $$;
CREATE FUNCTION public.claim_help_bulk_notifications(_batch_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _saved help_ticket_bulk_updates;
BEGIN
 IF auth.uid() IS NULL OR NOT(public.has_role(auth.uid(),'admin') OR public.is_director(auth.uid())) THEN RAISE EXCEPTION 'Only leadership can manage help tickets.'; END IF;
 SELECT * INTO _saved FROM help_ticket_bulk_updates WHERE id=_batch_id AND author_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Saved bulk update not found.'; END IF;
 IF NOT (_saved.receipt->>'notify')::boolean OR _saved.notifications_started_at IS NOT NULL THEN RETURN false; END IF;
 UPDATE help_ticket_bulk_updates SET notifications_started_at=now() WHERE id=_batch_id;
 UPDATE help_ticket_events SET email_status='sending' WHERE id IN(SELECT (t->>'event_id')::uuid FROM jsonb_array_elements(_saved.receipt->'tickets') t);
 RETURN true;
END $$;
CREATE FUNCTION public.record_help_bulk_delivery(_batch_id uuid,_event_ids uuid[],_recipient text,_status text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE _saved help_ticket_bulk_updates;
BEGIN
 IF auth.uid() IS NULL OR NOT(public.has_role(auth.uid(),'admin') OR public.is_director(auth.uid())) THEN RAISE EXCEPTION 'Only leadership can manage help tickets.'; END IF;
 SELECT * INTO _saved FROM help_ticket_bulk_updates WHERE id=_batch_id AND author_id=auth.uid() AND notifications_started_at IS NOT NULL;
 IF NOT FOUND OR _status NOT IN('sent','failed','skipped') OR _status IS NULL THEN RAISE EXCEPTION 'Delivery result does not match a saved update.'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(_event_ids) e WHERE e NOT IN(SELECT (t->>'event_id')::uuid FROM jsonb_array_elements(_saved.receipt->'tickets') t)) THEN RAISE EXCEPTION 'Delivery result does not match these Help tickets.'; END IF;
 UPDATE help_ticket_events SET email_status=_status,email_recipient=_recipient WHERE id=ANY(_event_ids) AND email_status='sending';
END $$;
REVOKE ALL ON FUNCTION public.bulk_update_help_tickets(uuid,jsonb,text,text,boolean),public.claim_help_bulk_notifications(uuid),public.record_help_bulk_delivery(uuid,uuid[],text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bulk_update_help_tickets(uuid,jsonb,text,text,boolean),public.claim_help_bulk_notifications(uuid),public.record_help_bulk_delivery(uuid,uuid[],text,text) TO authenticated,service_role;
COMMIT;
