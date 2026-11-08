-- Clean slate, part 2: delete the fake and demo user accounts (Emily, Nov 7, 2026; register N8).
-- STAGED ONLY. Do not apply without Emily's go. Refuses to run unless a full backup that
-- finished and passed Verify in the last 2 hours is recorded, and unless every id below still
-- belongs to exactly the sign-in address written next to it (so a typo can never remove a real
-- person). Explicit list only: 18 accounts. The six real homeowner logins and all real staff stay.
--
-- Removes, for these accounts only: their roles, team role places, on call rows, program and
-- vendor company memberships, the alerts and homeowner messages addressed to them, and their
-- profiles. Records they made (onboarding Tasks, history lines, expenses and so on) stay; those
-- lines will show no name. Their sign-ins are then removed by 02b (an Admin step through the
-- sign-in service, which a database step may not touch).
-- Switches off the profile delete block only inside this step. Undo: none in SQL; restore from
-- the backup (README).

CREATE TEMP TABLE cs_accounts (id uuid PRIMARY KEY, email text NOT NULL) ON COMMIT DROP;
INSERT INTO cs_accounts (id, email) VALUES
  ('81a80bac-2655-4994-9651-a9afb81ec721', 'riley.alder@demo.arha.test'),
  ('ea98f339-1ccc-437a-88bb-06ac94be655a', 'emily.test@example.com'),
  ('77a301f0-161c-40a4-8266-0c0e05cefa45', 'pr10-owner-a-20260917@example.invalid'),
  ('f44ecf9a-a358-430c-9c64-0ffaa31740b4', 'pr10-owner-b-20260917@example.invalid'),
  ('e3c913e4-1562-4143-a6ff-1f17cd5deda6', 'emily.r.jimenez4@gmail.com'),
  ('ec5405ff-4722-4a85-a22e-069e68bd3c7f', 'qa.james@resolve-test.invalid'),
  ('d1dafc2e-ba9a-450a-94e3-ad9c11c10ef8', 'qa.kati@resolve-test.invalid'),
  ('8fac5aa5-ba70-42f2-afa0-6d77382383b3', 'qa.micah@resolve-test.invalid'),
  ('d13885de-6178-4f32-8560-997d182f245f', 'qa.outsider@resolve-test.invalid'),
  ('f8a9d111-3416-47f7-abc1-48f5e8aac2ab', 'qa.owner@resolve-test.invalid'),
  ('eeaf39c4-3b22-4733-9ba5-b275476bc5a8', 'qa.signup@resolve-test.invalid'),
  ('d1b80a3e-3b42-46e5-aacb-43276ef272eb', 'qa.tech@resolve-test.invalid'),
  ('0a6d5dc9-8159-4850-9b5e-421308d2e464', 'qa.um.admin@resolve-test.invalid'),
  ('06fd8599-c7aa-40b2-8161-cafae4da99b7', 'qa.um.manager@resolve-test.invalid'),
  ('3a476833-49ff-4aa3-996d-18913422f8e4', 'qa.um.pending@resolve-test.invalid'),
  ('c6579620-2ee4-41fe-ad10-07f451d7ae97', 'qa.um.target@resolve-test.invalid'),
  ('5557f537-6847-4f33-af90-1e78b5c344fa', 'qa.um.tech@resolve-test.invalid'),
  ('9f3b6143-b693-4067-9a3c-d645b5ecd716', 'qa.vendor@resolve-test.invalid');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.full_backups
     WHERE status = 'succeeded' AND verify_ok IS TRUE AND finished_at >= now() - interval '2 hours'
  ) THEN
    RAISE EXCEPTION 'Clean slate refused: no checked full backup in the last 2 hours. Press Back up everything, then Verify, then try again.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM cs_accounts a LEFT JOIN auth.users u ON u.id = a.id
     WHERE u.id IS NOT NULL AND lower(u.email) IS DISTINCT FROM a.email
  ) THEN
    RAISE EXCEPTION 'Clean slate refused: an account in the list no longer has the expected sign-in address.';
  END IF;
END $$;

DELETE FROM public.user_roles WHERE user_id IN (SELECT id FROM cs_accounts);
DELETE FROM public.functional_role_members WHERE user_id IN (SELECT id FROM cs_accounts);
DELETE FROM public.oncall_roster WHERE user_id IN (SELECT id FROM cs_accounts);
DELETE FROM public.program_members WHERE user_id IN (SELECT id FROM cs_accounts);
DELETE FROM public.vendor_org_members WHERE user_id IN (SELECT id FROM cs_accounts);
DELETE FROM public.staff_notifications WHERE user_id IN (SELECT id FROM cs_accounts);
DELETE FROM public.owner_notifications WHERE owner_user_id IN (SELECT id FROM cs_accounts);

ALTER TABLE public.profiles DISABLE TRIGGER profiles_never_delete;
DELETE FROM public.profiles WHERE id IN (SELECT id FROM cs_accounts);
ALTER TABLE public.profiles ENABLE TRIGGER profiles_never_delete;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'profiles_never_delete' AND tgenabled = 'D') THEN
    RAISE EXCEPTION 'Clean slate check: the profile delete block is still off.';
  END IF;
END $$;
