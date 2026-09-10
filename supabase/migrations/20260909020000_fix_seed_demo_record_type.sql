-- Fixes an invalid record_type literal in seed_demo_environment, the same
-- class of defect as 20260909014103 (escalation_level): 'ticket' and
-- 'onboarding' were never legal record_type values. tickets_record_type_chk
-- (20260820164516) only allows 'completed_interaction', 'active_task', or
-- 'collaborative_matter'. Confirmed by direct reproduction against a
-- disposable Postgres: every ticket insert in seed_demo_environment that
-- uses 'ticket' or 'onboarding' for record_type fails this constraint.
--
-- Affected rows (of the 6 tickets seed_demo_environment inserts):
--   - ref 900000 (the AC ticket): record_type = 'ticket'   -> in_progress, an
--     open emergency, so 'active_task' (matches every real, non-demo
--     ticket-creation call site: breezeway-routing.server.ts,
--     quarterly.server.ts, intake.server.ts, coach.tsx).
--   - ref 900002 (the handoff-review ticket): record_type = 'onboarding'  ->
--     also still open/awaiting a decision, so 'active_task' as well; there
--     is no real call site using 'onboarding' or 'collaborative_matter' to
--     map to instead.
--   - refs 900001, 900003, 900004, 900005 also use 'ticket' for record_type
--     and are equally invalid, but each of those four inserts fails first
--     on tickets_handoff_status_chk (handoff_status = 'not_started', also
--     not a legal value) — confirmed by the same reproduction. That is a
--     separate, already-flagged defect this migration does not touch.
--
-- Applied the same way as 20260909014103: patch the live function body via
-- pg_get_functiondef/replace rather than editing an already-applied
-- migration file, with a self-check that raises if either literal is still
-- present afterward.
DO $$
DECLARE d text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO d
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'seed_demo_environment' AND p.pronargs = 1;

  IF d IS NULL THEN
    RAISE EXCEPTION 'seed_demo_environment(uuid) not found';
  END IF;

  d := replace(d, '''in_progress'',''ticket'',''guest_call''', '''in_progress'',''active_task'',''guest_call''');
  d := replace(d, '''awaiting_owner'',''onboarding'',''internal''', '''awaiting_owner'',''active_task'',''internal''');

  IF d LIKE '%''in_progress'',''ticket'',''guest_call''%' OR d LIKE '%''awaiting_owner'',''onboarding'',''internal''%' THEN
    RAISE EXCEPTION 'record_type literals were not replaced';
  END IF;

  EXECUTE d;
END $$;
