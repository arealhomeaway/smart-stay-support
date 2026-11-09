-- Clean slate, part 3 (Emily, Nov 9, 2026, answer 2): close the two demo homeowner follow-ups
-- assigned to the removed QA Kati test account and delete their 2 alerts. Explicit ids only, each
-- checked against its home, assignee, demo flag and open state; refuses otherwise, and refuses
-- unless a full backup that finished and passed Verify in the last 2 hours is recorded.
-- Mirrors close_owner_followup (status closed, closed_at now, alerts handled) without a session:
-- closed_by stays empty because no person closed them. The demo alert setting is left as it is
-- (answer 3). Undo: 03_undo_close_demo_followups.sql.

DO $$
DECLARE
  _kati constant uuid := 'd1dafc2e-ba9a-450a-94e3-ad9c11c10ef8';
  _n int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.full_backups
     WHERE status = 'succeeded' AND verify_ok IS TRUE AND finished_at >= now() - interval '2 hours'
  ) THEN
    RAISE EXCEPTION 'No full backup that passed Verify in the last 2 hours. Nothing changed.';
  END IF;

  SELECT count(*) INTO _n FROM public.owner_followup_tasks
   WHERE assigned_to = _kati AND status = 'open' AND is_demo
     AND (id, property_id) IN (
       ('afb3bf33-a6a3-446c-b2d0-eb149d9cbab2'::uuid, 'a0000000-0000-4000-8000-00000000b001'::uuid),
       ('aa1fda64-f8e5-4502-835c-0a9915175b89'::uuid, 'a0000000-0000-4000-8000-00000000a001'::uuid));
  IF _n <> 2 THEN
    RAISE EXCEPTION 'Expected 2 open demo follow-ups for the removed account, found %. Nothing changed.', _n;
  END IF;

  SELECT count(*) INTO _n FROM public.staff_notifications
   WHERE user_id = _kati AND kind = 'owner_followup' AND is_demo AND entity_type = 'owner_followup_task'
     AND (id, entity_id) IN (
       ('6a8f02f0-d15f-4cf6-9f83-27ed4b1069a1'::uuid, 'afb3bf33-a6a3-446c-b2d0-eb149d9cbab2'::uuid),
       ('a0044d1d-fe5a-4277-aa52-b2f5f5f15ca2'::uuid, 'aa1fda64-f8e5-4502-835c-0a9915175b89'::uuid));
  IF _n <> 2 THEN
    RAISE EXCEPTION 'Expected the 2 demo alerts, found %. Nothing changed.', _n;
  END IF;

  UPDATE public.owner_followup_tasks
     SET status = 'closed', closed_at = now(),
         close_note = 'Closed in the clean slate: the assigned test account was removed'
   WHERE id IN ('afb3bf33-a6a3-446c-b2d0-eb149d9cbab2', 'aa1fda64-f8e5-4502-835c-0a9915175b89')
     AND assigned_to = _kati AND status = 'open';
  GET DIAGNOSTICS _n = ROW_COUNT;
  IF _n <> 2 THEN RAISE EXCEPTION 'Closed % follow-ups, expected 2. Nothing changed.', _n; END IF;

  DELETE FROM public.staff_notifications
   WHERE id IN ('6a8f02f0-d15f-4cf6-9f83-27ed4b1069a1', 'a0044d1d-fe5a-4277-aa52-b2f5f5f15ca2')
     AND user_id = _kati;
  GET DIAGNOSTICS _n = ROW_COUNT;
  IF _n <> 2 THEN RAISE EXCEPTION 'Deleted % alerts, expected 2. Nothing changed.', _n; END IF;

  IF EXISTS (SELECT 1 FROM public.staff_notifications s
              WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = s.user_id)) THEN
    RAISE EXCEPTION 'An alert is still addressed to a removed account. Nothing changed.';
  END IF;
END $$;
