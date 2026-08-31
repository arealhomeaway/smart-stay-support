-- Live-Postgres verification for the tickets_auto_assign trigger
-- (supabase/migrations/20260828220000_610ca233-8c53-4d77-bfbd-13f8b1d45c19.sql).
--
-- This is NOT a bun test — it exercises real SQL against a real Postgres
-- server, which bun/TypeScript cannot do. It was run once, by hand, against
-- a disposable local PostgreSQL 16 instance in the review session (not the
-- live database), and every assertion below passed. Re-run it yourself
-- against any disposable Postgres to reproduce that result:
--
--   createdb auto_assign_test
--   psql auto_assign_test -v ON_ERROR_STOP=1 -f supabase/tests/fixtures/auto_assign_schema.sql
--   psql auto_assign_test -v ON_ERROR_STOP=1 -f supabase/migrations/20260828220000_610ca233-8c53-4d77-bfbd-13f8b1d45c19.sql
--   psql auto_assign_test -v ON_ERROR_STOP=1 -f supabase/tests/auto_assign_trigger.test.sql
--   dropdb auto_assign_test
--
-- A clean run prints only NOTICEs ending in "... PASS" and finishes with
-- "ALL ASSERTIONS PASSED". Any mismatch raises an exception and stops the
-- script — nothing here is a soft/logged failure.

\set ON_ERROR_STOP on

INSERT INTO auth.users (id) VALUES
  ('00000000-0000-0000-0000-000000000001'), -- ge_day holder, active tech
  ('00000000-0000-0000-0000-000000000002'), -- ge_evening holder, active manager (backup for ge_day)
  ('00000000-0000-0000-0000-000000000003'), -- po_day holder but role REMOVED (ineligible)
  ('00000000-0000-0000-0000-000000000004'), -- po_evening holder, active tech (backup for po_day)
  ('00000000-0000-0000-0000-000000000009'), -- ticket creator
  ('00000000-0000-0000-0000-000000000010'); -- ops_supervisor holder, active manager (until S10 revokes it)

INSERT INTO public.user_roles (user_id, role) VALUES
  ('00000000-0000-0000-0000-000000000001', 'tech'),
  ('00000000-0000-0000-0000-000000000002', 'manager'),
  -- 000...003 deliberately has NO role row: simulates a seat holder who has
  -- since lost their staff role without functional_roles being updated yet.
  ('00000000-0000-0000-0000-000000000004', 'tech'),
  ('00000000-0000-0000-0000-000000000010', 'manager');

INSERT INTO public.functional_roles (code, name, team, backup_role_code, current_seat_holder, active) VALUES
  ('ge_day', 'Guest Experience Coordinator - Day', 'guest_experience', 'ge_evening', '00000000-0000-0000-0000-000000000001', true),
  ('ge_evening', 'Guest Experience Coordinator - Evening', 'guest_experience', 'ge_day', '00000000-0000-0000-0000-000000000002', true),
  ('po_day', 'Property Operations Coordinator - Day', 'property_operations', 'po_evening', '00000000-0000-0000-0000-000000000003', true),
  ('po_evening', 'Property Operations Coordinator - Evening', 'property_operations', 'po_day', '00000000-0000-0000-0000-000000000004', true),
  ('vacant_with_vacant_backup', 'Vacant With Vacant Backup', 'property_operations', 'vacant_seat', NULL, true),
  ('vacant_seat', 'Totally Vacant Seat', 'property_operations', NULL, NULL, true),
  ('ops_supervisor', 'Operations Supervisor', 'leadership', NULL, '00000000-0000-0000-0000-000000000010', true);

INSERT INTO public.work_types (id, name, category, functional_role_code, pending_approval) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Guest request', 'guest', 'ge_day', false),
  ('10000000-0000-0000-0000-000000000002', 'Pending approval work', 'admin', 'ge_day', true),
  ('10000000-0000-0000-0000-000000000003', 'Property Ops routine', 'maintenance', 'po_day', false),
  ('10000000-0000-0000-0000-000000000004', 'No role recorded', 'other', NULL, false),
  ('10000000-0000-0000-0000-000000000005', 'Doubly vacant', 'other', 'vacant_with_vacant_backup', false);

DO $$
DECLARE
  creator uuid := '00000000-0000-0000-0000-000000000009';
  ge_day_holder uuid := '00000000-0000-0000-0000-000000000001';
  po_evening_holder uuid := '00000000-0000-0000-0000-000000000004';
  t record;
BEGIN
  -- Scenario 1: eligible primary seat holder -> direct automatic assignment.
  INSERT INTO public.tickets (title, status, work_type_id, functional_role_code, created_by, record_owner, accountable_owner)
  VALUES ('S1 direct', 'open', '10000000-0000-0000-0000-000000000001', 'ge_day', creator, creator, creator)
  RETURNING * INTO t;
  ASSERT t.current_action_owner = ge_day_holder, 'S1: expected ge_day holder as current_action_owner';
  ASSERT t.assigned_to = ge_day_holder, 'S1: expected ge_day holder as assigned_to';
  ASSERT t.assignment_source = 'automatic', 'S1: expected automatic source';
  RAISE NOTICE 'S1 eligible primary seat -> direct assignment ... PASS';

  -- Scenario 2: primary seat holder no longer eligible (lost staff role) ->
  -- falls back to the structured backup seat (po_evening), which is eligible.
  INSERT INTO public.tickets (title, status, work_type_id, functional_role_code, created_by, record_owner, accountable_owner)
  VALUES ('S2 backup fallback', 'open', '10000000-0000-0000-0000-000000000003', 'po_day', creator, creator, creator)
  RETURNING * INTO t;
  ASSERT t.current_action_owner = po_evening_holder, 'S2: expected po_evening holder via backup';
  ASSERT t.assignment_source = 'automatic', 'S2: expected automatic source via backup';
  ASSERT t.assignment_note LIKE '%backup seat%', 'S2: reason should name the backup seat';
  RAISE NOTICE 'S2 ineligible primary -> structured backup_role_code fallback ... PASS';

  -- Scenario 3: work_type.pending_approval = true -> never auto-assigned,
  -- even though ge_day has a perfectly eligible holder.
  INSERT INTO public.tickets (title, status, work_type_id, functional_role_code, created_by, record_owner, accountable_owner)
  VALUES ('S3 pending approval', 'open', '10000000-0000-0000-0000-000000000002', 'ge_day', creator, creator, creator)
  RETURNING * INTO t;
  ASSERT t.current_action_owner IS NULL, 'S3: pending_approval work type must not auto-assign';
  ASSERT t.assignment_note LIKE '%pending approval%', 'S3: reason should mention pending approval';
  RAISE NOTICE 'S3 work_type.pending_approval=true -> never auto-assigned ... PASS';

  -- Scenario 4: no functional_role_code anywhere (ticket nor work type) ->
  -- routed to the Operations Supervisor seat for triage (confirmed SOP rule
  -- for unmatched/system-created work), not left fully unassigned.
  INSERT INTO public.tickets (title, status, work_type_id, functional_role_code, created_by, record_owner, accountable_owner)
  VALUES ('S4 no role', 'open', '10000000-0000-0000-0000-000000000004', NULL, creator, creator, creator)
  RETURNING * INTO t;
  ASSERT t.current_action_owner = '00000000-0000-0000-0000-000000000010',
    'S4: unmatched work with no owning role should route to the Operations Supervisor seat holder';
  ASSERT t.assignment_source = 'automatic', 'S4: routing to the Operations Supervisor still counts as an automatic assignment';
  ASSERT t.assignment_note LIKE '%Operations Supervisor%', 'S4: reason should name the Operations Supervisor routing';
  RAISE NOTICE 'S4 no functional_role_code anywhere -> routed to Operations Supervisor ... PASS';

  -- Scenario 5: primary AND backup seat both vacant -> unassigned, never an
  -- arbitrary person.
  INSERT INTO public.tickets (title, status, work_type_id, functional_role_code, created_by, record_owner, accountable_owner)
  VALUES ('S5 doubly vacant', 'open', '10000000-0000-0000-0000-000000000005', 'vacant_with_vacant_backup', creator, creator, creator)
  RETURNING * INTO t;
  ASSERT t.current_action_owner IS NULL, 'S5: doubly vacant chain must leave unassigned';
  ASSERT t.assigned_to IS NULL, 'S5: assigned_to must also stay null';
  ASSERT t.assignment_note LIKE '%Needs a manual assignment%', 'S5: reason should call for manual assignment';
  RAISE NOTICE 'S5 primary + backup both vacant -> unassigned, no arbitrary pick ... PASS';

  -- Scenario 6: a one-touch resolution created already closed must be
  -- skipped entirely by the trigger (never enters the working queue).
  INSERT INTO public.tickets (title, status, work_type_id, functional_role_code, created_by, record_owner, accountable_owner, current_action_owner, assigned_to)
  VALUES ('S6 one-touch', 'closed', '10000000-0000-0000-0000-000000000001', 'ge_day', creator, creator, creator, NULL, NULL)
  RETURNING * INTO t;
  ASSERT t.current_action_owner IS NULL, 'S6: closed-at-creation ticket must be left exactly as inserted';
  ASSERT t.assignment_source IS NULL, 'S6: trigger must not stamp a source for a skipped one-touch record';
  RAISE NOTICE 'S6 one-touch resolution (status=closed at insert) -> trigger skips ... PASS';

  -- Scenario 7: an explicit functional_role_code on the ticket that differs
  -- from the work type's own default must win (respects the human's/form's
  -- override, not silently reverting to the work type's suggestion).
  INSERT INTO public.tickets (title, status, work_type_id, functional_role_code, created_by, record_owner, accountable_owner)
  VALUES ('S7 role override', 'open', '10000000-0000-0000-0000-000000000001', 'po_day', creator, creator, creator)
  RETURNING * INTO t;
  ASSERT t.current_action_owner = po_evening_holder,
    'S7: override to po_day (ineligible) should fall back to po_evening, NOT resolve the work type''s ge_day default';
  RAISE NOTICE 'S7 explicit functional_role_code override wins over work type default ... PASS';

  -- Scenario 8: whatever the client guessed for current_action_owner at
  -- INSERT time must be overridden by the trigger's own resolution — this
  -- is the literal "enforce server-side, not only through the form" check.
  INSERT INTO public.tickets (title, status, work_type_id, functional_role_code, created_by, record_owner, accountable_owner, current_action_owner, assigned_to)
  VALUES ('S8 override client guess', 'open', '10000000-0000-0000-0000-000000000001', 'ge_day', creator, creator, creator, creator, NULL)
  RETURNING * INTO t;
  ASSERT t.current_action_owner = ge_day_holder,
    'S8: trigger must override whatever current_action_owner the client sent (was set to the creator)';
  ASSERT t.current_action_owner != creator, 'S8: must NOT still be the creator the client guessed';
  RAISE NOTICE 'S8 server-side trigger overrides the client''s own guess at INSERT ... PASS';
END $$;

-- Scenario 9: a manual UPDATE after creation must be completely untouched
-- by auto-assignment — the trigger is BEFORE INSERT only, structurally, not
-- just by convention. Reassign S1 manually and confirm nothing reverts it.
DO $$
DECLARE
  s1_id uuid;
  t record;
BEGIN
  SELECT id INTO s1_id FROM public.tickets WHERE title = 'S1 direct';
  UPDATE public.tickets
  SET current_action_owner = '00000000-0000-0000-0000-000000000002',
      assigned_to = '00000000-0000-0000-0000-000000000002',
      assignment_source = 'manual',
      assignment_note = NULL
  WHERE id = s1_id
  RETURNING * INTO t;
  ASSERT t.current_action_owner = '00000000-0000-0000-0000-000000000002', 'S9: manual reassignment must stick';
  ASSERT t.assignment_source = 'manual', 'S9: manual reassignment must be marked manual, untouched by any trigger';
  RAISE NOTICE 'S9 manual UPDATE after creation is never touched by auto-assign ... PASS';
END $$;

-- Scenario 10: no owning role recorded AND the Operations Supervisor seat
-- itself has no eligible holder -> still ends up fully unassigned with a
-- reason. The Supervisor-routing fallback added for S4 gets no exemption
-- from the "never an arbitrary pick" rule.
DO $$
DECLARE
  creator uuid := '00000000-0000-0000-0000-000000000009';
  t record;
BEGIN
  -- The Operations Supervisor seat holder loses their staff role.
  DELETE FROM public.user_roles WHERE user_id = '00000000-0000-0000-0000-000000000010';

  INSERT INTO public.tickets (title, status, work_type_id, functional_role_code, created_by, record_owner, accountable_owner)
  VALUES ('S10 no role, supervisor also ineligible', 'open', '10000000-0000-0000-0000-000000000004', NULL, creator, creator, creator)
  RETURNING * INTO t;
  ASSERT t.current_action_owner IS NULL, 'S10: must stay unassigned when the Operations Supervisor seat has no eligible holder either';
  ASSERT t.assigned_to IS NULL, 'S10: assigned_to must also stay null';
  ASSERT t.assignment_source IS NULL, 'S10: unassigned ticket must not claim an automatic source';
  ASSERT t.assignment_note LIKE '%Operations Supervisor%', 'S10: reason should still name the Operations Supervisor seat';
  RAISE NOTICE 'S10 no role recorded + Operations Supervisor seat also ineligible -> unassigned, reason names both ... PASS';
END $$;

-- Every assignment decision (and every skip) must also land in both
-- existing audit surfaces — the per-ticket activity feed and the
-- cross-entity audit_log — never only in the two new tickets columns.
DO $$
DECLARE
  activity_count int;
  audit_count int;
BEGIN
  SELECT count(*) INTO activity_count FROM public.ticket_activity WHERE kind = 'assignment';
  SELECT count(*) INTO audit_count FROM public.audit_log WHERE action IN ('ticket_auto_assigned', 'ticket_auto_assign_skipped');
  ASSERT activity_count = 9, format('expected 9 ticket_activity assignment rows (one per scenario 1-8 plus S10), got %s', activity_count);
  ASSERT audit_count = 9, format('expected 9 audit_log rows (one per scenario 1-8 plus S10), got %s', audit_count);
  RAISE NOTICE 'Every auto-assign decision recorded in ticket_activity AND audit_log ... PASS';
END $$;

\echo 'ALL ASSERTIONS PASSED'
