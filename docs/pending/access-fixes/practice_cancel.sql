-- Cancelled live check of 01_access_fixes.sql (nothing kept). The deliberate error at the end
-- cancels everything, including the rule changes themselves. Real accounts, real roles on top.
DO $practice$
DECLARE
  _admin uuid := '98bd6696-4018-4965-b645-0471c5ae3925';   -- Admin (COO role on top)
  _sup uuid := 'ea6708cd-7f53-4b36-bec8-f5b2a597e6db';     -- Supervisor account, Operations Supervisor
  _fin uuid := '644ffc2f-b0a1-4bc7-8eb1-bb4e959cadce';     -- Supervisor account, Finance lead on top
  _dops uuid := '452f6db5-ba38-44bf-a8bd-f4b9197a0032';    -- Supervisor account, Director of Operations
  _donb uuid := '40de2f41-5596-4ec1-98d7-29e16549a25f';    -- Onboarding account, Director of Onboarding
  _pm uuid := '82bdbc3a-791c-433a-9944-651661f89eb1';      -- Onboarding account, Project Manager
  _pmu uuid := 'f2a762fa-f28b-4df3-8f33-a94461c6837f';     -- Onboarding account, Project Manager and Utilities
  _coord uuid := '1a4b8de5-0824-4066-8691-8e6bb912f964';   -- Coordinator account
  _out text := '';
  _u uuid; _n int; _total int; _ev int; _err text;
BEGIN
  SELECT count(*) INTO _total FROM public.help_tickets;
  SELECT count(*) INTO _ev FROM public.help_ticket_events;
  _out := _out || format('help tickets %s, events %s; ', _total, _ev);
  FOREACH _u IN ARRAY ARRAY[_admin,_sup,_fin,_dops,_donb,_pm,_pmu,_coord] LOOP
    _out := _out || format('editor before %s=%s; ', left(_u::text,4), private.home_profile_editor(_u));
  END LOOP;

  EXECUTE $stage$
-- Build 5 of 7: access fixes (Emily, Nov 7 to 9; register A12, A14, A20). Staged in docs/pending/access-fixes/.

-- A20 Help tickets: everyone reads their own reports. Only the Admin reads every report,
-- changes a status and writes the reply thread. The Director of Operations no longer does.
ALTER POLICY "Leadership reads help tickets" ON public.help_tickets
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR submitted_by = auth.uid());
ALTER POLICY "Leadership updates help tickets" ON public.help_tickets
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
ALTER POLICY "Leadership reads help ticket events" ON public.help_ticket_events
  USING (public.has_role(auth.uid(), 'admin'::app_role));
ALTER POLICY "Leadership writes help ticket events" ON public.help_ticket_events
  WITH CHECK (author_id = auth.uid() AND public.has_role(auth.uid(), 'admin'::app_role));

-- A14 Users: the Director of Onboarding adds people to their own department (Onboarding staff
-- account type only). Admin and Operations leadership rules are unchanged.
CREATE POLICY "Director of Onboarding creates Onboarding invites" ON public.team_invites
  FOR INSERT TO authenticated
  WITH CHECK (role = 'onboarding'::app_role AND public.is_onboarding_director(auth.uid()));
CREATE POLICY "Director of Onboarding reads Onboarding invites" ON public.team_invites
  FOR SELECT TO authenticated
  USING (role = 'onboarding'::app_role AND public.is_onboarding_director(auth.uid()));
CREATE POLICY "Director of Onboarding updates Onboarding invites" ON public.team_invites
  FOR UPDATE TO authenticated
  USING (role = 'onboarding'::app_role AND public.is_onboarding_director(auth.uid()))
  WITH CHECK (role = 'onboarding'::app_role AND public.is_onboarding_director(auth.uid()));

-- A12 Properties: Finance views homes. A person whose only work role is Finance on a
-- Supervisor type account (no Operations Supervisor held or covered, no Director, no Admin,
-- no Coordinator or Onboarding account type) no longer edits home details, labels or photos.
-- Everything else in this rule is exactly as captured live on Nov 10, 2026.
CREATE OR REPLACE FUNCTION private.home_profile_editor(_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  SELECT _uid IS NOT NULL
    AND public.is_internal_staff(_uid)
    AND NOT (
      -- Finance only: a finance role and no other work role.
      EXISTS (SELECT 1 FROM public.functional_role_members m WHERE m.user_id = _uid AND m.role_code IN ('finance_lead','accounting'))
      AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role IN ('admin','manager'))
      AND NOT EXISTS (SELECT 1 FROM public.functional_role_members m WHERE m.user_id = _uid AND m.role_code NOT IN ('finance_lead','accounting','cfo_owner_liaison'))
    )
    AND NOT (
      -- Utilities only.
      EXISTS (SELECT 1 FROM public.functional_role_members m WHERE m.user_id = _uid AND m.role_code = 'utilities')
      AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role IN ('admin','manager','tech'))
      AND NOT EXISTS (SELECT 1 FROM public.functional_role_members m WHERE m.user_id = _uid AND m.role_code <> 'utilities')
    )
    AND NOT (
      -- Finance on a Supervisor type account with no other work role (register A12, Nov 10).
      private.is_accounting(_uid)
      AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role = 'manager')
      AND NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid AND r.role IN ('admin','tech','onboarding'))
      AND NOT private.is_director(_uid)
      AND NOT public.holds_functional_role(_uid, 'ops_supervisor')
      AND public.seat_holder_at('ops_supervisor', now()) IS DISTINCT FROM _uid
      AND NOT public.is_onboarding_director(_uid)
    )
$function$;

$stage$;

  FOREACH _u IN ARRAY ARRAY[_admin,_sup,_fin,_dops,_donb,_pm,_pmu,_coord] LOOP
    _out := _out || format('editor after %s=%s; ', left(_u::text,4), private.home_profile_editor(_u));
  END LOOP;

  -- Policies, checked as each signed in person.
  FOREACH _u IN ARRAY ARRAY[_admin,_dops,_sup,_donb,_pm,_coord] LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', _u, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    SELECT count(*) INTO _n FROM public.help_tickets;
    _out := _out || format('sees help %s=%s', left(_u::text,4), _n);
    SELECT count(*) INTO _n FROM public.help_tickets WHERE submitted_by IS DISTINCT FROM _u;
    _out := _out || format(' (others %s)', _n);
    SELECT count(*) INTO _n FROM public.help_ticket_events;
    _out := _out || format(' events %s', _n);
    UPDATE public.help_tickets SET updated_at = updated_at WHERE true;
    GET DIAGNOSTICS _n = ROW_COUNT;
    _out := _out || format(' can update %s; ', _n);
    EXECUTE 'RESET ROLE';
  END LOOP;

  -- A14: the Director of Onboarding adds Onboarding staff only.
  FOREACH _u IN ARRAY ARRAY[_donb,_pm,_dops] LOOP
    PERFORM set_config('request.jwt.claims', json_build_object('sub', _u, 'role', 'authenticated')::text, true);
    EXECUTE 'SET LOCAL ROLE authenticated';
    BEGIN
      INSERT INTO public.team_invites (code, role, expires_at, created_by) VALUES ('PRAC-' || left(_u::text,4) || 'O', 'onboarding', now() + interval '1 day', _u);
      _out := _out || format('invite onboarding %s=ok; ', left(_u::text,4));
    EXCEPTION WHEN others THEN _out := _out || format('invite onboarding %s=refused; ', left(_u::text,4));
    END;
    BEGIN
      INSERT INTO public.team_invites (code, role, expires_at, created_by) VALUES ('PRAC-' || left(_u::text,4) || 'T', 'tech', now() + interval '1 day', _u);
      _out := _out || format('invite coordinator %s=ok; ', left(_u::text,4));
    EXCEPTION WHEN others THEN _out := _out || format('invite coordinator %s=refused; ', left(_u::text,4));
    END;
    SELECT count(*) INTO _n FROM public.team_invites WHERE code LIKE 'PRAC-%';
    _out := _out || format('sees practice codes %s=%s; ', left(_u::text,4), _n);
    EXECUTE 'RESET ROLE';
  END LOOP;

  RAISE EXCEPTION 'PRACTICE CANCELLED: %', _out;
END
$practice$;

-- Result, Nov 10 2026 (the practice raised its cancel error, so nothing was kept):
--   help tickets 64, events 83.
--   Home editing: before, every account listed could edit; after, only the Finance lead on the
--   Supervisor account stops editing. Admin, Operations Supervisor, Director of Operations,
--   Director of Onboarding, Project Manager, Project Manager with Utilities and the Coordinator still edit.
--   Help tickets as each person: Admin sees all 64, sees all 83 events and could update 64.
--   Director of Operations sees 0 (none of their own), 0 events, could update 0 (before: all 64).
--   Operations Supervisor 0 / 0 / 0. Director of Onboarding sees their own 56 only, 0 events, updates 0.
--   Project Manager sees their own 4 only. Coordinator 0.
--   Invite codes: Director of Onboarding made an Onboarding staff code and was refused a Coordinator
--   code, and sees only their Onboarding code; a Project Manager was refused both; the Director of
--   Operations was refused an Onboarding code and made a Coordinator code (unchanged).
--   Afterwards: no practice codes, the three new rules absent and the help rules as before.
