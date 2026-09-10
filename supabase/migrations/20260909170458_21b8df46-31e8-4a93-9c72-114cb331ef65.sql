CREATE OR REPLACE FUNCTION public.seed_qa_work_order_fixture(_actor uuid DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  actor uuid := COALESCE(auth.uid(), _actor);
  p_id uuid;
  t_id uuid;
  wo_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only a Platform Admin can seed the QA fixture.';
  END IF;

  SELECT id INTO t_id FROM public.tickets
   WHERE is_demo AND title = 'QA — PR7 Work Order Acceptance Ticket' AND archived_at IS NULL
   ORDER BY created_at DESC LIMIT 1;
  IF t_id IS NOT NULL THEN
    RETURN;
  END IF;

  SELECT id INTO p_id FROM public.properties
   WHERE is_demo AND name = 'QA — PR7 Work Order Fixture Home' LIMIT 1;
  IF p_id IS NULL THEN
    INSERT INTO public.properties (name, is_demo)
    VALUES ('QA — PR7 Work Order Fixture Home', true)
    RETURNING id INTO p_id;
  END IF;

  INSERT INTO public.tickets
    (title, description, category, priority, status, record_type, property_id, assigned_to, created_by, is_demo)
  VALUES
    ('QA — PR7 Work Order Acceptance Ticket',
     'QA/demo fixture for PR #7 Work Order acceptance only: Ticket <-> Work Order navigation, Send for Repair, and Work Order completion. Not part of seed_demo_environment — safe to archive independently.',
     'maintenance', 'p2', 'in_progress', 'active_task', p_id, actor, actor, true)
  RETURNING id INTO t_id;

  INSERT INTO public.work_orders
    (ticket_id, property_id, title, scope, service_category, priority, phase, assigned_to, created_by, is_demo)
  VALUES
    (t_id, p_id, 'QA — PR7 Work Order Acceptance Fixture',
     'QA/demo fixture repair for PR #7 Work Order acceptance testing only.',
     'general', 'p2', 'permanent', actor, actor, true)
  RETURNING id INTO wo_id;

  INSERT INTO public.work_order_events (work_order_id, author_id, event_type, body, is_demo)
  VALUES (wo_id, actor, 'created', 'QA fixture Work Order opened for PR #7 acceptance testing.', true);
END; $function$;

REVOKE ALL ON FUNCTION public.seed_qa_work_order_fixture(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_qa_work_order_fixture(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.archive_qa_work_order_fixture(_actor uuid DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE who uuid := COALESCE(auth.uid(), _actor);
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only a Platform Admin can manage the QA fixture.';
  END IF;

  UPDATE public.work_orders
     SET closed_at = COALESCE(closed_at, now()),
         closed_by = COALESCE(closed_by, who),
         closure_note = COALESCE(closure_note, 'QA fixture archived by admin')
   WHERE is_demo AND closed_at IS NULL
     AND ticket_id IN (
       SELECT id FROM public.tickets WHERE title = 'QA — PR7 Work Order Acceptance Ticket'
     );

  UPDATE public.tickets
     SET archived_at = COALESCE(archived_at, now()),
         archive_reason = COALESCE(archive_reason, 'QA fixture archived by admin'),
         archived_by = COALESCE(archived_by, who)
   WHERE is_demo AND archived_at IS NULL
     AND title = 'QA — PR7 Work Order Acceptance Ticket';
END; $function$;

REVOKE ALL ON FUNCTION public.archive_qa_work_order_fixture(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_qa_work_order_fixture(uuid) TO service_role;