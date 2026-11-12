-- Isolated stand-in for the live tables plan catch-up touches (live column names, Nov 12). Fake rows only.
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE SCHEMA auth; CREATE SCHEMA private;
CREATE TABLE public.me(id uuid);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT id FROM public.me LIMIT 1 $$;
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'tech', 'vendor', 'owner', 'onboarding');
CREATE TABLE public.user_roles(user_id uuid, role public.app_role);
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;
CREATE TABLE public.directors(user_id uuid);
CREATE FUNCTION public.is_onboarding_director(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT EXISTS (SELECT 1 FROM public.directors WHERE user_id = _u) $$;
CREATE TABLE public.functional_role_members(role_code text, user_id uuid);
CREATE FUNCTION public.holds_functional_role(_user_id uuid, _code text) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS (SELECT 1 FROM public.functional_role_members WHERE role_code = _code AND user_id = _user_id) $$;
CREATE FUNCTION private.is_onboarding_staff(_u uuid) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _u AND role::text IN ('admin', 'manager', 'onboarding')) $$;
CREATE FUNCTION private.onboarding_bulk_review_blocker(_t uuid) RETURNS text LANGUAGE sql STABLE AS $$ SELECT NULL::text $$;
CREATE FUNCTION private.task_sent_to_owner(_t uuid) RETURNS boolean LANGUAGE sql STABLE AS $$ SELECT false $$;
CREATE TABLE public.profiles(id uuid PRIMARY KEY, full_name text, email text);
CREATE TABLE public.properties(id uuid PRIMARY KEY, handoff_accepted_at timestamptz, lifecycle_status text DEFAULT 'onboarding', is_demo boolean DEFAULT false);
CREATE FUNCTION private.onboarding_work_locked(_p uuid[]) RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT EXISTS (SELECT 1 FROM public.properties WHERE id = ANY(_p) AND (handoff_accepted_at IS NOT NULL OR lifecycle_status = 'handoff_requested')) $$;
CREATE TABLE public.onboarding_projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, status text DEFAULT 'active',
  project_manager uuid, director uuid, is_demo boolean DEFAULT false, created_at timestamptz DEFAULT now());
CREATE TABLE public.onboarding_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, stage text DEFAULT 'Pre-Close',
  title text, sort_order int DEFAULT 0, status text DEFAULT 'open', archived_at timestamptz, archived_by uuid,
  exception_reason text, exception_by uuid, exception_at timestamptz, assigned_to uuid, assigned_seat text,
  owner_dependency text, requires_owner_approval boolean DEFAULT false, owner_approval_status text DEFAULT 'not_required',
  blocker text, template_task_id uuid, evidence_required boolean DEFAULT true, evidence_note text, completed_at timestamptz,
  completed_by uuid, is_demo boolean DEFAULT false, due_on date, due_on_overridden boolean NOT NULL DEFAULT false, due_on_source text,
  created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
CREATE TRIGGER onboarding_tasks_updated BEFORE UPDATE ON public.onboarding_tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Live owner_business_decision_guard (task branch).
CREATE FUNCTION public.owner_business_decision_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE approval_required boolean;
BEGIN
  approval_required := NEW.owner_dependency = 'business_decision' OR coalesce(NEW.requires_owner_approval, false);
  IF NEW.status IN ('complete', 'done') AND approval_required AND NEW.owner_approval_status IS DISTINCT FROM 'approved'
     AND NOT private.task_sent_to_owner(NEW.id) AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'A homeowner decision is required before this Task can be completed.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER owner_business_decision_completion_guard BEFORE UPDATE OF status ON public.onboarding_tasks
  FOR EACH ROW EXECUTE FUNCTION public.owner_business_decision_guard();
-- A stand-in for any database refusal that happens mid-save (review guard, schedule check...).
CREATE FUNCTION public.test_refuse_explodes() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN IF NEW.title = 'Explodes' AND NEW.status = 'complete' THEN RAISE EXCEPTION 'This step needs review before it is done.'; END IF; RETURN NEW; END $$;
CREATE TRIGGER test_refuse_explodes BEFORE UPDATE ON public.onboarding_tasks FOR EACH ROW EXECUTE FUNCTION public.test_refuse_explodes();
CREATE TABLE public.onboarding_step_review_settings(template_task_id uuid PRIMARY KEY, reviewer_roles text[]);
CREATE TABLE public.onboarding_task_reviews(task_id uuid, status text, submitted_at timestamptz DEFAULT now(), round int DEFAULT 1);
CREATE TABLE public.onboarding_project_events(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), project_id uuid, property_id uuid, kind text,
  summary text, detail text, prior_value text, new_value text, actor uuid, is_demo boolean DEFAULT false, created_at timestamptz DEFAULT now());
CREATE TABLE public.documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_type text, entity_id uuid, title text,
  original_filename text, upload_status text DEFAULT 'stored', deleted_at timestamptz, archived_at timestamptz, created_at timestamptz DEFAULT now());
CREATE TABLE public.onboarding_task_file_links(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, receiving_task_id uuid,
  source_task_id uuid, origin text, created_by uuid, created_at timestamptz DEFAULT now(), removed_at timestamptz, removed_by uuid);
CREATE TABLE public.audit_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), actor_id uuid, actor_label text, action text, entity_type text,
  entity_id uuid, entity_label text, reason text, before_value jsonb, after_value jsonb, created_at timestamptz DEFAULT now());
CREATE TABLE public.breezeway_outbound_tasks(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), onboarding_task_id uuid, status text);
CREATE TABLE public.onboarding_task_breezeway_links(task_id uuid PRIMARY KEY, breezeway_task_id bigint);
-- Owner side: anything that reaches a homeowner lands in owner_notifications or email_log.
CREATE TABLE public.owner_notifications(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), kind text, created_at timestamptz DEFAULT now());
CREATE TABLE public.email_log(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), template text);
CREATE TABLE public.approvals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), entity_type text, entity_id uuid, property_id uuid, status text DEFAULT 'pending');
CREATE FUNCTION public.test_owner_notice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN INSERT INTO public.owner_notifications(kind) VALUES (TG_TABLE_NAME); INSERT INTO public.email_log(template) VALUES (TG_TABLE_NAME); RETURN NEW; END $$;
CREATE TRIGGER approvals_notice AFTER INSERT OR UPDATE ON public.approvals FOR EACH ROW EXECUTE FUNCTION public.test_owner_notice();
CREATE TABLE public.owner_reviews(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), onboarding_task_id uuid, title text, status text, archived_at timestamptz);
CREATE TRIGGER owner_review_notice AFTER UPDATE OF status ON public.owner_reviews FOR EACH ROW
  WHEN (NEW.status = 'awaiting_owner') EXECUTE FUNCTION public.test_owner_notice();
-- Active Owner plan (live shapes).
CREATE TABLE public.ao_library_cards(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text, title text, status text DEFAULT 'released',
  linked_template_task_ids uuid[] DEFAULT '{}');
CREATE TABLE public.ao_home_plan_settings(property_id uuid PRIMARY KEY, automated boolean DEFAULT true);
CREATE TABLE public.ao_home_plan_cards(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), property_id uuid, program_id uuid, card_id uuid,
  join_outcome text CHECK (join_outcome IN ('skipped_passed', 'already_covered', 'locked', 'open')), owner_review_id uuid,
  linked_task_id uuid, unlocked_at timestamptz, unlocked_by uuid, expired_at timestamptz, owner_completed_at timestamptz,
  covered_reason text, covered_source text, covered_item_id uuid, created_at timestamptz DEFAULT now());
CREATE TABLE public.test_programs(property_id uuid PRIMARY KEY, program_id uuid DEFAULT gen_random_uuid());
CREATE FUNCTION private.ao_home_program(_property uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce((SELECT jsonb_build_object('program_id', program_id) FROM public.test_programs WHERE property_id = _property),
                  jsonb_build_object('reason', 'This home has no active Active Owner program')) $$;
-- Same linkage as the live ao_plan_outcomes: the card's linked template step on this home.
CREATE FUNCTION private.ao_plan_outcomes(_property uuid, _covered uuid[] DEFAULT ARRAY[]::uuid[])
RETURNS TABLE(card_id uuid, code text, stage_window text, outcome text, task_id uuid, coverage jsonb) LANGUAGE sql STABLE AS $$
  SELECT c.id, c.code, 'onboarding', CASE WHEN t.status = 'complete' THEN 'already_covered' ELSE 'locked' END, t.id, NULL::jsonb
    FROM public.ao_library_cards c
    JOIN LATERAL (SELECT x.id, x.status FROM public.onboarding_tasks x WHERE x.property_id = _property AND x.archived_at IS NULL
                   AND x.template_task_id = ANY (c.linked_template_task_ids) ORDER BY x.created_at LIMIT 1) t ON true
   WHERE c.status = 'released' AND NOT EXISTS (SELECT 1 FROM public.ao_home_plan_cards pc WHERE pc.property_id = _property AND pc.card_id = c.id) $$;
-- Live ao_unlock (simplified to what reaches the owner) and the live ao_task_completed trigger.
CREATE FUNCTION private.ao_unlock(_plan_card uuid, _actor uuid) RETURNS boolean LANGUAGE plpgsql AS $$
DECLARE pc public.ao_home_plan_cards;
BEGIN
  SELECT * INTO pc FROM public.ao_home_plan_cards WHERE id = _plan_card FOR UPDATE;
  IF NOT FOUND OR pc.join_outcome <> 'locked' OR pc.unlocked_at IS NOT NULL THEN RETURN false; END IF;
  UPDATE public.ao_home_plan_cards SET unlocked_at = now(), unlocked_by = _actor WHERE id = pc.id;
  UPDATE public.owner_reviews SET status = 'awaiting_owner' WHERE id = pc.owner_review_id;
  RETURN true;
END $$;
CREATE FUNCTION private.ao_task_completed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  IF NEW.status = 'complete' AND OLD.status IS DISTINCT FROM 'complete' THEN
    FOR r IN SELECT pc.id FROM public.ao_home_plan_cards pc
      JOIN public.ao_home_plan_settings s ON s.property_id = pc.property_id AND s.automated
      WHERE pc.linked_task_id = NEW.id AND pc.join_outcome = 'locked' AND pc.unlocked_at IS NULL
    LOOP PERFORM private.ao_unlock(r.id, NEW.completed_by); END LOOP;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER ao_unlock_on_task_complete AFTER UPDATE OF status ON public.onboarding_tasks FOR EACH ROW EXECUTE FUNCTION private.ao_task_completed();
-- Live private.write_onboarding_bulk_completion (Nov 12).
CREATE FUNCTION private.write_onboarding_bulk_completion(_actor uuid, _rows jsonb, _file_task_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private' AS $function$
DECLARE _property uuid;
BEGIN
  IF _actor IS NULL OR _actor IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'A signed-in teammate is required.';
  END IF;
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, before_value, after_value)
  SELECT _actor, 'onboarding_task_bulk_completed', 'onboarding_task', (r->>'taskId')::uuid, r->>'title',
         r->'before', r->'after'
  FROM jsonb_array_elements(COALESCE(_rows, '[]'::jsonb)) r;
  IF _file_task_id IS NOT NULL THEN
    SELECT property_id INTO _property FROM public.onboarding_tasks WHERE id = _file_task_id;
    INSERT INTO public.onboarding_task_file_links(property_id, receiving_task_id, source_task_id, origin, created_by)
    SELECT _property, (r->>'taskId')::uuid, _file_task_id, 'manual', _actor
    FROM jsonb_array_elements(COALESCE(_rows, '[]'::jsonb)) r
    WHERE (r->>'taskId')::uuid <> _file_task_id
      AND NOT EXISTS (SELECT 1 FROM public.onboarding_task_file_links l
                      WHERE l.receiving_task_id = (r->>'taskId')::uuid AND l.source_task_id = _file_task_id
                        AND l.removed_at IS NULL);
  END IF;
END $function$;

CREATE TABLE IF NOT EXISTS public.functional_roles(code text PRIMARY KEY, name text);
INSERT INTO public.functional_roles VALUES ('utilities', 'Onboarding Utilities Coordinator'), ('onboarding_project_manager', 'Project Manager') ON CONFLICT DO NOTHING;
