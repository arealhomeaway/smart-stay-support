-- Adds a demo Work Order scenario to the admin-triggered demo seed, closing a
-- QA gap: previewing the canonical Work Order screens (item #9 of the ops
-- structural correction pass) had no seeded fixture to open. Follows the
-- exact pattern already used for onboarding and owner-program: a dedicated
-- stage function, called alongside seed_demo_environment/reset_demo_environment,
-- fully demo-flagged (is_demo = true), no real vendor and no external
-- dispatch — this is a plain INSERT, and work_orders has no insert trigger
-- (notify_work_order_events_trg only fires on UPDATE), so nothing here can
-- reach Breezeway or any other live integration.

CREATE OR REPLACE FUNCTION public.seed_demo_work_order(_actor uuid DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  actor uuid := COALESCE(auth.uid(), _actor);
  t_ac uuid;
  v_hvac uuid;
  wo_id uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only a Platform Admin can seed the demo environment.';
  END IF;

  -- Rides on the AC ticket the base scenario already seeds (ref 900000):
  -- an open P1 guest-occupied emergency is the clearest case for showing an
  -- open Resolve Work Order with an active vendor dispatch.
  SELECT id INTO t_ac FROM public.tickets WHERE is_demo AND ref = 900000 LIMIT 1;
  IF t_ac IS NULL THEN
    -- The base scenario hasn't been (re)seeded yet — nothing safe to link to.
    RETURN;
  END IF;

  -- Idempotent like the other seed stages: skip if this ticket already has
  -- an open demo Work Order (the DB also enforces one open Work Order per
  -- ticket via work_orders_one_open_per_ticket).
  IF EXISTS (
    SELECT 1 FROM public.work_orders WHERE ticket_id = t_ac AND closed_at IS NULL
  ) THEN
    RETURN;
  END IF;

  SELECT id INTO v_hvac FROM public.vendor_orgs
   WHERE is_demo AND display_name = 'DEMO — Music City Air & Heat' LIMIT 1;

  INSERT INTO public.work_orders
    (ticket_id, property_id, title, scope, service_category, priority, phase,
     authority_level, approval_status,
     vendor_org_id, vendor_name, vendor_contacted_at, vendor_acknowledged_at,
     scheduled_for, vendor_eta_at,
     temporary_mitigation, permanent_repair_needed,
     occupied_now, guest_notified_at,
     assigned_to, created_by, is_demo)
  SELECT
    t_ac, t.property_id, 'DEMO — Replace AC compressor',
    'Bedroom mini-split will not cool below 80°F with a guest in residence. Diagnose and repair; guest given fans in the meantime.',
    'HVAC', 'p1', 'mitigation',
    'emergency', 'not_required',
    v_hvac, 'DEMO — Music City Air & Heat', now() - interval '22 hours', now() - interval '21 hours',
    now() + interval '2 hours', now() + interval '2 hours',
    'Two fans provided to the guest; thermostat and filter checked and cleared.', true,
    true, now() - interval '18 hours',
    actor, actor, true
  FROM public.tickets t WHERE t.id = t_ac
  RETURNING id INTO wo_id;

  IF wo_id IS NOT NULL THEN
    INSERT INTO public.work_order_events (work_order_id, author_id, event_type, body, is_demo)
    VALUES
      (wo_id, actor, 'created', 'Work Order opened from the ticket — demo HVAC partner dispatched.', true),
      (wo_id, actor, 'vendor_dispatched', 'DEMO — Music City Air & Heat acknowledged and scheduled a 2-hour window.', true);
  END IF;
END; $function$;

REVOKE ALL ON FUNCTION public.seed_demo_work_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo_work_order(uuid) TO service_role;

-- Archiving mirrors archive_demo_environment: close the demo Work Order
-- instead of deleting it, keeping the same never-delete demo convention.
CREATE OR REPLACE FUNCTION public.archive_demo_work_order(_actor uuid DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE who uuid := COALESCE(auth.uid(), _actor);
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only a Platform Admin can manage the demo environment.';
  END IF;

  UPDATE public.work_orders
     SET closed_at = COALESCE(closed_at, now()),
         closed_by = COALESCE(closed_by, who),
         closure_note = COALESCE(closure_note, 'Demo environment archived by admin')
   WHERE is_demo AND closed_at IS NULL;
END; $function$;

REVOKE ALL ON FUNCTION public.archive_demo_work_order(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.archive_demo_work_order(uuid) TO service_role;
