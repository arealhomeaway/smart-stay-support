-- Fixes a silent no-op in seed_demo_work_order (20260908000000).
--
-- seed_demo_environment archives the prior demo AC ticket (soft — sets
-- archived_at, never deletes) then inserts a fresh one, but does not check
-- for an existing ref=900000 row first, so a re-seed always produces a
-- second ticket sharing that ref. seed_demo_work_order's ticket lookup had
-- no ORDER BY and did not exclude archived rows, so on a re-seed it could
-- resolve to the old, archived ticket instead of the current one. Since
-- that stale ticket already had an open demo Work Order from the earlier
-- run, the idempotency guard below it saw an "existing" Work Order and
-- returned without creating one on the ticket actually visible today —
-- silently, with no error, which is why nothing appeared to happen.
--
-- Fix is contained to the lookup itself: exclude archived tickets and pick
-- the most recently created match. Everything else in the function
-- (idempotency check, insert, events) is unchanged.
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
  -- open Resolve Work Order with an active vendor dispatch. Excludes
  -- archived tickets and takes the most recent match, so a re-seed always
  -- resolves to the ticket that's actually current, not one archived by an
  -- earlier run.
  SELECT id INTO t_ac FROM public.tickets
   WHERE is_demo AND ref = 900000 AND archived_at IS NULL
   ORDER BY created_at DESC LIMIT 1;
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
