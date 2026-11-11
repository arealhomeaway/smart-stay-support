-- Build 16 (Emily, Nov 11): answers, drift and small board fixes. Additive.
-- 1. B1, B2: two switches, OFF, that hide the retired Home buttons (Ready for arrival,
--    Finance packet delivered). Nothing else reads them.
-- 2. C2 (register A11): Direct Bookings settings are saved by Admin only. Only the
--    permission check changes; the rest is the live definition.
-- 3. A3: when a Breezeway work order linked to a ticket reaches finished (or is linked
--    while already finished), the ticket's next step becomes "Check the finished work" and
--    one history line is added. No clock, SLA, alert, routing or status changes; quiet
--    Notion imports, archived and closed tickets are left alone.

INSERT INTO public.feature_flags (key, label, description, enabled)
VALUES
  ('arrival_ready_button', 'Ready for arrival button',
   'The old per person Ready for arrival button on a home. Off: the arrival check replaces it.', false),
  ('finance_packet_button', 'Finance packet delivered button',
   'The old Finance packet delivered button on Home. Off: the weekly packet is retired.', false)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.save_direct_booking_settings(_value jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only Admin can change these settings.';
  END IF;
  INSERT INTO public.app_settings(key, value, updated_by, updated_at)
  VALUES ('direct_booking_settings', _value, auth.uid(), now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now();
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_label, after_value)
  VALUES (auth.uid(), 'direct_booking_settings_changed', 'app_settings', 'Direct Bookings settings', _value);
  RETURN public.direct_booking_settings();
END $function$;

CREATE OR REPLACE FUNCTION private.breezeway_finished_check_step()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _now_done boolean := lower(coalesce(NEW.stage, '')) = 'finished'
    OR lower(coalesce(NEW.status, '')) IN ('finished', 'approved', 'closed');
  _was_done boolean := TG_OP = 'UPDATE' AND (lower(coalesce(OLD.stage, '')) = 'finished'
    OR lower(coalesce(OLD.status, '')) IN ('finished', 'approved', 'closed'));
  _newly_linked boolean := TG_OP = 'UPDATE' AND OLD.linked_ticket_id IS DISTINCT FROM NEW.linked_ticket_id;
  _changed integer;
BEGIN
  IF NEW.linked_ticket_id IS NULL OR NOT _now_done OR (_was_done AND NOT _newly_linked) THEN
    RETURN NULL;
  END IF;
  UPDATE public.tickets t
     SET next_action = 'Check the finished work', next_action_due_at = NULL
   WHERE t.id = NEW.linked_ticket_id
     AND t.archived_at IS NULL
     AND t.resolved_at IS NULL
     AND t.status NOT IN ('resolved', 'closed')
     AND NOT (coalesce(t.external_source, '') = 'notion' AND t.external_status IS DISTINCT FROM 'reopened_in_resolve')
     AND t.next_action IS DISTINCT FROM 'Check the finished work';
  GET DIAGNOSTICS _changed = ROW_COUNT;
  IF _changed > 0 THEN
    INSERT INTO public.ticket_activity (ticket_id, author_id, kind, event_type, body, is_demo)
    SELECT NEW.linked_ticket_id, NULL, 'repair', 'breezeway_finished',
           'Breezeway work order ' || NEW.breezeway_task_id || ' is finished. Next step: Check the finished work.',
           coalesce(t.is_demo, false)
      FROM public.tickets t WHERE t.id = NEW.linked_ticket_id;
  END IF;
  RETURN NULL;
END $$;

REVOKE ALL ON FUNCTION private.breezeway_finished_check_step() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER breezeway_finished_check_step
  AFTER INSERT OR UPDATE OF status, stage, linked_ticket_id ON public.breezeway_work_orders
  FOR EACH ROW EXECUTE FUNCTION private.breezeway_finished_check_step();
