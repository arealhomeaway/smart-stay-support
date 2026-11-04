-- Remove users: delete for staff (kept as a "former" record), archive for homeowners and vendors.
-- PENDING. Not applied.
--
-- Design: a person's row is NEVER deleted. Staff "delete" keeps the profile as a tombstone
-- (removed_at set, every role and seat removed, login turned off by the server action), so
-- every ticket, hour, approval, document, claim, finance record and audit entry keeps pointing
-- at a real row and shows "Name (former)". No sign-in account is deleted either, so the
-- ON DELETE CASCADE keys to auth.users (owner_time_entries, staff_notifications, vendor rows,
-- profiles, user_roles and others) can never fire. As a backstop, a trigger refuses any delete
-- of a profile, which also makes a sign-in account delete fail as a whole instead of cascading.
-- Additive only: four nullable columns, one trigger, four functions. No foreign key is changed.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS removed_at timestamptz,
  ADD COLUMN IF NOT EXISTS removed_by uuid,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid;

COMMENT ON COLUMN public.profiles.removed_at IS 'Staff user deleted: tombstone kept so history shows "(former)". Set only by remove_staff_user.';
COMMENT ON COLUMN public.profiles.archived_at IS 'Homeowner or vendor archived (login off, history kept). Reversible via set_account_archived.';

CREATE OR REPLACE FUNCTION public.block_profile_delete()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $f$
BEGIN
  RAISE EXCEPTION 'People are never deleted, so their history stays. Use Delete user (staff) or Archive (homeowners and vendors).'
    USING ERRCODE = 'P0001';
END
$f$;
REVOKE ALL ON FUNCTION public.block_profile_delete() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_never_delete ON public.profiles;
CREATE TRIGGER profiles_never_delete BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.block_profile_delete();

-- Open work a staff member still owns. Delete is blocked while any row exists.
CREATE OR REPLACE FUNCTION public.staff_open_work(_user uuid)
RETURNS TABLE(kind text, item_id text, label text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $f$
  SELECT 'ticket', t.id::text, COALESCE(t.title, 'Ticket')
    FROM public.tickets t
   WHERE t.status::text NOT IN ('resolved','closed','cancelled')
     AND (t.assigned_to = _user OR t.current_action_owner = _user)
  UNION ALL
  SELECT 'task', k.id::text, COALESCE(k.title, 'Task')
    FROM public.onboarding_tasks k
   WHERE k.status::text <> 'complete' AND k.assigned_to = _user
  UNION ALL
  SELECT 'work_order', w.id::text, COALESCE(w.title, 'Work Order')
    FROM public.work_orders w
   WHERE w.closed_at IS NULL AND w.assigned_to = _user
  UNION ALL
  SELECT 'approval', a.id::text, 'Approval waiting on them'
    FROM public.approvals a
   WHERE a.status::text = 'pending' AND a.approver_id = _user
  UNION ALL
  SELECT 'seat', r.code, r.name
    FROM public.functional_roles r
   WHERE r.current_seat_holder = _user
$f$;
REVOKE ALL ON FUNCTION public.staff_open_work(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.staff_open_work(uuid) TO authenticated, service_role;

-- One click: hand every open item to the seat, then its backup, then the Operations Supervisor.
CREATE OR REPLACE FUNCTION public.reassign_staff_open_work(_user uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $f$
DECLARE
  v_sup uuid;
  v_n int := 0;
  v_c int;
  r record;
  v_to uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only an Admin can reassign a person''s work.' USING ERRCODE = '42501';
  END IF;
  SELECT current_seat_holder INTO v_sup FROM public.functional_roles WHERE code = 'ops_supervisor';
  IF v_sup = _user THEN v_sup := NULL; END IF;

  FOR r IN SELECT t.id, t.functional_role_code FROM public.tickets t
            WHERE t.status::text NOT IN ('resolved','closed','cancelled')
              AND (t.assigned_to = _user OR t.current_action_owner = _user) LOOP
    v_to := NULL;
    IF r.functional_role_code IS NOT NULL THEN
      v_to := public.seat_holder_at(r.functional_role_code);
      IF v_to = _user OR NOT public.staff_assignable(v_to) THEN
        v_to := (SELECT public.seat_holder_at(fr.backup_role_code) FROM public.functional_roles fr WHERE fr.code = r.functional_role_code);
      END IF;
    END IF;
    IF v_to IS NULL OR v_to = _user OR NOT public.staff_assignable(v_to) THEN v_to := v_sup; END IF;
    UPDATE public.tickets SET
      assigned_to = CASE WHEN assigned_to = _user THEN v_to ELSE assigned_to END,
      current_action_owner = CASE WHEN current_action_owner = _user THEN v_to ELSE current_action_owner END
     WHERE id = r.id;
    v_n := v_n + 1;
  END LOOP;

  UPDATE public.onboarding_tasks SET assigned_to = NULLIF(public.seat_holder_at('onboarding_director'), _user)
   WHERE status::text <> 'complete' AND assigned_to = _user;
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n + v_c;
  UPDATE public.work_orders SET assigned_to = v_sup WHERE closed_at IS NULL AND assigned_to = _user;
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n + v_c;
  UPDATE public.approvals SET approver_id = v_sup WHERE status::text = 'pending' AND approver_id = _user;
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n + v_c;
  -- Seats are emptied (routing then uses the backup seat), never handed to a guess.
  UPDATE public.functional_roles SET current_seat_holder = NULL WHERE current_seat_holder = _user;
  GET DIAGNOSTICS v_c = ROW_COUNT; v_n := v_n + v_c;

  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, after_value)
  VALUES (auth.uid(), 'user.open_work_reassigned', 'user', _user, jsonb_build_object('items', v_n));
  RETURN v_n;
END
$f$;
REVOKE ALL ON FUNCTION public.reassign_staff_open_work(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reassign_staff_open_work(uuid) TO authenticated;

-- Delete a staff user: tombstone, never a row delete. The server action turns the login off after.
CREATE OR REPLACE FUNCTION public.remove_staff_user(_user uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $f$
DECLARE
  v_today date := (now() AT TIME ZONE 'America/Chicago')::date;
  v_roles text[];
  v_pat jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only an Admin can delete a user.' USING ERRCODE = '42501';
  END IF;
  IF _user = auth.uid() THEN
    RAISE EXCEPTION 'You cannot delete your own account.';
  END IF;
  SELECT array_agg(role::text) INTO v_roles FROM public.user_roles WHERE user_id = _user;
  IF v_roles IS NULL OR NOT v_roles && ARRAY['admin','manager','onboarding','tech'] THEN
    RAISE EXCEPTION 'Only staff can be deleted. Archive homeowners and vendors instead.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.staff_open_work(_user)) THEN
    RAISE EXCEPTION 'This person still owns open work. Reassign it first.';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user;
  DELETE FROM public.functional_role_members WHERE user_id = _user;
  DELETE FROM public.department_members WHERE user_id = _user;
  DELETE FROM public.staff_notifications WHERE user_id = _user;
  -- Future on-call nights go; past nights stay as history.
  DELETE FROM public.oncall_roster WHERE user_id = _user AND starts_on >= v_today;
  SELECT value INTO v_pat FROM public.app_settings WHERE key = 'oncall_weekday_pattern';
  IF v_pat IS NOT NULL THEN
    UPDATE public.app_settings
       SET value = (SELECT jsonb_object_agg(k, CASE WHEN v = to_jsonb(_user::text) THEN '""'::jsonb ELSE v END) FROM jsonb_each(v_pat) e(k, v)),
           updated_by = auth.uid(), updated_at = now()
     WHERE key = 'oncall_weekday_pattern';
  END IF;
  UPDATE public.profiles SET removed_at = now(), removed_by = auth.uid(), oncall_eligible = false WHERE id = _user;

  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, before_value, after_value)
  VALUES (auth.uid(), 'user.deleted', 'user', _user, jsonb_build_object('roles', v_roles), jsonb_build_object('removed', true));
END
$f$;
REVOKE ALL ON FUNCTION public.remove_staff_user(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_staff_user(uuid) TO authenticated;

-- Archive or restore a homeowner, co-owner or vendor login. Roles are kept so Restore is exact.
CREATE OR REPLACE FUNCTION public.set_account_archived(_user uuid, _archived boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $f$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only an Admin can archive or restore an account.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user AND role::text IN ('admin','manager','onboarding','tech')) THEN
    RAISE EXCEPTION 'Staff are deleted from the Users tab, not archived.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user AND role::text IN ('owner','vendor')) THEN
    RAISE EXCEPTION 'Only homeowner and vendor accounts can be archived.';
  END IF;
  UPDATE public.profiles
     SET archived_at = CASE WHEN _archived THEN now() END,
         archived_by = CASE WHEN _archived THEN auth.uid() END
   WHERE id = _user;
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, after_value)
  VALUES (auth.uid(), CASE WHEN _archived THEN 'user.archived' ELSE 'user.restored' END, 'user', _user, jsonb_build_object('archived', _archived));
END
$f$;
REVOKE ALL ON FUNCTION public.set_account_archived(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_account_archived(uuid, boolean) TO authenticated;
