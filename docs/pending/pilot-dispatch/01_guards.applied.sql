-- STAGED ONLY. Apply separately after approval. Existing functions and ACLs are not replaced.
CREATE TABLE public.breezeway_sending_settings (
 id boolean PRIMARY KEY DEFAULT true CHECK (id),
 mode text NOT NULL DEFAULT 'all_verified' CHECK (mode IN ('all_verified','pilot_only')),
 home_ids uuid[] NOT NULL DEFAULT '{}', updated_by uuid, updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.breezeway_sending_settings TO authenticated;
GRANT ALL ON public.breezeway_sending_settings TO service_role;
ALTER TABLE public.breezeway_sending_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.breezeway_sending_settings FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TABLE public.breezeway_sending_history (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid NOT NULL,
 before_value jsonb NOT NULL, after_value jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.breezeway_sending_history TO authenticated;
GRANT ALL ON public.breezeway_sending_history TO service_role;
ALTER TABLE public.breezeway_sending_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY admin_read ON public.breezeway_sending_history FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE FUNCTION public.save_breezeway_sending(_mode text, _home_ids uuid[]) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE old_value jsonb; new_value jsonb;
BEGIN
 IF NOT coalesce(public.has_role(auth.uid(),'admin'),false) THEN RAISE EXCEPTION 'Only an Admin can change Breezeway sending.'; END IF;
 IF _mode IS NULL OR _mode NOT IN ('all_verified','pilot_only') OR _home_ids IS NULL THEN RAISE EXCEPTION 'Choose a valid sending mode and home list.'; END IF;
 IF EXISTS(SELECT 1 FROM unnest(_home_ids) h WHERE h IS NULL OR NOT EXISTS(SELECT 1 FROM public.properties p WHERE p.id=h AND NOT p.is_demo AND p.archived_at IS NULL)) THEN RAISE EXCEPTION 'Choose existing non-demo homes.'; END IF;
 PERFORM pg_advisory_xact_lock(736341);
 SELECT jsonb_build_object('mode',mode,'homeIds',home_ids) INTO old_value FROM public.breezeway_sending_settings WHERE id FOR UPDATE;
 old_value:=coalesce(old_value,'{"mode":"all_verified","homeIds":[]}'::jsonb);
 new_value:=jsonb_build_object('mode',_mode,'homeIds',_home_ids);
 INSERT INTO public.breezeway_sending_settings(id,mode,home_ids,updated_by) VALUES(true,_mode,_home_ids,auth.uid())
 ON CONFLICT(id) DO UPDATE SET mode=excluded.mode,home_ids=excluded.home_ids,updated_by=excluded.updated_by,updated_at=now();
 INSERT INTO public.breezeway_sending_history(actor_id,before_value,after_value) VALUES(auth.uid(),old_value,new_value);
END $$;
REVOKE ALL ON FUNCTION public.save_breezeway_sending(text,uuid[]) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_breezeway_sending(text,uuid[]) TO authenticated;

ALTER TABLE public.breezeway_outbound_tasks ADD COLUMN dispatch_guarded boolean NOT NULL DEFAULT false;
CREATE FUNCTION public.guard_pilot_dispatch() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
DECLARE wo public.work_orders%ROWTYPE; person bigint; appt timestamptz; ticket_home uuid;
BEGIN
 IF EXISTS(SELECT 1 FROM public.breezeway_sending_settings WHERE id AND mode='pilot_only' AND NOT (NEW.property_id=ANY(home_ids))) THEN RAISE EXCEPTION 'This home is not in the Breezeway pilot yet'; END IF;
 IF NOT NEW.dispatch_guarded THEN RETURN NEW; END IF;
 IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Integration access required.'; END IF;
 SELECT * INTO wo FROM public.work_orders WHERE id=NEW.work_order_id FOR UPDATE;
 SELECT property_id INTO ticket_home FROM public.tickets WHERE id=NEW.ticket_id;
 IF wo.id IS NULL OR NEW.source_type<>'ticket' OR wo.ticket_id IS DISTINCT FROM NEW.ticket_id OR wo.property_id IS DISTINCT FROM NEW.property_id OR ticket_home IS DISTINCT FROM NEW.property_id THEN RAISE EXCEPTION 'The selected Work Order does not belong to this Ticket and home.'; END IF;
 IF wo.closed_at IS NOT NULL OR wo.phase IN ('closed','cancelled','canceled') THEN RAISE EXCEPTION 'This Work Order is closed or cancelled. Nothing was sent.'; END IF;
 IF wo.dispatched_at IS NOT NULL OR wo.breezeway_handoff_status NOT IN ('not_sent','failed') OR EXISTS(SELECT 1 FROM public.breezeway_outbound_tasks WHERE work_order_id=wo.id AND status IN ('creating','needs_review','created','synced')) THEN RAISE EXCEPTION 'This Work Order was already dispatched or is awaiting review.'; END IF;
 IF wo.authorization_stale OR wo.approval_status IN ('pending','declined','info_requested') OR wo.supervisor_approval_status IN ('pending','declined','info_requested') THEN RAISE EXCEPTION 'Current authorization is required before sending.'; END IF;
 SELECT v.breezeway_person_id::bigint INTO person FROM public.work_order_vendor_candidates c JOIN public.vendor_orgs v ON v.id=c.vendor_org_id WHERE c.work_order_id=wo.id AND c.status='accepted' AND c.vendor_org_id=wo.vendor_org_id FOR SHARE OF c,v;
 IF person IS NULL OR person<=0 THEN RAISE EXCEPTION 'The accepted vendor has no Breezeway person mapping. Add the mapping before sending.'; END IF;
 appt:=wo.scheduled_for;
 IF appt IS NULL THEN RAISE EXCEPTION 'The agreed appointment date and time are missing. Set the appointment before sending.'; END IF;
 IF NEW.assignee_ids IS DISTINCT FROM ARRAY[person]::integer[] OR NEW.scheduled_date IS DISTINCT FROM (appt AT TIME ZONE 'America/Chicago')::date OR NEW.scheduled_time IS DISTINCT FROM to_char(appt AT TIME ZONE 'America/Chicago','HH24:MI:SS') THEN RAISE EXCEPTION 'The accepted vendor or appointment changed. Refresh the Work Order before sending.'; END IF;
 UPDATE public.work_orders SET breezeway_handoff_status='uncertain',breezeway_request_key=NEW.request_key,breezeway_handoff_at=now(),breezeway_handoff_error='Sending to Breezeway. Reconcile before retrying.' WHERE id=wo.id;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_pilot_dispatch() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_pilot_dispatch BEFORE INSERT ON public.breezeway_outbound_tasks FOR EACH ROW EXECUTE FUNCTION public.guard_pilot_dispatch();

CREATE FUNCTION public.guard_pilot_dispatch_close() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 -- Work Order UPDATE owns the same row lock used by the reservation INSERT.
 IF EXISTS(SELECT 1 FROM public.breezeway_outbound_tasks WHERE work_order_id=OLD.id AND dispatch_guarded AND status IN ('creating','needs_review')) AND
 (TG_OP='DELETE' OR NEW.closed_at IS DISTINCT FROM OLD.closed_at OR NEW.phase IS DISTINCT FROM OLD.phase OR NEW.ticket_id IS DISTINCT FROM OLD.ticket_id OR NEW.property_id IS DISTINCT FROM OLD.property_id OR NEW.vendor_org_id IS DISTINCT FROM OLD.vendor_org_id OR NEW.scheduled_for IS DISTINCT FROM OLD.scheduled_for OR NEW.scope IS DISTINCT FROM OLD.scope OR NEW.quote_amount IS DISTINCT FROM OLD.quote_amount OR NEW.approval_status IS DISTINCT FROM OLD.approval_status OR NEW.supervisor_approval_status IS DISTINCT FROM OLD.supervisor_approval_status) THEN
 RAISE EXCEPTION 'Breezeway sending is in progress or uncertain. Reconcile it before closing or changing this Work Order.'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_pilot_dispatch_close() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_pilot_dispatch_close BEFORE UPDATE OR DELETE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION public.guard_pilot_dispatch_close();
CREATE FUNCTION public.finish_pilot_dispatch() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,public AS $$
BEGIN
 IF NEW.dispatch_guarded AND NEW.status IS DISTINCT FROM OLD.status THEN
 UPDATE public.work_orders SET breezeway_handoff_status=CASE WHEN NEW.status IN ('created','synced') THEN 'sent' WHEN NEW.status IN ('error','abandoned') THEN 'failed' ELSE 'uncertain' END,
 breezeway_task_ref=coalesce(breezeway_task_ref,NEW.breezeway_task_id::text),breezeway_handoff_error=CASE WHEN NEW.status IN ('created','synced') THEN NULL ELSE coalesce(NEW.error_message,NEW.review_note,'Reconciled as not created.') END WHERE id=NEW.work_order_id;
 END IF; RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.finish_pilot_dispatch() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER finish_pilot_dispatch AFTER UPDATE ON public.breezeway_outbound_tasks FOR EACH ROW EXECUTE FUNCTION public.finish_pilot_dispatch();
CREATE FUNCTION public.pilot_dispatch_ready() RETURNS boolean LANGUAGE sql STABLE SET search_path=pg_catalog AS $$ SELECT true $$;
REVOKE ALL ON FUNCTION public.pilot_dispatch_ready() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.pilot_dispatch_ready() TO service_role;
