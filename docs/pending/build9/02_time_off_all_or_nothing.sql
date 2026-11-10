-- Build 9 C2 (APPLY): approving time off is all or nothing.
-- One new function, approve_time_off(_id, _overrides, _note). In one transaction it saves
-- every time off and cover row the Supervisor chose (the same coverage_overrides rows and
-- audit lines the Add time off form already saves one by one), then approves the request
-- through the existing decide_time_off, which tells the person. If any row is refused
-- (bad times, no cover person, a protected leadership role without Admin, a request already
-- decided) nothing at all is saved. decide_time_off, coverage_overrides, its triggers and
-- every other function are unchanged.
-- Undo: undo/02_time_off_all_or_nothing.sql
-- No BEGIN/COMMIT: the migration tool runs this file in one transaction.

CREATE OR REPLACE FUNCTION public.approve_time_off(_id uuid, _overrides jsonb, _note text DEFAULT NULL)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_me uuid := auth.uid();
  v_r public.time_off_requests%ROWTYPE;
  v_o jsonb;
  v_kind text;
  v_role text;
  v_user uuid;
  v_from timestamptz;
  v_to timestamptz;
  v_note text;
  v_row public.coverage_overrides%ROWTYPE;
  v_n integer := 0;
BEGIN
  IF v_me IS NULL OR NOT public.is_supervisor(v_me) THEN
    RAISE EXCEPTION 'Only Operations leadership can decide time off.';
  END IF;
  SELECT * INTO v_r FROM public.time_off_requests WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'This request could not be found.'; END IF;
  IF v_r.status <> 'pending' THEN RAISE EXCEPTION 'This request was already decided.'; END IF;
  IF _overrides IS NULL OR jsonb_typeof(_overrides) <> 'array' THEN
    RAISE EXCEPTION 'The time off could not be read. Try again.';
  END IF;
  IF jsonb_array_length(_overrides) > 50 THEN RAISE EXCEPTION 'Too many changes at once.'; END IF;

  FOR v_o IN SELECT value FROM jsonb_array_elements(_overrides) LOOP
    v_kind := v_o->>'kind';
    v_role := nullif(btrim(coalesce(v_o->>'role_code', '')), '');
    v_user := nullif(v_o->>'user_id', '')::uuid;
    v_from := (v_o->>'starts_at')::timestamptz;
    v_to := (v_o->>'ends_at')::timestamptz;
    v_note := nullif(left(btrim(coalesce(v_o->>'note', '')), 400), '');
    IF v_kind NOT IN ('off', 'cover') THEN RAISE EXCEPTION 'Choose time off or cover.'; END IF;
    IF v_role IS NULL OR NOT EXISTS (SELECT 1 FROM public.functional_roles WHERE code = v_role) THEN
      RAISE EXCEPTION 'Choose a role.';
    END IF;
    IF v_from IS NULL OR v_to IS NULL OR v_to <= v_from THEN
      RAISE EXCEPTION 'The override needs an end after its start.';
    END IF;
    IF v_kind = 'cover' AND v_user IS NULL THEN RAISE EXCEPTION 'Choose who is covering.'; END IF;
    IF v_kind = 'off' THEN v_user := NULL; END IF;
    -- Same rule as the Add time off form: only an Admin changes the three leadership roles.
    IF v_role IN ('director_onboarding', 'onboarding_director', 'director_ops', 'ops_supervisor')
       AND NOT coalesce(public.has_role(v_me, 'admin'), false) THEN
      RAISE EXCEPTION 'Only an Admin can change cover for this role.';
    END IF;
    INSERT INTO public.coverage_overrides(role_code, kind, user_id, starts_at, ends_at, note, created_by)
    VALUES (v_role, v_kind, v_user, v_from, v_to, v_note, v_me)
    RETURNING * INTO v_row;
    INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, before_value, after_value)
    VALUES (v_me, 'coverage.override_added', 'coverage_override', v_row.id, v_role, NULL,
      jsonb_build_object('role_code', v_role, 'kind', v_kind, 'user_id', v_user, 'starts_at', v_from,
        'ends_at', v_to, 'note', v_note, 'created_by', v_me, 'time_off_request_id', _id));
    v_n := v_n + 1;
  END LOOP;

  -- The existing decision: status, who and when, and the message to the person.
  PERFORM public.decide_time_off(_id, 'approved', _note);
  RETURN v_n;
END
$function$;

REVOKE ALL ON FUNCTION public.approve_time_off(uuid, jsonb, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_time_off(uuid, jsonb, text) TO authenticated, service_role;
