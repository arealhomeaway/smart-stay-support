-- Practice for onboarding-roles-attach: apply.sql unchanged, the cases, apply.undo.sql unchanged, read back,
-- all in one transaction that always rolls back (the last statement raises 'PRACTICE ROLLED BACK').
CREATE TEMP TABLE _out (n serial, line text) ON COMMIT DROP;
CREATE TEMP TABLE _before ON COMMIT DROP AS SELECT
  (SELECT md5(string_agg(id::text || ':' || coalesce(assigned_to::text, '-'), ',' ORDER BY id)) FROM public.onboarding_tasks) AS task_people,
  (SELECT md5(string_agg(id::text || ':' || coalesce(role_assignments::text, '-'), ',' ORDER BY id)) FROM public.onboarding_projects) AS project_roles,
  (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.set_onboarding_project_role(uuid,text,uuid,boolean)'::regprocedure) AS team_rule,
  (SELECT count(*) FROM public.owner_notifications) AS notices, (SELECT count(*) FROM public.email_log) AS emails,
  (SELECT count(*) FROM public.home_chat_messages) AS chat, (SELECT count(*) FROM public.onboarding_project_events) AS events;
-- ===== apply.sql (unchanged) =====
-- onboarding-roles-attach: the Designer and Onboarding Manager attach to every new home and its Tasks,
-- and in-progress homes that already name them get their unowned open Tasks. One transaction.
-- Nothing is deleted. No Task that already names a person changes. Demo homes are left alone.

-- 0. Stop if anything differs from what was checked on Nov 21.
DO $guard$
BEGIN
  IF (SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.set_onboarding_project_role(uuid,text,uuid,boolean)'::regprocedure)
     <> 'dc182627c9d96da99e3c1367e3651191' THEN
    RAISE EXCEPTION 'onboarding-roles-attach: set_onboarding_project_role changed since it was staged';
  END IF;
  IF (SELECT string_agg(tgname, ',' ORDER BY tgname) FROM pg_trigger
       WHERE tgrelid = 'public.onboarding_projects'::regclass AND NOT tgisinternal)
     <> 'ao_handoff_accepted,followed_home_handoff_notice,lock_committed_handoff,notify_onboarding_handoff_ready,onboarding_review_handoff_guard,protect_onboarding_project_assignments,protect_onboarding_project_gate_fields,recalc_plan_dates_on_anchor_change,update_onboarding_projects_updated_at' THEN
    RAISE EXCEPTION 'onboarding-roles-attach: home project rules changed since it was staged';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'private' AND p.proname IN ('default_project_role_person', 'fill_new_project_roles')) THEN
    RAISE EXCEPTION 'onboarding-roles-attach: the new rule already exists';
  END IF;
END $guard$;

-- 1. Who a new home gets for a role: the role's holder when one is set, else the only person in that
-- role's pool. With nobody, or several and no holder, the role stays empty and the home shows as missing it.
CREATE FUNCTION private.default_project_role_person(_role text)
 RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT coalesce(
    (SELECT f.current_seat_holder FROM public.functional_roles f WHERE f.code = _role AND f.active),
    (SELECT min(m.user_id::text)::uuid FROM public.functional_role_members m WHERE m.role_code = _role
      HAVING count(DISTINCT m.user_id) = 1))
$function$;
REVOKE ALL ON FUNCTION private.default_project_role_person(text) FROM PUBLIC, anon, authenticated;

-- 2. Every new home (Start onboarding, Add home, any other path) gets its Designer and Onboarding
-- Manager before its plan is made, so the plan's Tasks for those roles open with that person on them.
-- A person already chosen is never replaced.
CREATE FUNCTION private.fill_new_project_roles()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE r text; who uuid; filled jsonb := '{}'::jsonb;
BEGIN
  IF coalesce(NEW.is_demo, false) THEN RETURN NEW; END IF;
  NEW.role_assignments := coalesce(NEW.role_assignments, '{}'::jsonb);
  FOREACH r IN ARRAY ARRAY['onboarding_manager', 'designer'] LOOP
    IF nullif(NEW.role_assignments->>r, '') IS NULL THEN
      who := private.default_project_role_person(r);
      IF who IS NOT NULL THEN
        NEW.role_assignments := NEW.role_assignments || jsonb_build_object(r, who);
        filled := filled || jsonb_build_object(r, who);
      END IF;
    END IF;
  END LOOP;
  IF filled <> '{}'::jsonb THEN
    INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
    VALUES (auth.uid(), 'onboarding.project_roles_defaulted', 'onboarding_project', NEW.id, NULL,
            jsonb_build_object('property_id', NEW.property_id, 'roles', filled));
  END IF;
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION private.fill_new_project_roles() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER onboarding_project_default_roles BEFORE INSERT ON public.onboarding_projects
  FOR EACH ROW EXECUTE FUNCTION private.fill_new_project_roles();

-- 3. Choosing the Designer or Onboarding Manager on a home later also gives that person the home's
-- open Tasks for the role that have nobody on them (functions-before.sql -> functions-after.sql).
CREATE OR REPLACE FUNCTION public.set_onboarding_project_role(_project_id uuid, _role_code text, _user_id uuid, _reassign_pending boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE pr public.onboarding_projects; previous uuid; assignments jsonb; moved integer:=0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_project_team(auth.uid()) THEN
    RAISE EXCEPTION 'Only the Onboarding Director or leadership can change the Onboarding team.';
  END IF;
  IF _role_code IS NULL OR _role_code IN ('property_coordinator','owner','onboarding_director') THEN
    RAISE EXCEPTION 'That role is not assigned from the Project Team.';
  END IF;
  SELECT * INTO pr FROM public.onboarding_projects WHERE id=_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That onboarding project was not found.'; END IF;
  assignments:=coalesce(pr.role_assignments,'{}'::jsonb);
  previous:=CASE _role_code WHEN 'onboarding_project_manager' THEN pr.project_manager
                            WHEN 'utilities' THEN pr.utility_manager
                            ELSE nullif(assignments->>_role_code,'')::uuid END;
  IF previous IS NOT DISTINCT FROM _user_id THEN
    RETURN jsonb_build_object('ok',true,'changed',false,'moved',0);
  END IF;
  IF _role_code='onboarding_project_manager' THEN
    UPDATE public.onboarding_projects SET project_manager=_user_id WHERE id=pr.id;
  ELSIF _role_code='utilities' THEN
    UPDATE public.onboarding_projects SET utility_manager=_user_id WHERE id=pr.id;
  ELSE
    assignments:=CASE WHEN _user_id IS NULL THEN assignments-_role_code ELSE assignments||jsonb_build_object(_role_code,_user_id) END;
    UPDATE public.onboarding_projects SET role_assignments=assignments WHERE id=pr.id;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'The project assignment could not be saved.'; END IF;
  -- SECURITY INVOKER retains all current row policies and responsibility triggers.
  IF _reassign_pending OR _role_code='onboarding_project_manager' THEN
    UPDATE public.onboarding_tasks SET assigned_to=_user_id
    WHERE property_id=pr.property_id AND assigned_seat=_role_code
      AND status IN ('open','in_progress','blocked') AND archived_at IS NULL AND exception_at IS NULL;
    GET DIAGNOSTICS moved=ROW_COUNT;
  ELSIF _user_id IS NOT NULL AND _role_code IN ('designer','onboarding_manager') THEN
    -- Nov 21: the Designer and Onboarding Manager always take this home's open Tasks for their role
    -- that have nobody on them. Tasks that already name someone stay with that person.
    UPDATE public.onboarding_tasks SET assigned_to=_user_id
    WHERE property_id=pr.property_id AND assigned_seat=_role_code AND assigned_to IS NULL
      AND status IN ('open','in_progress','blocked') AND archived_at IS NULL AND exception_at IS NULL;
    GET DIAGNOSTICS moved=ROW_COUNT;
  END IF;
  PERFORM private.write_project_team_change_audit(pr.id,_role_code,previous,_user_id,moved);
  RETURN jsonb_build_object('ok',true,'changed',true,'moved',moved);
END $function$

;

-- 4. Repair: in-progress homes (active or planning, not demo) whose record already names the Designer or
-- Onboarding Manager. Their open Tasks for that role with nobody on them get that person. Nothing else.
CREATE TEMP TABLE _roles_attach ON COMMIT DROP AS
SELECT t.id, t.property_id, t.assigned_seat AS role, (op.role_assignments->>t.assigned_seat)::uuid AS person
FROM public.onboarding_tasks t
JOIN public.onboarding_projects op ON op.property_id = t.property_id
WHERE op.status IN ('active', 'planning') AND NOT coalesce(op.is_demo, false)
  AND t.assigned_seat IN ('designer', 'onboarding_manager')
  AND nullif(op.role_assignments->>t.assigned_seat, '') IS NOT NULL
  AND t.assigned_to IS NULL
  AND t.status IN ('open', 'in_progress', 'blocked') AND t.archived_at IS NULL AND t.exception_at IS NULL;

UPDATE public.onboarding_tasks t SET assigned_to = a.person
FROM _roles_attach a WHERE t.id = a.id AND t.assigned_to IS NULL;

INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
SELECT NULL, 'onboarding_roles_attach.repair', 'onboarding_tasks', NULL, 'Designer and Onboarding Manager Tasks',
  jsonb_build_object(
    'tasks', (SELECT count(*) FROM _roles_attach),
    'by_home', (SELECT coalesce(jsonb_object_agg(k, n), '{}'::jsonb) FROM (
       SELECT property_id::text || ':' || role AS k, count(*) AS n FROM _roles_attach GROUP BY 1) s),
    'attached', (SELECT coalesce(jsonb_agg(jsonb_build_object('task', id, 'person', person) ORDER BY id), '[]'::jsonb) FROM _roles_attach));

INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
VALUES (NULL, 'onboarding_roles_attach.applied', 'function', NULL, 'Designer and Onboarding Manager attach',
  jsonb_build_object('trigger', 'onboarding_project_default_roles', 'function', 'set_onboarding_project_role'));

-- ===== cases =====
INSERT INTO _out(line) SELECT 'repair attached ' || (after_value->>'tasks') || ' Tasks' FROM public.audit_log WHERE action = 'onboarding_roles_attach.repair';
INSERT INTO _out(line)
SELECT 'home ' || p.name || ' | ' || x.role || ' | attached ' || count(*)
FROM _roles_attach x JOIN public.properties p ON p.id = x.property_id GROUP BY p.name, x.role ORDER BY p.name, x.role;
INSERT INTO _out(line) SELECT 'open role Tasks still with nobody where the home names the role: ' || count(*)
FROM public.onboarding_tasks t JOIN public.onboarding_projects op ON op.property_id = t.property_id
WHERE op.status IN ('active','planning') AND NOT op.is_demo AND t.assigned_seat IN ('designer','onboarding_manager')
  AND nullif(op.role_assignments->>t.assigned_seat,'') IS NOT NULL AND t.assigned_to IS NULL
  AND t.status IN ('open','in_progress','blocked') AND t.archived_at IS NULL AND t.exception_at IS NULL;
INSERT INTO _out(line) SELECT 'finished Tasks changed: ' || count(*) FROM public.onboarding_tasks t JOIN _roles_attach a ON a.id = t.id WHERE t.status NOT IN ('open','in_progress','blocked');

-- Case A: a new home added through Add home, signed in as the Director of Onboarding.
SELECT set_config('request.jwt.claims', '{"sub":"40de2f41-5596-4ec1-98d7-29e16549a25f","role":"authenticated"}', true);
DO $a$
DECLARE r jsonb; ra jsonb;
BEGIN
  r := public.add_upcoming_onboarding_home(gen_random_uuid(), '1 Practice Way', NULL, 'Tulsa', 'OK', NULL, NULL, 'Practice contact', NULL);
  SELECT role_assignments INTO ra FROM public.onboarding_projects WHERE id = (r->>'project_id')::uuid;
  INSERT INTO _out(line) VALUES ('case A new home roles: designer=' || coalesce(ra->>'designer','none') || ' onboarding_manager=' || coalesce(ra->>'onboarding_manager','none'));
  INSERT INTO _out(line) SELECT 'case A history line: ' || count(*) FROM public.audit_log WHERE action = 'onboarding.project_roles_defaulted' AND entity_id = (r->>'project_id')::uuid;
END $a$;

-- Case B: a new home with a Designer already chosen keeps that choice.
DO $b$
DECLARE pid uuid; prj uuid; ra jsonb;
BEGIN
  INSERT INTO public.properties(name, address_line1, city, state, lifecycle_status) VALUES ('2 Practice Way','2 Practice Way','Tulsa','OK','onboarding') RETURNING id INTO pid;
  INSERT INTO public.onboarding_projects(property_id, status, started_by, furnishing_scope, role_assignments)
  VALUES (pid, 'planning', '40de2f41-5596-4ec1-98d7-29e16549a25f', 'full_furnishing', jsonb_build_object('designer', 'f2a762fa-f28b-4df3-8f33-a94461c6837f')) RETURNING id, role_assignments INTO prj, ra;
  INSERT INTO _out(line) VALUES ('case B chosen Designer kept: ' || (ra->>'designer' = 'f2a762fa-f28b-4df3-8f33-a94461c6837f')::text || ', Onboarding Manager filled: ' || (ra ? 'onboarding_manager')::text);
END $b$;

-- Case C: a demo home is left alone.
DO $c$
DECLARE pid uuid; ra jsonb;
BEGIN
  INSERT INTO public.properties(name, address_line1, city, state, lifecycle_status, is_demo) VALUES ('DEMO 3 Practice Way','3 Practice Way','Tulsa','OK','onboarding', true) RETURNING id INTO pid;
  INSERT INTO public.onboarding_projects(property_id, status, started_by, furnishing_scope, is_demo) VALUES (pid, 'planning', '40de2f41-5596-4ec1-98d7-29e16549a25f', 'full_furnishing', true) RETURNING role_assignments INTO ra;
  INSERT INTO _out(line) VALUES ('case C demo home roles: ' || coalesce(ra::text, 'none'));
END $c$;

-- Case D: the Director names the Designer on 3400 N Fern Avenue without ticking move pending.
DO $d$
DECLARE r jsonb; open_none int; others int;
BEGIN
  SELECT count(*) INTO others FROM public.onboarding_tasks t JOIN public.onboarding_projects op ON op.property_id = t.property_id
   WHERE op.id = 'b36734a1-af43-49f6-a732-01ba91c98df5' AND t.assigned_seat = 'designer' AND t.assigned_to IS NOT NULL;
  r := public.set_onboarding_project_role('b36734a1-af43-49f6-a732-01ba91c98df5', 'designer', '40de2f41-5596-4ec1-98d7-29e16549a25f', false);
  SELECT count(*) INTO open_none FROM public.onboarding_tasks t JOIN public.onboarding_projects op ON op.property_id = t.property_id
   WHERE op.id = 'b36734a1-af43-49f6-a732-01ba91c98df5' AND t.assigned_seat = 'designer' AND t.assigned_to IS NULL AND t.status IN ('open','in_progress','blocked') AND t.archived_at IS NULL AND t.exception_at IS NULL;
  INSERT INTO _out(line) VALUES ('case D Fern Designer set: ' || r::text || '; open Designer Tasks with nobody after: ' || open_none || '; Tasks that already named someone before: ' || others);
END $d$;

INSERT INTO _out(line) SELECT 'notices/emails/chat/events created: '
  || ((SELECT count(*) FROM public.owner_notifications) - b.notices) || '/' || ((SELECT count(*) FROM public.email_log) - b.emails) || '/'
  || ((SELECT count(*) FROM public.home_chat_messages) - b.chat) || '/' || ((SELECT count(*) FROM public.onboarding_project_events) - b.events) || ' (events include case A Add home)'
FROM _before b;

-- Undo the Fern case and the practice homes first, so the undo is checked against the apply alone.
UPDATE public.onboarding_tasks t SET assigned_to = NULL FROM public.onboarding_projects op
 WHERE op.id = 'b36734a1-af43-49f6-a732-01ba91c98df5' AND op.property_id = t.property_id AND t.assigned_seat = 'designer' AND t.assigned_to = '40de2f41-5596-4ec1-98d7-29e16549a25f'
   AND t.status IN ('open','in_progress','blocked');
UPDATE public.onboarding_projects SET role_assignments = role_assignments - 'designer' WHERE id = 'b36734a1-af43-49f6-a732-01ba91c98df5';
SELECT set_config('request.jwt.claims', '', true);
-- ===== apply.undo.sql (unchanged) =====
-- onboarding-roles-attach: undo. Takes the person back off exactly the Tasks the repair attached, where
-- that person is still on them, restores set_onboarding_project_role exactly, removes the new rule.
UPDATE public.onboarding_tasks t SET assigned_to = NULL
FROM (SELECT (e->>'task')::uuid AS id, (e->>'person')::uuid AS person
        FROM public.audit_log l, jsonb_array_elements(l.after_value->'attached') e
       WHERE l.action = 'onboarding_roles_attach.repair'
       ORDER BY l.created_at DESC) a
WHERE t.id = a.id AND t.assigned_to = a.person;
DROP TRIGGER IF EXISTS onboarding_project_default_roles ON public.onboarding_projects;
DROP FUNCTION IF EXISTS private.fill_new_project_roles();
DROP FUNCTION IF EXISTS private.default_project_role_person(text);
CREATE OR REPLACE FUNCTION public.set_onboarding_project_role(_project_id uuid, _role_code text, _user_id uuid, _reassign_pending boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public', 'private', 'pg_temp'
AS $function$
DECLARE pr public.onboarding_projects; previous uuid; assignments jsonb; moved integer:=0;
BEGIN
  IF auth.uid() IS NULL OR NOT public.can_manage_project_team(auth.uid()) THEN
    RAISE EXCEPTION 'Only the Onboarding Director or leadership can change the Onboarding team.';
  END IF;
  IF _role_code IS NULL OR _role_code IN ('property_coordinator','owner','onboarding_director') THEN
    RAISE EXCEPTION 'That role is not assigned from the Project Team.';
  END IF;
  SELECT * INTO pr FROM public.onboarding_projects WHERE id=_project_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That onboarding project was not found.'; END IF;
  assignments:=coalesce(pr.role_assignments,'{}'::jsonb);
  previous:=CASE _role_code WHEN 'onboarding_project_manager' THEN pr.project_manager
                            WHEN 'utilities' THEN pr.utility_manager
                            ELSE nullif(assignments->>_role_code,'')::uuid END;
  IF previous IS NOT DISTINCT FROM _user_id THEN
    RETURN jsonb_build_object('ok',true,'changed',false,'moved',0);
  END IF;
  IF _role_code='onboarding_project_manager' THEN
    UPDATE public.onboarding_projects SET project_manager=_user_id WHERE id=pr.id;
  ELSIF _role_code='utilities' THEN
    UPDATE public.onboarding_projects SET utility_manager=_user_id WHERE id=pr.id;
  ELSE
    assignments:=CASE WHEN _user_id IS NULL THEN assignments-_role_code ELSE assignments||jsonb_build_object(_role_code,_user_id) END;
    UPDATE public.onboarding_projects SET role_assignments=assignments WHERE id=pr.id;
  END IF;
  IF NOT FOUND THEN RAISE EXCEPTION 'The project assignment could not be saved.'; END IF;
  -- SECURITY INVOKER retains all current row policies and responsibility triggers.
  IF _reassign_pending OR _role_code='onboarding_project_manager' THEN
    UPDATE public.onboarding_tasks SET assigned_to=_user_id
    WHERE property_id=pr.property_id AND assigned_seat=_role_code
      AND status IN ('open','in_progress','blocked') AND archived_at IS NULL AND exception_at IS NULL;
    GET DIAGNOSTICS moved=ROW_COUNT;
  END IF;
  PERFORM private.write_project_team_change_audit(pr.id,_role_code,previous,_user_id,moved);
  RETURN jsonb_build_object('ok',true,'changed',true,'moved',moved);
END $function$

;
INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
VALUES (NULL, 'onboarding_roles_attach.undone', 'function', NULL, 'Designer and Onboarding Manager attach', '{}'::jsonb);

-- ===== read back after undo =====
INSERT INTO _out(line) SELECT 'after undo: Task people match before: ' ||
  ((SELECT md5(string_agg(id::text || ':' || coalesce(assigned_to::text, '-'), ',' ORDER BY id)) FROM public.onboarding_tasks t
     WHERE NOT EXISTS (SELECT 1 FROM public.properties p WHERE p.id = t.property_id AND p.name LIKE '%Practice Way')) = b.task_people)::text
  || '; team rule matches before: ' || ((SELECT md5(prosrc) FROM pg_proc WHERE oid = 'public.set_onboarding_project_role(uuid,text,uuid,boolean)'::regprocedure) = b.team_rule)::text
  || '; new rule gone: ' || (NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'onboarding_project_default_roles'))::text
FROM _before b;
INSERT INTO _out(line) SELECT 'after undo: home roles match before (practice homes left out): ' ||
  ((SELECT md5(string_agg(op.id::text || ':' || coalesce(op.role_assignments::text, '-'), ',' ORDER BY op.id)) FROM public.onboarding_projects op
     JOIN public.properties p ON p.id = op.property_id WHERE p.name NOT LIKE '%Practice Way') = b.project_roles)::text FROM _before b;
DO $out$ DECLARE s text; BEGIN SELECT string_agg(line, E'\n' ORDER BY n) INTO s FROM _out; RAISE EXCEPTION E'PRACTICE ROLLED BACK\n%', s; END $out$;
