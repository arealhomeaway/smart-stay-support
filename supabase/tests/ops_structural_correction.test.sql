-- Self-asserting proof for 20260905000000_ops_structural_correction.sql
-- against a disposable local Postgres (see fixtures/ops_structural_correction_schema.sql).
-- Each check is a plain SELECT that divides by zero (raising a clear error)
-- if the asserted condition is false — kept as top-level statements (not a
-- dollar-quoted DO block) so psql's :'var' substitution actually applies.
--
-- Section 4 covers tickets_update in full: the demo-isolation restriction
-- this migration adds, AND the pre-existing private.can_edit_ticket
-- ownership/assignment gate and vendor behavior it must not regress.
-- Re-run against any disposable Postgres 16 to reproduce:
--
--   createdb ops_structural_correction_test
--   psql ops_structural_correction_test -v ON_ERROR_STOP=1 -f supabase/tests/fixtures/ops_structural_correction_schema.sql
--   psql ops_structural_correction_test -v ON_ERROR_STOP=1 -f supabase/migrations/20260905000000_ops_structural_correction.sql
--   psql ops_structural_correction_test -v ON_ERROR_STOP=1 -f supabase/tests/ops_structural_correction.test.sql
--   dropdb ops_structural_correction_test
--
-- Run against a disposable local PostgreSQL 16 instance in this review
-- session (not the live database) — every assertion passed, ending in
-- "All ops_structural_correction assertions passed."
\set ON_ERROR_STOP on
\pset tuples_only on

-- ---- setup, as the superuser (bypasses RLS) --------------------------
INSERT INTO auth.users DEFAULT VALUES RETURNING id AS admin_id \gset
INSERT INTO auth.users DEFAULT VALUES RETURNING id AS director_id \gset
INSERT INTO auth.users DEFAULT VALUES RETURNING id AS supervisor_id \gset
INSERT INTO auth.users DEFAULT VALUES RETURNING id AS frontline_id \gset
INSERT INTO auth.users DEFAULT VALUES RETURNING id AS other_tech_id \gset
INSERT INTO auth.users DEFAULT VALUES RETURNING id AS vendor_id \gset

-- Director of Operations shares the 'manager' permission role with
-- Supervisor (confirmed real-world fact) — the director_ops SEAT is what
-- actually distinguishes real Director authority, per is_director().
INSERT INTO public.user_roles(user_id, role) VALUES
  (:'admin_id', 'admin'), (:'supervisor_id', 'manager'), (:'director_id', 'manager'),
  (:'frontline_id', 'tech'), (:'other_tech_id', 'tech');
INSERT INTO public.functional_roles(code, current_seat_holder) VALUES ('director_ops', :'director_id');

INSERT INTO public.tickets(id, is_demo) VALUES (gen_random_uuid(), false) RETURNING id AS t_live \gset
INSERT INTO public.tickets(id, is_demo) VALUES (gen_random_uuid(), true) RETURNING id AS t_demo \gset
-- Owned by frontline_id (assigned_to): the ownership/assignment gate this
-- migration must not weaken.
INSERT INTO public.tickets(id, is_demo, assigned_to) VALUES (gen_random_uuid(), false, :'frontline_id') RETURNING id AS t_owned \gset
-- Owned by someone else entirely, but has a vendor attached — vendor access
-- must stay independent of the ownership check.
INSERT INTO public.tickets(id, is_demo, assigned_to, vendor_user_id) VALUES (gen_random_uuid(), false, :'other_tech_id', :'vendor_id') RETURNING id AS t_vendor \gset
INSERT INTO public.escalations(escalated_by, escalated_to_role) VALUES (:'frontline_id', 'director') RETURNING id AS esc_dir \gset
INSERT INTO public.escalations(escalated_by, escalated_to_role) VALUES (:'frontline_id', 'supervisor') RETURNING id AS esc_sup \gset

-- No grants needed here: the migration itself grants EXECUTE on
-- public.is_director/private.is_director to authenticated, matching the
-- pattern already established for is_supervisor/is_staff/has_role in the
-- real migration history (which the fixture already stubs with those
-- grants included).
GRANT UPDATE ON public.tickets TO authenticated;

-- ---- 1. is_director -----------------------------------------------
SELECT 1/CASE WHEN public.is_director(:'director_id') THEN 1 ELSE 0 END AS director_seat_holder_is_director;
SELECT 1/CASE WHEN public.is_director(:'admin_id') THEN 1 ELSE 0 END AS admin_is_director;
SELECT 1/CASE WHEN NOT public.is_director(:'supervisor_id') THEN 1 ELSE 0 END AS supervisor_alone_is_not_director;
SELECT 1/CASE WHEN NOT public.is_director(:'frontline_id') THEN 1 ELSE 0 END AS frontline_is_not_director;

-- ---- 2. escalations RLS, exercised as real Postgres roles ----------
-- Supervisor attempts to decide the DIRECTOR-targeted escalation: must fail (RLS silently filters, 0 rows changed).
SET ROLE authenticated;
SET request.jwt.claim.sub = :'supervisor_id';
UPDATE public.escalations SET status = 'resolved' WHERE id = :'esc_dir';
RESET ROLE;
SELECT 1/CASE WHEN status = 'open' THEN 1 ELSE 0 END AS supervisor_cannot_resolve_director_escalation
  FROM public.escalations WHERE id = :'esc_dir';

-- Director succeeds on the same director-targeted escalation.
SET ROLE authenticated;
SET request.jwt.claim.sub = :'director_id';
UPDATE public.escalations SET status = 'resolved' WHERE id = :'esc_dir';
RESET ROLE;
SELECT 1/CASE WHEN status = 'resolved' THEN 1 ELSE 0 END AS director_can_resolve_director_escalation
  FROM public.escalations WHERE id = :'esc_dir';

-- Supervisor still succeeds on a supervisor-targeted escalation (unchanged behavior).
SET ROLE authenticated;
SET request.jwt.claim.sub = :'supervisor_id';
UPDATE public.escalations SET status = 'resolved' WHERE id = :'esc_sup';
RESET ROLE;
SELECT 1/CASE WHEN status = 'resolved' THEN 1 ELSE 0 END AS supervisor_can_resolve_supervisor_escalation
  FROM public.escalations WHERE id = :'esc_sup';

-- ---- 3. handoffs: accept no longer overwrites the designated recipient
INSERT INTO public.handoffs(from_user, to_user) VALUES (:'frontline_id', :'supervisor_id') RETURNING id AS handoff_id \gset
UPDATE public.handoffs SET accepted_by = :'supervisor_id', accepted_at = now() WHERE id = :'handoff_id';
SELECT 1/CASE WHEN to_user = :'supervisor_id' THEN 1 ELSE 0 END AS to_user_untouched_by_acceptance
  FROM public.handoffs WHERE id = :'handoff_id';
SELECT 1/CASE WHEN accepted_by = :'supervisor_id' THEN 1 ELSE 0 END AS accepted_by_records_who_accepted
  FROM public.handoffs WHERE id = :'handoff_id';

-- ---- 3b. demo/property consistency trigger ---------------------------
INSERT INTO public.properties(is_demo) VALUES (true) RETURNING id AS demo_property \gset
INSERT INTO public.properties(is_demo) VALUES (false) RETURNING id AS live_property \gset

\unset ON_ERROR_STOP
INSERT INTO public.tickets(is_demo, property_id) VALUES (true, :'live_property');
\set ON_ERROR_STOP on
SELECT 1/CASE WHEN count(*) = 0 THEN 1 ELSE 0 END AS demo_ticket_on_live_property_rejected
  FROM public.tickets WHERE property_id = :'live_property' AND is_demo = true;

\unset ON_ERROR_STOP
INSERT INTO public.tickets(is_demo, property_id) VALUES (false, :'demo_property');
\set ON_ERROR_STOP on
SELECT 1/CASE WHEN count(*) = 0 THEN 1 ELSE 0 END AS live_ticket_on_demo_property_rejected
  FROM public.tickets WHERE property_id = :'demo_property' AND is_demo = false;

INSERT INTO public.tickets(is_demo, property_id) VALUES (true, :'demo_property');
SELECT 1/CASE WHEN count(*) = 1 THEN 1 ELSE 0 END AS matching_demo_ticket_and_property_allowed
  FROM public.tickets WHERE property_id = :'demo_property' AND is_demo = true;

-- ---- 4. tickets_update RLS -------------------------------------------
-- 4a. Demo isolation: non-admin blocked on a demo row, admin allowed.
SET ROLE authenticated;
SET request.jwt.claim.sub = :'frontline_id';
UPDATE public.tickets SET status = 'in_progress' WHERE id = :'t_demo';
RESET ROLE;
SELECT 1/CASE WHEN status = 'open' THEN 1 ELSE 0 END AS non_admin_blocked_writing_demo_ticket
  FROM public.tickets WHERE id = :'t_demo';

SET ROLE authenticated;
SET request.jwt.claim.sub = :'admin_id';
UPDATE public.tickets SET status = 'in_progress' WHERE id = :'t_demo';
RESET ROLE;
SELECT 1/CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END AS admin_can_write_demo_ticket
  FROM public.tickets WHERE id = :'t_demo';

-- 4b. Unowned live ticket: staff may still claim it (can_edit_ticket's
-- "no owner yet" branch) — the ownership gate does not lock out a ticket
-- nobody has taken yet.
SET ROLE authenticated;
SET request.jwt.claim.sub = :'frontline_id';
UPDATE public.tickets SET status = 'in_progress' WHERE id = :'t_live';
RESET ROLE;
SELECT 1/CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END AS staff_can_claim_unowned_live_ticket
  FROM public.tickets WHERE id = :'t_live';

-- 4c. Ownership/assignment gate (private.can_edit_ticket), the exact
-- restriction this migration must preserve, not regress:
-- the assigned staff member can update their own ticket.
SET ROLE authenticated;
SET request.jwt.claim.sub = :'frontline_id';
UPDATE public.tickets SET status = 'in_progress' WHERE id = :'t_owned';
RESET ROLE;
SELECT 1/CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END AS assigned_staff_can_update_owned_ticket
  FROM public.tickets WHERE id = :'t_owned';

-- an unrelated staff member (not the assignee, not a supervisor) is
-- blocked — this is exactly the gate that would have silently regressed
-- if tickets_update had been left rebuilt from the pre-can_edit_ticket
-- policy body.
SET ROLE authenticated;
SET request.jwt.claim.sub = :'other_tech_id';
UPDATE public.tickets SET status = 'resolved' WHERE id = :'t_owned';
RESET ROLE;
SELECT 1/CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END AS unrelated_staff_blocked_on_owned_ticket
  FROM public.tickets WHERE id = :'t_owned';

-- a supervisor may still update any ticket regardless of assignment
-- (can_edit_ticket's is_supervisor branch).
SET ROLE authenticated;
SET request.jwt.claim.sub = :'supervisor_id';
UPDATE public.tickets SET status = 'resolved' WHERE id = :'t_owned';
RESET ROLE;
SELECT 1/CASE WHEN status = 'resolved' THEN 1 ELSE 0 END AS supervisor_can_update_any_ticket
  FROM public.tickets WHERE id = :'t_owned';

-- 4d. Vendor behavior is unchanged: the vendor named on a ticket may
-- update it regardless of the ownership columns above (it never depended
-- on private.is_staff/can_edit_ticket, before or after this migration).
SET ROLE authenticated;
SET request.jwt.claim.sub = :'vendor_id';
UPDATE public.tickets SET status = 'in_progress' WHERE id = :'t_vendor';
RESET ROLE;
SELECT 1/CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END AS vendor_can_update_own_ticket_regardless_of_ownership
  FROM public.tickets WHERE id = :'t_vendor';

-- and an uninvolved tech (not the assignee, not the vendor, not a
-- supervisor) is still blocked on that same ticket.
SET ROLE authenticated;
SET request.jwt.claim.sub = :'frontline_id';
UPDATE public.tickets SET status = 'resolved' WHERE id = :'t_vendor';
RESET ROLE;
SELECT 1/CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END AS unrelated_staff_blocked_on_vendor_ticket
  FROM public.tickets WHERE id = :'t_vendor';

-- ---- 5. work_orders: one open work order per ticket -----------------
INSERT INTO public.work_orders(ticket_id) VALUES (:'t_live') RETURNING id AS wo1 \gset
\unset ON_ERROR_STOP
INSERT INTO public.work_orders(ticket_id) VALUES (:'t_live');
\set ON_ERROR_STOP on
SELECT 1/CASE WHEN count(*) = 1 THEN 1 ELSE 0 END AS second_open_work_order_rejected
  FROM public.work_orders WHERE ticket_id = :'t_live';

UPDATE public.work_orders SET closed_at = now() WHERE id = :'wo1';
INSERT INTO public.work_orders(ticket_id) VALUES (:'t_live');
SELECT 1/CASE WHEN count(*) = 2 THEN 1 ELSE 0 END AS new_work_order_allowed_once_prior_closed
  FROM public.work_orders WHERE ticket_id = :'t_live';

-- ---- 6. breezeway_outbound_tasks.work_order_id links to the canonical record
INSERT INTO public.breezeway_outbound_tasks(ticket_id, work_order_id) VALUES (:'t_live', :'wo1');
SELECT 1/CASE WHEN work_order_id = :'wo1' THEN 1 ELSE 0 END AS outbound_task_links_to_work_order
  FROM public.breezeway_outbound_tasks WHERE ticket_id = :'t_live' AND work_order_id IS NOT NULL;

\pset tuples_only off
SELECT 'All ops_structural_correction assertions passed.' AS result;
