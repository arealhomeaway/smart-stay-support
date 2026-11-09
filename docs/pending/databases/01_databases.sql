-- Databases hub (register P3, C1, A10, M2). Staged in docs/pending/databases.
-- Undo: 01_undo_databases.sql
--
-- 1. The menu switch that hides Guest Claims & Refunds from the left menu (off).
--    The claims pages stay reachable by link; Databases is the window.
-- 2. Who may change claims and refunds from the Databases list (register A10):
--    Coordinator, Operations Supervisor, Director of Operations, Admin.
--    Finance views. Onboarding accounts do not.
-- 3. One save for a claim or a refund changed in the list. It runs as the
--    person (row security and every existing claim and refund guard still
--    apply), refuses a stale copy, and writes one history line with the person
--    and the time on the same claim or refund the ticket shows.
-- Nothing is deleted. Nothing else changes.

INSERT INTO public.feature_flags(key, label, description, enabled)
VALUES
  ('claims_menu', 'Guest Claims & Refunds in the menu',
   'When on, Guest Claims & Refunds shows at the end of My day. Claims and refunds are kept in Databases; the pages stay reachable by link.',
   false)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION public.can_edit_claims_in_databases(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
  SELECT _user_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text IN ('admin', 'tech'))
    OR public.is_director(_user_id)
    OR EXISTS (SELECT 1 FROM public.functional_roles WHERE code = 'ops_supervisor' AND current_seat_holder = _user_id)
    OR (
      EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role::text = 'manager')
      AND NOT private.is_accounting(_user_id)
    )
  )
$$;

REVOKE ALL ON FUNCTION public.can_edit_claims_in_databases(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_claims_in_databases(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.databases_save_claim_or_refund(
  _kind text,
  _id uuid,
  _changes jsonb,
  _expected_updated_at timestamptz
)
RETURNS TABLE(record_id uuid, saved_at timestamptz, saved_by uuid)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  _me uuid := auth.uid();
  _now timestamptz := now();
  _key text;
  _allowed text[];
  _labels jsonb := jsonb_build_object(
    'title', 'Item', 'stage', 'Status', 'estimated_amount', 'Estimated cost',
    'submitted_amount', 'Amount sent', 'recovered_amount', 'Amount paid back',
    'proposed_amount', 'Amount', 'follow_up_on', 'Follow up on');
  _names text[] := ARRAY[]::text[];
  _title text;
  _current_updated timestamptz;
  _is_demo boolean;
  _num numeric;
BEGIN
  IF NOT public.can_edit_claims_in_databases(_me) THEN
    RAISE EXCEPTION 'Only Operations can change claims and refunds here.' USING ERRCODE = '42501';
  END IF;
  IF _kind NOT IN ('claim', 'refund') THEN
    RAISE EXCEPTION 'Unknown record.' USING ERRCODE = '22023';
  END IF;
  IF _changes IS NULL OR jsonb_typeof(_changes) <> 'object' OR _changes = '{}'::jsonb THEN
    RAISE EXCEPTION 'Nothing to save.' USING ERRCODE = '22023';
  END IF;

  _allowed := CASE WHEN _kind = 'claim'
    THEN ARRAY['title', 'stage', 'estimated_amount', 'submitted_amount', 'recovered_amount', 'follow_up_on']
    ELSE ARRAY['title', 'proposed_amount', 'follow_up_on'] END;
  FOR _key IN SELECT jsonb_object_keys(_changes) LOOP
    IF NOT (_key = ANY (_allowed)) THEN
      RAISE EXCEPTION 'This cannot be changed here. Open the ticket.' USING ERRCODE = '22023';
    END IF;
    _names := _names || (_labels ->> _key);
  END LOOP;

  IF _changes ? 'title' THEN
    _title := btrim(coalesce(_changes ->> 'title', ''));
    IF _title = '' THEN
      RAISE EXCEPTION 'Item cannot be empty.' USING ERRCODE = '22023';
    END IF;
  END IF;
  FOR _key IN SELECT unnest(ARRAY['estimated_amount', 'submitted_amount', 'recovered_amount', 'proposed_amount']) LOOP
    IF _changes ? _key AND jsonb_typeof(_changes -> _key) <> 'null' THEN
      BEGIN
        _num := (_changes ->> _key)::numeric;
      EXCEPTION WHEN others THEN
        RAISE EXCEPTION 'Amounts must be numbers.' USING ERRCODE = '22023';
      END;
      IF _num < 0 THEN
        RAISE EXCEPTION 'Amounts cannot be below zero.' USING ERRCODE = '22023';
      END IF;
    END IF;
  END LOOP;

  IF _kind = 'claim' THEN
    SELECT c.updated_at, c.is_demo INTO _current_updated, _is_demo
      FROM public.claims c WHERE c.id = _id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'This claim could not be found.' USING ERRCODE = 'P0002';
    END IF;
    IF _expected_updated_at IS NOT NULL AND _current_updated IS DISTINCT FROM _expected_updated_at THEN
      RAISE EXCEPTION 'Someone else changed this. Open it again to see the latest.' USING ERRCODE = '40001';
    END IF;
    UPDATE public.claims c SET
      title = CASE WHEN _changes ? 'title' THEN _title ELSE c.title END,
      stage = CASE WHEN _changes ? 'stage' THEN _changes ->> 'stage' ELSE c.stage END,
      estimated_amount = CASE WHEN _changes ? 'estimated_amount' THEN (_changes ->> 'estimated_amount')::numeric ELSE c.estimated_amount END,
      submitted_amount = CASE WHEN _changes ? 'submitted_amount' THEN (_changes ->> 'submitted_amount')::numeric ELSE c.submitted_amount END,
      recovered_amount = CASE WHEN _changes ? 'recovered_amount' THEN (_changes ->> 'recovered_amount')::numeric ELSE c.recovered_amount END,
      follow_up_on = CASE WHEN _changes ? 'follow_up_on' THEN (_changes ->> 'follow_up_on')::date ELSE c.follow_up_on END,
      updated_at = _now
    WHERE c.id = _id;
    INSERT INTO public.claim_activity(claim_id, author_id, event_type, body, detail, is_demo)
    VALUES (_id, _me, 'database_edit', 'Changed in Databases: ' || array_to_string(_names, ', '),
            jsonb_build_object('changes', _changes, 'from', 'databases'), coalesce(_is_demo, false));
  ELSE
    SELECT r.updated_at, r.is_demo INTO _current_updated, _is_demo
      FROM public.guest_recovery r WHERE r.id = _id FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'This refund or credit could not be found.' USING ERRCODE = 'P0002';
    END IF;
    IF _expected_updated_at IS NOT NULL AND _current_updated IS DISTINCT FROM _expected_updated_at THEN
      RAISE EXCEPTION 'Someone else changed this. Open it again to see the latest.' USING ERRCODE = '40001';
    END IF;
    UPDATE public.guest_recovery r SET
      title = CASE WHEN _changes ? 'title' THEN _title ELSE r.title END,
      proposed_amount = CASE WHEN _changes ? 'proposed_amount' THEN (_changes ->> 'proposed_amount')::numeric ELSE r.proposed_amount END,
      follow_up_on = CASE WHEN _changes ? 'follow_up_on' THEN (_changes ->> 'follow_up_on')::date ELSE r.follow_up_on END,
      updated_at = _now
    WHERE r.id = _id;
    INSERT INTO public.guest_recovery_activity(recovery_id, author_id, event_type, body, detail, is_demo)
    VALUES (_id, _me, 'database_edit', 'Changed in Databases: ' || array_to_string(_names, ', '),
            jsonb_build_object('changes', _changes, 'from', 'databases'), coalesce(_is_demo, false));
  END IF;

  RETURN QUERY SELECT _id, _now, _me;
END;
$$;

REVOKE ALL ON FUNCTION public.databases_save_claim_or_refund(text, uuid, jsonb, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.databases_save_claim_or_refund(text, uuid, jsonb, timestamptz) TO authenticated, service_role;
