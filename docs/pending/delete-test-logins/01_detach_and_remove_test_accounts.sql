-- Delete the 18 fake test sign-ins, part 1 of 2: the database step (Emily, Nov 8, 2026; register S6:
-- a person can be deleted and their name stays on their history as (former)).
-- Explicit list only: the 18 accounts below, each checked against its sign-in address. The step
-- refuses to run unless a full backup that finished and passed Verify in the last 2 hours is
-- recorded, unless every id still has exactly the address written next to it, and unless none of
-- them has a profile, a role or a program place (every real person has a profile, so a wrong id
-- cannot touch a real person). Every change below is counted and must match the count found on
-- Nov 9; any difference stops the step and nothing is kept.
--
-- What it does, for these 18 accounts only:
--   Keeps every record worth keeping and detaches it from the account (the link is cleared). Where
--   a history line has a name field, the name stays; audit lines with no name get the original
--   name followed by (former).
--   Deletes the records that mean nothing without the account: the 6 invites sent to test
--   addresses, the 5 demo approval lines between two test accounts, the 2 closed demo follow-ups,
--   the 5 invalidated demo statement checks and the 2 synthetic demo home activity lines.
--   Lets help ticket history keep a line whose author is gone (the one schema change), so the real
--   help ticket replies stay with their author name.
--   Switches off the safety rules of the touched tables only inside this step (so no clock,
--   history line, alert or date moves) and puts every one back at the end, then checks they are
--   back exactly as before and that no row anywhere still links to the 18 accounts.
--   Adds one audit line recording the removal, with every detached and deleted row listed, so the
--   history can always be traced.
-- The sign-ins themselves are removed by part 2 (02_remove_test_signins.ts) through the sign-in
-- service. Undo: restore from the backup folder (README); the audit line lists every row touched.

CREATE TEMP TABLE dtl_accounts (id uuid PRIMARY KEY, email text NOT NULL, label text NOT NULL) ON COMMIT DROP;
INSERT INTO dtl_accounts (id, email, label) VALUES
  ('81a80bac-2655-4994-9651-a9afb81ec721', 'riley.alder@demo.arha.test', 'Riley Alder (DEMO) (former)'),
  ('ea98f339-1ccc-437a-88bb-06ac94be655a', 'emily.test@example.com', 'Emily Jimenez test account (former)'),
  ('77a301f0-161c-40a4-8266-0c0e05cefa45', 'pr10-owner-a-20260917@example.invalid', 'Test owner A (former)'),
  ('f44ecf9a-a358-430c-9c64-0ffaa31740b4', 'pr10-owner-b-20260917@example.invalid', 'Test owner B (former)'),
  ('e3c913e4-1562-4143-a6ff-1f17cd5deda6', 'emily.r.jimenez4@gmail.com', 'Emma Renee (former)'),
  ('ec5405ff-4722-4a85-a22e-069e68bd3c7f', 'qa.james@resolve-test.invalid', 'QA James (former)'),
  ('d1dafc2e-ba9a-450a-94e3-ad9c11c10ef8', 'qa.kati@resolve-test.invalid', 'QA Kati (former)'),
  ('8fac5aa5-ba70-42f2-afa0-6d77382383b3', 'qa.micah@resolve-test.invalid', 'QA Micah (former)'),
  ('d13885de-6178-4f32-8560-997d182f245f', 'qa.outsider@resolve-test.invalid', 'QA Test Outsider (former)'),
  ('f8a9d111-3416-47f7-abc1-48f5e8aac2ab', 'qa.owner@resolve-test.invalid', 'Avery Lindqvist (demo owner) (former)'),
  ('eeaf39c4-3b22-4733-9ba5-b275476bc5a8', 'qa.signup@resolve-test.invalid', 'QA Signup Test (former)'),
  ('d1b80a3e-3b42-46e5-aacb-43276ef272eb', 'qa.tech@resolve-test.invalid', 'QA Test Tech (former)'),
  ('0a6d5dc9-8159-4850-9b5e-421308d2e464', 'qa.um.admin@resolve-test.invalid', 'qa.um.admin (former)'),
  ('06fd8599-c7aa-40b2-8161-cafae4da99b7', 'qa.um.manager@resolve-test.invalid', 'QA UM Manager (former)'),
  ('3a476833-49ff-4aa3-996d-18913422f8e4', 'qa.um.pending@resolve-test.invalid', 'QA UM Pending (former)'),
  ('c6579620-2ee4-41fe-ad10-07f451d7ae97', 'qa.um.target@resolve-test.invalid', 'Quinnie Targetson (former)'),
  ('5557f537-6847-4f33-af90-1e78b5c344fa', 'qa.um.tech@resolve-test.invalid', 'qa.um.tech (former)'),
  ('9f3b6143-b693-4067-9a3c-d645b5ecd716', 'qa.vendor@resolve-test.invalid', 'QA Vendor (former)');

-- Records deleted, by explicit id, each with its check.
CREATE TEMP TABLE dtl_delete (tbl text NOT NULL, id uuid NOT NULL, check_text text NOT NULL, PRIMARY KEY (tbl, id)) ON COMMIT DROP;
INSERT INTO dtl_delete (tbl, id, check_text) VALUES
  -- invites sent to test addresses (checked by address)
  ('team_invites', '77394839-d631-4916-b7d7-b18f91112f0e', 'qa.signup@resolve-test.invalid'),
  ('team_invites', 'c071396f-59f9-46e7-9829-dfc9059e8b23', 'qa.kati@resolve-test.invalid'),
  ('team_invites', '5439807f-36d4-41dd-9135-fd1b301c5bd4', 'qa.micah@resolve-test.invalid'),
  ('team_invites', 'd122cd93-0b83-403f-9f88-33093fb5313a', 'qa.james@resolve-test.invalid'),
  ('team_invites', 'c3c148b7-a5d2-4e0c-a893-7bebc08fa220', 'emily.r.jimenez4@gmail.com'),
  ('team_invites', 'c5ec020a-7268-4d0b-b285-e96d3c2fcf1c', 'emily.r.jimenez4@gmail.com'),
  -- demo approval lines asked by QA Kati and answered by the demo owner (checked by title)
  ('approvals', '065e6ac5-c586-4110-9ab3-0b151dc80116', 'Send A Real Home Away management agreement to pros'),
  ('approvals', 'c866e132-4a27-4ce6-a095-626730dfb225', 'Send recommended repair & home improvements cost p'),
  ('approvals', '4be00154-4e45-4d29-b8a5-0a0704553b50', 'Send Mood Boards to Owner'),
  ('approvals', '0b7cf83d-2d2c-4cff-8556-2e79708cea41', 'Send Mood Boards to Owner'),
  ('approvals', 'd31ee95f-c3e2-463e-82a8-09f440f8ac12', 'Send Mood Boards to Owner'),
  -- the two demo follow-ups closed on Nov 9 (checked by status)
  ('owner_followup_tasks', 'afb3bf33-a6a3-446c-b2d0-eb149d9cbab2', 'closed'),
  ('owner_followup_tasks', 'aa1fda64-f8e5-4502-835c-0a9915175b89', 'closed'),
  -- invalidated demo statement checks about the deleted demo expenses (checked by status)
  ('statement_reconciliations', 'f136ec2e-cf83-4af5-83db-0f44dd276a79', 'invalidated'),
  ('statement_reconciliations', '16326e3f-6d07-4957-865e-adf3312b7d84', 'invalidated'),
  ('statement_reconciliations', '99cc6100-938f-4b19-8f42-ac4fd38ee714', 'invalidated'),
  ('statement_reconciliations', 'b334f409-f1c6-4366-98bd-4935573913c4', 'invalidated'),
  ('statement_reconciliations', '07eef568-c838-4d6d-8b7d-578f3e6f6cc8', 'invalidated'),
  -- synthetic demo home activity lines (checked by their opening words)
  ('property_activity_log', '81c9b733-4119-4725-a14d-21c9bb937a63', 'SYNTHETIC QA'),
  ('property_activity_log', '595004f1-2086-4457-af66-1e89d000fdfa', 'SYNTHETIC QA');

-- Links cleared (record kept), with the number of rows found on Nov 9.
CREATE TEMP TABLE dtl_links (tbl text NOT NULL, col text NOT NULL, pk text NOT NULL, expected int NOT NULL, PRIMARY KEY (tbl, col)) ON COMMIT DROP;
INSERT INTO dtl_links (tbl, col, pk, expected) VALUES
  ('app_settings', 'updated_by', 'key', 2),
  ('audit_log', 'actor_id', 'id', 293),
  ('breezeway_work_order_comments', 'resolve_author_id', 'id', 1),
  ('cleaning_reviews', 'reviewed_by', 'id', 3),
  ('departure_review_events', 'actor_id', 'id', 18),
  ('departure_reviews', 'claimed_by', 'id', 3),
  ('departure_reviews', 'clean_reviewed_by', 'id', 3),
  ('departure_reviews', 'completed_by', 'id', 3),
  ('documents', 'uploaded_by', 'id', 4),
  ('email_log', 'sent_by', 'id', 5),
  ('guest_feedback', 'followup_completed_by', 'id', 1),
  ('guest_feedback_events', 'actor_id', 'id', 9),
  ('help_ticket_events', 'author_id', 'id', 11),
  ('onboarding_notes', 'author_id', 'id', 2),
  ('onboarding_project_events', 'actor', 'id', 3),
  ('onboarding_projects', 'director', 'id', 4),
  ('onboarding_projects', 'ops_accepted_by', 'id', 1),
  ('onboarding_projects', 'project_manager', 'id', 4),
  ('onboarding_projects', 'ready_for_ops_by', 'id', 2),
  ('onboarding_projects', 'started_by', 'id', 4),
  ('onboarding_task_stage_history', 'assigned_to', 'id', 3),
  ('onboarding_task_stage_history', 'changed_by', 'id', 3),
  ('onboarding_tasks', 'assigned_to', 'id', 4),
  ('onboarding_tasks', 'completed_by', 'id', 4),
  ('onboarding_tasks', 'created_by', 'id', 359),
  ('owner_completion_reviews', 'actor_id', 'id', 2),
  ('owner_programs', 'owner_user_id', 'id', 2),
  ('owner_request_messages', 'author_id', 'id', 25),
  ('routine_controls', 'assigned_to', 'id', 4),
  ('routine_controls', 'completed_by', 'id', 4),
  ('routine_controls', 'created_by', 'id', 4),
  ('staff_notifications', 'actor_id', 'id', 3),
  ('staff_notifications', 'retracted_by', 'id', 1),
  ('work_items', 'assigned_to', 'id', 4),
  ('work_items', 'owner_attention_set_by', 'id', 1);

CREATE TEMP TABLE dtl_touched (tbl text PRIMARY KEY) ON COMMIT DROP;
INSERT INTO dtl_touched SELECT DISTINCT tbl FROM dtl_links UNION SELECT DISTINCT tbl FROM dtl_delete;

CREATE TEMP TABLE dtl_record (k text PRIMARY KEY, v jsonb NOT NULL) ON COMMIT DROP;
CREATE TEMP TABLE dtl_triggers_before ON COMMIT DROP AS
  SELECT t.tgrelid::regclass::text AS tbl, t.tgname, t.tgenabled
    FROM pg_trigger t
   WHERE NOT t.tgisinternal
     AND t.tgrelid IN (SELECT ('public.' || tbl)::regclass FROM dtl_touched);

-- 1. Checks before anything changes.
DO $$
DECLARE n int;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.full_backups
     WHERE status = 'succeeded' AND verify_ok IS TRUE AND finished_at >= now() - interval '2 hours'
  ) THEN
    RAISE EXCEPTION 'Refused: no checked full backup in the last 2 hours. Press Back up everything, then Verify, then try again.';
  END IF;
  SELECT count(*) INTO n FROM dtl_accounts a JOIN auth.users u ON u.id = a.id AND lower(u.email) = a.email;
  IF n <> 18 THEN
    RAISE EXCEPTION 'Refused: only % of the 18 ids still have their expected sign-in address.', n;
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id IN (SELECT id FROM dtl_accounts))
     OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id IN (SELECT id FROM dtl_accounts))
     OR EXISTS (SELECT 1 FROM public.program_members WHERE user_id IN (SELECT id FROM dtl_accounts)) THEN
    RAISE EXCEPTION 'Refused: an id in the list still has a profile, a role or a program place.';
  END IF;
  IF EXISTS (SELECT 1 FROM dtl_triggers_before WHERE tgenabled <> 'O') THEN
    RAISE EXCEPTION 'Refused: a safety rule on a touched table is not in its normal on state.';
  END IF;

  -- each record to delete must still be the expected one
  SELECT count(*) INTO n FROM dtl_delete d JOIN public.team_invites r ON r.id = d.id
   WHERE d.tbl = 'team_invites' AND lower(r.invitee_email) = d.check_text;
  IF n <> 6 THEN RAISE EXCEPTION 'Refused: % of 6 invites match their address.', n; END IF;
  SELECT count(*) INTO n FROM dtl_delete d JOIN public.approvals r ON r.id = d.id
   WHERE d.tbl = 'approvals' AND left(r.title, 50) = d.check_text AND r.is_demo
     AND r.requested_by IN (SELECT id FROM dtl_accounts) AND r.approver_id IN (SELECT id FROM dtl_accounts);
  IF n <> 5 THEN RAISE EXCEPTION 'Refused: % of 5 approval lines match.', n; END IF;
  IF EXISTS (SELECT 1 FROM public.owner_approval_publications WHERE approval_id IN (SELECT id FROM dtl_delete WHERE tbl = 'approvals'))
     OR EXISTS (SELECT 1 FROM public.owner_approval_receipts WHERE approval_id IN (SELECT id FROM dtl_delete WHERE tbl = 'approvals'))
     OR EXISTS (SELECT 1 FROM public.approval_email_responses WHERE approval_id IN (SELECT id FROM dtl_delete WHERE tbl = 'approvals')) THEN
    RAISE EXCEPTION 'Refused: an approval line to delete now has a receipt, publication or email answer.';
  END IF;
  SELECT count(*) INTO n FROM dtl_delete d JOIN public.owner_followup_tasks r ON r.id = d.id
   WHERE d.tbl = 'owner_followup_tasks' AND r.status = d.check_text AND r.is_demo
     AND r.assigned_to IN (SELECT id FROM dtl_accounts);
  IF n <> 2 THEN RAISE EXCEPTION 'Refused: % of 2 demo follow-ups match.', n; END IF;
  SELECT count(*) INTO n FROM dtl_delete d JOIN public.statement_reconciliations r ON r.id = d.id
   WHERE d.tbl = 'statement_reconciliations' AND r.status = d.check_text AND r.is_demo
     AND r.reviewed_by IN (SELECT id FROM dtl_accounts);
  IF n <> 5 THEN RAISE EXCEPTION 'Refused: % of 5 demo statement checks match.', n; END IF;
  SELECT count(*) INTO n FROM dtl_delete d JOIN public.property_activity_log r ON r.id = d.id
   WHERE d.tbl = 'property_activity_log' AND r.what_happened LIKE d.check_text || '%' AND r.is_demo
     AND r.logged_by IN (SELECT id FROM dtl_accounts);
  IF n <> 2 THEN RAISE EXCEPTION 'Refused: % of 2 demo activity lines match.', n; END IF;

  INSERT INTO dtl_record VALUES ('audit_lines_before', to_jsonb((SELECT count(*) FROM public.audit_log)));
END $$;

-- 2. Help ticket history may keep a line whose author sign-in is gone (author name stays).
ALTER TABLE public.help_ticket_events ALTER COLUMN author_id DROP NOT NULL;

-- 3. Safety rules of the touched tables off, inside this step only.
ALTER TABLE public.app_settings DISABLE TRIGGER USER;
ALTER TABLE public.approvals DISABLE TRIGGER USER;
ALTER TABLE public.audit_log DISABLE TRIGGER USER;
ALTER TABLE public.breezeway_work_order_comments DISABLE TRIGGER USER;
ALTER TABLE public.cleaning_reviews DISABLE TRIGGER USER;
ALTER TABLE public.departure_review_events DISABLE TRIGGER USER;
ALTER TABLE public.departure_reviews DISABLE TRIGGER USER;
ALTER TABLE public.documents DISABLE TRIGGER USER;
ALTER TABLE public.email_log DISABLE TRIGGER USER;
ALTER TABLE public.guest_feedback DISABLE TRIGGER USER;
ALTER TABLE public.guest_feedback_events DISABLE TRIGGER USER;
ALTER TABLE public.help_ticket_events DISABLE TRIGGER USER;
ALTER TABLE public.onboarding_notes DISABLE TRIGGER USER;
ALTER TABLE public.onboarding_project_events DISABLE TRIGGER USER;
ALTER TABLE public.onboarding_projects DISABLE TRIGGER USER;
ALTER TABLE public.onboarding_task_stage_history DISABLE TRIGGER USER;
ALTER TABLE public.onboarding_tasks DISABLE TRIGGER USER;
ALTER TABLE public.owner_completion_reviews DISABLE TRIGGER USER;
ALTER TABLE public.owner_followup_tasks DISABLE TRIGGER USER;
ALTER TABLE public.owner_programs DISABLE TRIGGER USER;
ALTER TABLE public.owner_request_messages DISABLE TRIGGER USER;
ALTER TABLE public.property_activity_log DISABLE TRIGGER USER;
ALTER TABLE public.routine_controls DISABLE TRIGGER USER;
ALTER TABLE public.staff_notifications DISABLE TRIGGER USER;
ALTER TABLE public.statement_reconciliations DISABLE TRIGGER USER;
ALTER TABLE public.team_invites DISABLE TRIGGER USER;
ALTER TABLE public.work_items DISABLE TRIGGER USER;

-- 4. Detach, delete, record.
DO $$
DECLARE
  l record;
  a record;
  n int;
  rows_map jsonb;
  links jsonb := '{}'::jsonb;
  deleted jsonb := '{}'::jsonb;
  accounts jsonb := '[]'::jsonb;
  t text;
BEGIN
  -- which rows link to which account, kept in the removal line
  FOR a IN SELECT * FROM dtl_accounts ORDER BY email LOOP
    rows_map := '{}'::jsonb;
    FOR l IN SELECT * FROM dtl_links ORDER BY tbl, col LOOP
      EXECUTE format('SELECT coalesce(jsonb_agg(%I::text ORDER BY %I::text), ''[]'') FROM public.%I WHERE %I = $1', l.pk, l.pk, l.tbl, l.col)
        INTO STRICT links USING a.id;
      IF jsonb_array_length(links) > 0 THEN
        rows_map := rows_map || jsonb_build_object(l.tbl || '.' || l.col, links);
      END IF;
    END LOOP;
    accounts := accounts || jsonb_build_array(jsonb_build_object('id', a.id, 'email', a.email, 'name', a.label, 'detached', rows_map));
  END LOOP;

  -- audit lines with no name keep the original name, followed by (former)
  UPDATE public.audit_log g SET actor_label = a.label
    FROM dtl_accounts a WHERE g.actor_id = a.id AND g.actor_label IS NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 249 THEN RAISE EXCEPTION 'Stopped: % audit lines without a name, expected 249.', n; END IF;

  FOR l IN SELECT * FROM dtl_links ORDER BY tbl, col LOOP
    EXECUTE format('UPDATE public.%I SET %I = NULL WHERE %I IN (SELECT id FROM dtl_accounts)', l.tbl, l.col, l.col);
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> l.expected THEN
      RAISE EXCEPTION 'Stopped: %.% had % linked rows, expected %.', l.tbl, l.col, n, l.expected;
    END IF;
  END LOOP;

  -- the test account flag list no longer holds the removed account
  UPDATE public.app_settings
     SET value = '[]'::jsonb
   WHERE key = 'test_account_ids' AND value = '["e3c913e4-1562-4143-a6ff-1f17cd5deda6"]'::jsonb;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'Stopped: the test account list changed since Nov 9.'; END IF;

  FOR t IN SELECT DISTINCT tbl FROM dtl_delete ORDER BY tbl LOOP
    deleted := deleted || jsonb_build_object(t, (SELECT jsonb_agg(id::text ORDER BY id) FROM dtl_delete WHERE tbl = t));
    EXECUTE format('DELETE FROM public.%I WHERE id IN (SELECT id FROM dtl_delete WHERE tbl = $1)', t) USING t;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n <> (SELECT count(*) FROM dtl_delete WHERE tbl = t) THEN
      RAISE EXCEPTION 'Stopped: % deleted % rows, expected %.', t, n, (SELECT count(*) FROM dtl_delete WHERE tbl = t);
    END IF;
  END LOOP;

  INSERT INTO dtl_record VALUES ('accounts', accounts), ('deleted', deleted);
END $$;

-- 5. Safety rules back on.
ALTER TABLE public.app_settings ENABLE TRIGGER USER;
ALTER TABLE public.approvals ENABLE TRIGGER USER;
ALTER TABLE public.audit_log ENABLE TRIGGER USER;
ALTER TABLE public.breezeway_work_order_comments ENABLE TRIGGER USER;
ALTER TABLE public.cleaning_reviews ENABLE TRIGGER USER;
ALTER TABLE public.departure_review_events ENABLE TRIGGER USER;
ALTER TABLE public.departure_reviews ENABLE TRIGGER USER;
ALTER TABLE public.documents ENABLE TRIGGER USER;
ALTER TABLE public.email_log ENABLE TRIGGER USER;
ALTER TABLE public.guest_feedback ENABLE TRIGGER USER;
ALTER TABLE public.guest_feedback_events ENABLE TRIGGER USER;
ALTER TABLE public.help_ticket_events ENABLE TRIGGER USER;
ALTER TABLE public.onboarding_notes ENABLE TRIGGER USER;
ALTER TABLE public.onboarding_project_events ENABLE TRIGGER USER;
ALTER TABLE public.onboarding_projects ENABLE TRIGGER USER;
ALTER TABLE public.onboarding_task_stage_history ENABLE TRIGGER USER;
ALTER TABLE public.onboarding_tasks ENABLE TRIGGER USER;
ALTER TABLE public.owner_completion_reviews ENABLE TRIGGER USER;
ALTER TABLE public.owner_followup_tasks ENABLE TRIGGER USER;
ALTER TABLE public.owner_programs ENABLE TRIGGER USER;
ALTER TABLE public.owner_request_messages ENABLE TRIGGER USER;
ALTER TABLE public.property_activity_log ENABLE TRIGGER USER;
ALTER TABLE public.routine_controls ENABLE TRIGGER USER;
ALTER TABLE public.staff_notifications ENABLE TRIGGER USER;
ALTER TABLE public.statement_reconciliations ENABLE TRIGGER USER;
ALTER TABLE public.team_invites ENABLE TRIGGER USER;
ALTER TABLE public.work_items ENABLE TRIGGER USER;

-- 6. One audit line recording the removal (the audit log is append-only again here).
INSERT INTO public.audit_log (actor_id, actor_label, action, entity_type, entity_id, entity_label, reason, before_value, after_value)
SELECT NULL, 'Admin', 'user.test_signins_deleted', 'user', NULL, '18 test sign-ins',
       'Every fake test sign-in is deleted, not blocked (Emily, Nov 8, register S6).',
       jsonb_build_object('accounts', (SELECT v FROM dtl_record WHERE k = 'accounts')),
       jsonb_build_object('deleted_rows', (SELECT v FROM dtl_record WHERE k = 'deleted'),
                          'help_ticket_author_optional', true,
                          'test_account_ids', '[]'::jsonb);

-- 7. Final checks: every safety rule back as before, every audit line kept plus one, and no row
-- anywhere still links to the 18 accounts (audit lines keep the old id only as the subject of the
-- line they describe; the removal line maps each id to its name).
DO $$
DECLARE
  c record;
  n bigint;
  total bigint := 0;
BEGIN
  IF EXISTS (
    SELECT tbl, tgname, tgenabled FROM dtl_triggers_before
    EXCEPT
    SELECT t.tgrelid::regclass::text, t.tgname, t.tgenabled FROM pg_trigger t
     WHERE NOT t.tgisinternal AND t.tgrelid IN (SELECT ('public.' || tbl)::regclass FROM dtl_touched)
  ) OR EXISTS (
    SELECT t.tgrelid::regclass::text, t.tgname, t.tgenabled FROM pg_trigger t
     WHERE NOT t.tgisinternal AND t.tgrelid IN (SELECT ('public.' || tbl)::regclass FROM dtl_touched)
    EXCEPT
    SELECT tbl, tgname, tgenabled FROM dtl_triggers_before
  ) THEN
    RAISE EXCEPTION 'Check failed: a safety rule is not back exactly as before.';
  END IF;

  IF (SELECT count(*) FROM public.audit_log) <> (SELECT (v #>> '{}')::bigint + 1 FROM dtl_record WHERE k = 'audit_lines_before') THEN
    RAISE EXCEPTION 'Check failed: the audit log did not keep every line plus the one removal line.';
  END IF;

  FOR c IN
    SELECT table_name, column_name, data_type
      FROM information_schema.columns col
     WHERE table_schema = 'public' AND udt_name IN ('uuid', '_uuid')
       AND NOT (table_name = 'audit_log' AND column_name = 'entity_id')
       AND EXISTS (SELECT 1 FROM information_schema.tables t
                    WHERE t.table_schema = 'public' AND t.table_name = col.table_name AND t.table_type = 'BASE TABLE')
  LOOP
    IF c.data_type = 'ARRAY' THEN
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %I && (SELECT array_agg(id) FROM dtl_accounts)', c.table_name, c.column_name) INTO n;
    ELSE
      EXECUTE format('SELECT count(*) FROM public.%I WHERE %I IN (SELECT id FROM dtl_accounts)', c.table_name, c.column_name) INTO n;
    END IF;
    IF n > 0 THEN
      RAISE EXCEPTION 'Check failed: %.% still links to a removed account (% rows).', c.table_name, c.column_name, n;
    END IF;
  END LOOP;
END $$;
