-- Ops structural correction pass.
--
-- Four independent, additive changes — no existing column is renamed or
-- dropped, no existing row's meaning changes:
--
-- 1. A real, seat-backed "Director of Operations" authority tier, so a
--    Supervisor can no longer decide an escalation raised to the Director.
-- 2. Ticket handoffs get a distinct accepted_by/accepted_at pair, so
--    accepting a handoff no longer overwrites who it was actually sent to.
-- 3. Demo-record isolation gets a real backend backstop: only a Platform
--    Owner (the only role that can ever enter "View As"/demo preview) may
--    write to an is_demo ticket. Everyone else's app-layer demo/live split
--    stays exactly as it was.
-- 4. The canonical repair record (work_orders) gets a uniqueness guard
--    (one open Work Order per Ticket) and a link column so an outbound
--    Breezeway task can point back at the Work Order it was dispatched
--    from, instead of standing alone as a second, disconnected record.

-- ---------------------------------------------------------------------
-- 1. Director authority
--
-- "Director of Operations" already exists as a real, durable fact in this
-- schema — it is the seat named 'director_ops' in functional_roles, already
-- used to route Guest Recovery owner-vs-director approval authority
-- (see the approvals-notify trigger). It has never had a matching
-- is_director() permission check the way is_supervisor() does. This adds
-- exactly that, following the same private-schema pattern as is_supervisor.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.is_director(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- A Platform Owner may always act with full authority. Otherwise, only
  -- whoever currently holds (or is covering) the director_ops seat.
  SELECT public.has_role(_user_id, 'admin')
    OR public.seat_holder_at('director_ops') = _user_id
$$;
REVOKE ALL ON FUNCTION private.is_director(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.is_director(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_director(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = 'public', 'private'
AS $$ SELECT private.is_director(_user_id) $$;
REVOKE ALL ON FUNCTION public.is_director(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_director(uuid) TO authenticated, service_role;

-- A Supervisor may still decide a supervisor-targeted escalation (or answer
-- their own). A director-targeted escalation may only be decided by the
-- Director (or a Platform Owner) — the raiser's own "supervisor OR raiser"
-- bypass no longer applies once the target is 'director'.
DROP POLICY IF EXISTS "Raiser or supervisor updates escalations" ON public.escalations;
CREATE POLICY "Escalation authority decides, by target level"
  ON public.escalations FOR UPDATE TO authenticated
  USING (
    CASE escalated_to_role
      WHEN 'director' THEN public.is_director(auth.uid())
      ELSE public.is_supervisor(auth.uid()) OR escalated_by = auth.uid()
    END
  )
  WITH CHECK (
    CASE escalated_to_role
      WHEN 'director' THEN public.is_director(auth.uid())
      ELSE public.is_supervisor(auth.uid()) OR escalated_by = auth.uid()
    END
  );

-- ---------------------------------------------------------------------
-- 2. Handoff attribution
--
-- `to_user` was the only recipient column, so accepting a handoff had to
-- reuse it for "who actually accepted" — destroying the original addressee.
-- Additive columns; `to_user` stops being written to on accept in code, it
-- keeps its historical meaning here unchanged (the designated recipient).
-- ---------------------------------------------------------------------
ALTER TABLE public.handoffs
  ADD COLUMN IF NOT EXISTS accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz;

-- ---------------------------------------------------------------------
-- 3. Demo isolation backstop
--
-- "View As"/demo preview has only ever been reachable by a Platform Owner
-- (previewing = Boolean(viewAs) && actualRoles.includes('admin'), enforced
-- client-side today). This makes that the real, backend-enforced boundary
-- for writes: a non-admin can never mutate an is_demo ticket, full stop,
-- regardless of whether they know its id. Read access (tickets_select) is
-- unchanged — every list/queue view already filters is_demo itself, and
-- narrowing SELECT here would break legitimate is_staff reporting queries
-- that intentionally read across both.
-- ---------------------------------------------------------------------
DROP POLICY IF EXISTS tickets_update ON public.tickets;
CREATE POLICY tickets_update ON public.tickets FOR UPDATE TO authenticated
  USING (
    (public.is_staff(auth.uid()) OR vendor_user_id = auth.uid())
    AND (NOT is_demo OR public.has_role(auth.uid(), 'admin'))
  )
  WITH CHECK (
    (public.is_staff(auth.uid()) OR vendor_user_id = auth.uid())
    AND (NOT is_demo OR public.has_role(auth.uid(), 'admin'))
  );

-- ---------------------------------------------------------------------
-- 3b. Demo property consistency
--
-- The visible property picker on ticket intake already filters by
-- is_demo, but nothing stopped a demo ticket from being inserted with a
-- live property's id (or vice versa) via any path that bypasses that
-- picker — a deep link, a future integration, a hand-rolled insert. A
-- trigger is the one place that can't be routed around by any client code.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.enforce_ticket_demo_consistency()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  prop_is_demo boolean;
BEGIN
  IF NEW.property_id IS NOT NULL THEN
    SELECT is_demo INTO prop_is_demo FROM public.properties WHERE id = NEW.property_id;
    IF prop_is_demo IS NOT NULL AND prop_is_demo IS DISTINCT FROM NEW.is_demo THEN
      RAISE EXCEPTION 'A % ticket cannot be linked to a % property.',
        (CASE WHEN NEW.is_demo THEN 'demo' ELSE 'live' END),
        (CASE WHEN prop_is_demo THEN 'demo' ELSE 'live' END)
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION private.enforce_ticket_demo_consistency() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.enforce_ticket_demo_consistency() TO authenticated, service_role;

DROP TRIGGER IF EXISTS tickets_demo_property_consistency ON public.tickets;
CREATE TRIGGER tickets_demo_property_consistency
  BEFORE INSERT OR UPDATE OF property_id, is_demo ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION private.enforce_ticket_demo_consistency();

-- ---------------------------------------------------------------------
-- 4. Canonical Work Order
-- ---------------------------------------------------------------------

-- One open Work Order per Ticket. A second is only ever created after the
-- first is closed — matches the existing "Open another work order" UI,
-- which only makes sense once there's nothing open to duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS work_orders_one_open_per_ticket
  ON public.work_orders(ticket_id)
  WHERE closed_at IS NULL AND ticket_id IS NOT NULL;

-- The outbound Breezeway task becomes a derived execution channel off the
-- canonical Work Order, not a parallel repair record.
ALTER TABLE public.breezeway_outbound_tasks
  ADD COLUMN IF NOT EXISTS work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS breezeway_outbound_tasks_work_order_idx
  ON public.breezeway_outbound_tasks(work_order_id);
