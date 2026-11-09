-- Cancelled live check of the applied step (nothing kept). Run Nov 9 2026 UTC.
-- A real Property Coordinator makes one practice ticket with a claim on a real home,
-- changes the claim through the Databases save, reads it back on its ticket with the
-- person and the time, then Finance and an onboarding account try and are refused.
-- The deliberate error at the end cancels everything.
DO $final$
DECLARE
  _home uuid := 'cc77a4df-0fa2-466d-bd6d-8c4217e84b03';
  _pc uuid := '1a4b8de5-0824-4066-8691-8e6bb912f964';
  _onb uuid := 'f2a762fa-f28b-4df3-8f33-a94461c6837f';
  _fin uuid := (SELECT ur.user_id FROM public.user_roles ur WHERE ur.role::text = 'manager' AND private.is_accounting(ur.user_id) LIMIT 1);
  _wt uuid := (SELECT id FROM public.work_types WHERE name = 'Immediate maintenance');
  _out text := '';
  _tid uuid; _cid uuid; _r record; _c record; _h record; _stamp timestamptz; _err text;
BEGIN
  _out := _out || format(E'\nFinance account found: %s', _fin IS NOT NULL);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _pc, 'role', 'authenticated')::text, true);
  SET LOCAL ROLE authenticated;
  INSERT INTO public.tickets (is_demo, record_type, title, description, property_id, work_type_id, entry_kind,
    category, functional_role_code, suggested_priority, priority, source_channel, reported_at, created_by, record_owner, accountable_owner, status)
  SELECT false, 'active_task', 'PRACTICE Broken TV', 'PRACTICE Broken TV', _home, wt.id, 'maintenance',
    wt.category, wt.functional_role_code, 'p3', 'p3', 'guest_message', now(), _pc, _pc, _pc, 'open'
  FROM public.work_types wt WHERE wt.id = _wt RETURNING id INTO _tid;
  INSERT INTO public.claims (title, claim_type, stage, property_id, ticket_id, created_by, is_demo, estimated_amount)
  VALUES ('PRACTICE Broken TV', 'guest_damage', 'gathering', _home, _tid, _pc, false, 300)
  RETURNING id, updated_at INTO _cid, _stamp;
  SELECT * INTO _r FROM public.databases_save_claim_or_refund('claim', _cid, '{"stage":"costing","submitted_amount":420}'::jsonb, _stamp);
  RESET ROLE;
  SELECT c.stage, c.submitted_amount, c.ticket_id = _tid same_ticket, c.updated_at = _r.saved_at stamped INTO _c FROM public.claims c WHERE c.id = _cid;
  SELECT count(*) n, max(author_id::text) who, max(body) body, max(created_at) at INTO _h FROM public.claim_activity WHERE claim_id = _cid AND event_type = 'database_edit';
  _out := _out || format(E'\nClaim on its ticket: stage=%s amount sent=%s same ticket=%s saved by coordinator=%s stamped=%s',
    _c.stage, _c.submitted_amount, _c.same_ticket, _r.saved_by = _pc, _c.stamped);
  _out := _out || format(E'\nHistory: lines=%s by coordinator=%s body=%s time set=%s', _h.n, _h.who = _pc::text, _h.body, _h.at IS NOT NULL);

  FOREACH _err IN ARRAY ARRAY[coalesce(_fin::text, ''), _onb::text] LOOP
    CONTINUE WHEN _err = '';
    BEGIN
      PERFORM set_config('request.jwt.claims', json_build_object('sub', _err, 'role', 'authenticated')::text, true);
      SET LOCAL ROLE authenticated;
      PERFORM public.databases_save_claim_or_refund('claim', _cid, '{"stage":"closed"}'::jsonb, NULL);
      RESET ROLE;
      _out := _out || format(E'\n%s: NOT refused', _err);
    EXCEPTION WHEN others THEN
      RESET ROLE;
      _out := _out || format(E'\n%s refused: %s', CASE WHEN _err = _onb::text THEN 'Onboarding' ELSE 'Finance' END, SQLERRM);
    END;
  END LOOP;
  SELECT c.stage INTO _c FROM public.claims c WHERE c.id = _cid;
  _out := _out || format(E'\nStage after refusals: %s', _c.stage);
  RAISE EXCEPTION 'FINAL CHECK (rolled back): %', _out;
END;
$final$;
