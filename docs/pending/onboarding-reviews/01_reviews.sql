-- Help ticket #54: review steps in onboarding plans.
-- New objects only. No existing function, table, column, template, version, plan or Task is changed.
-- Every setting defaults OFF: a step without a row in onboarding_step_review_settings behaves exactly as today.

CREATE TABLE public.onboarding_step_review_settings (
  template_task_id uuid PRIMARY KEY REFERENCES public.onboarding_template_tasks(id) ON DELETE CASCADE,
  reviewer_roles text[] NOT NULL DEFAULT '{}',
  time_limit_business_days integer NOT NULL DEFAULT 1 CHECK (time_limit_business_days BETWEEN 1 AND 30),
  alerts_enabled boolean NOT NULL DEFAULT false,
  blocks text NOT NULL DEFAULT 'nothing' CHECK (blocks IN ('nothing','steps','handoff','stage')),
  blocked_step_ids uuid[] NOT NULL DEFAULT '{}',
  blocked_stage text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(reviewer_roles) <= 2)
);
CREATE TABLE public.onboarding_step_review_settings_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_task_id uuid NOT NULL,
  before_value jsonb,
  after_value jsonb NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.staff_review_preferences (
  user_id uuid PRIMARY KEY,
  no_second_look boolean NOT NULL DEFAULT false,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.staff_review_preference_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  before_value boolean,
  after_value boolean NOT NULL,
  changed_by uuid,
  changed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.onboarding_task_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.onboarding_tasks(id) ON DELETE CASCADE,
  property_id uuid NOT NULL,
  project_id uuid,
  round integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','changes_requested','skipped')),
  reviewer_roles text[] NOT NULL DEFAULT '{}',
  submitted_by uuid,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  alerts_enabled boolean NOT NULL DEFAULT false,
  overdue_alerted_at timestamptz,
  closed_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX onboarding_task_reviews_one_pending ON public.onboarding_task_reviews(task_id) WHERE status = 'pending';
CREATE INDEX onboarding_task_reviews_task ON public.onboarding_task_reviews(task_id, submitted_at DESC);
CREATE TABLE public.onboarding_task_review_decisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id uuid NOT NULL REFERENCES public.onboarding_task_reviews(id) ON DELETE CASCADE,
  role_code text NOT NULL,
  reviewer_id uuid NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved','sent_back')),
  note text,
  decided_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, role_code)
);
CREATE TABLE public.onboarding_task_review_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.onboarding_tasks(id) ON DELETE CASCADE,
  review_id uuid REFERENCES public.onboarding_task_reviews(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('submitted','resubmitted','approved','sent_back','edited','skipped','overdue','review_complete')),
  actor_id uuid,
  role_code text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX onboarding_task_review_events_task ON public.onboarding_task_review_events(task_id, created_at);

GRANT SELECT ON public.onboarding_step_review_settings, public.onboarding_step_review_settings_history,
  public.staff_review_preferences, public.staff_review_preference_history,
  public.onboarding_task_reviews, public.onboarding_task_review_decisions, public.onboarding_task_review_events TO authenticated;
GRANT ALL ON public.onboarding_step_review_settings, public.onboarding_step_review_settings_history,
  public.staff_review_preferences, public.staff_review_preference_history,
  public.onboarding_task_reviews, public.onboarding_task_review_decisions, public.onboarding_task_review_events TO service_role;

ALTER TABLE public.onboarding_step_review_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_step_review_settings_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_review_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_review_preference_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_task_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_task_review_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.onboarding_task_review_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff read step review settings" ON public.onboarding_step_review_settings FOR SELECT TO authenticated
  USING (public.is_onboarding_staff(auth.uid()) OR public.is_supervisor(auth.uid()));
CREATE POLICY "Staff read step review settings history" ON public.onboarding_step_review_settings_history FOR SELECT TO authenticated
  USING (public.is_onboarding_staff(auth.uid()) OR public.is_supervisor(auth.uid()));
CREATE POLICY "Staff read review preferences" ON public.staff_review_preferences FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_onboarding_staff(auth.uid()) OR public.is_supervisor(auth.uid()));
CREATE POLICY "Staff read review preference history" ON public.staff_review_preference_history FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_onboarding_staff(auth.uid()) OR public.is_supervisor(auth.uid()));
CREATE POLICY "Staff read Task reviews" ON public.onboarding_task_reviews FOR SELECT TO authenticated
  USING (public.is_onboarding_staff(auth.uid()) OR public.is_supervisor(auth.uid()));
CREATE POLICY "Staff read Task review decisions" ON public.onboarding_task_review_decisions FOR SELECT TO authenticated
  USING (public.is_onboarding_staff(auth.uid()) OR public.is_supervisor(auth.uid()));
CREATE POLICY "Staff read Task review history" ON public.onboarding_task_review_events FOR SELECT TO authenticated
  USING (public.is_onboarding_staff(auth.uid()) OR public.is_supervisor(auth.uid()));

-- Who reviews for a role on a home: active cover first, then the home's Project Team / seat,
-- then the Onboarding Director for the two onboarding review roles when nobody is assigned.
CREATE FUNCTION private.review_role_person(_project_id uuid, _role text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce(
    (SELECT o.user_id FROM public.seat_override_at(_role, now()) o WHERE o.kind = 'cover'),
    public.project_role_assignee(_project_id, _role),
    CASE WHEN _role IN ('lead_designer','onboarding_manager') THEN public.seat_holder_at('onboarding_director', now()) END)
$$;

-- Review due time: N business days (Mon to Fri, skipping recorded holidays) after submission, Central time.
CREATE FUNCTION private.review_due_at(_from timestamptz, _days integer)
RETURNS timestamptz LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT (private.ao_add_business_days((_from AT TIME ZONE 'America/Chicago')::date, greatest(coalesce(_days,1),1))
          + (_from AT TIME ZONE 'America/Chicago')::time) AT TIME ZONE 'America/Chicago'
$$;

CREATE FUNCTION private.review_person_name(_user uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce((SELECT nullif(trim(full_name),'') FROM public.profiles WHERE id = _user), 'this person')
$$;

-- In-app only: email_status 'none' so no email is ever sent from review alerts.
CREATE FUNCTION private.review_notify(_users uuid[], _actor uuid, _kind text, _title text, _body text, _task_id uuid, _property_id uuid, _is_demo boolean)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE r uuid; n integer := 0;
BEGIN
  FOR r IN SELECT DISTINCT x FROM unnest(_users) x WHERE x IS NOT NULL LOOP
    CONTINUE WHEN r = _actor;
    INSERT INTO public.staff_notifications(user_id, kind, title, body, entity_type, entity_id, link_path, priority, actor_id, is_demo, email_status)
    VALUES (r, _kind, _title, coalesce(_body,''), 'onboarding_task', _task_id,
            '/onboarding/'||_property_id||'?tab=work&task='||_task_id, 'normal', _actor, coalesce(_is_demo,false), 'none');
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

-- Title of the open review step that holds this Task back, or NULL.
CREATE FUNCTION private.review_blocker(_task_id uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT b.title
  FROM public.onboarding_tasks t
  JOIN public.onboarding_tasks b ON b.property_id = t.property_id AND b.id <> t.id
  JOIN public.onboarding_step_review_settings s ON s.template_task_id = b.template_task_id
  WHERE t.id = _task_id
    AND cardinality(s.reviewer_roles) > 0
    AND b.archived_at IS NULL AND b.exception_at IS NULL AND b.status <> 'complete'
    AND ((s.blocks = 'steps' AND t.template_task_id = ANY(s.blocked_step_ids))
      OR (s.blocks = 'stage' AND s.blocked_stage IS NOT NULL AND t.stage = s.blocked_stage))
  ORDER BY b.sort_order NULLS LAST, b.title
  LIMIT 1
$$;

-- Completion guard. Only acts on steps that have review switched on, or on steps another review blocks.
CREATE FUNCTION private.onboarding_review_completion_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s public.onboarding_step_review_settings; latest text; blocker text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'complete' OR OLD.status IS NOT DISTINCT FROM 'complete' THEN RETURN NEW; END IF;
  SELECT * INTO s FROM public.onboarding_step_review_settings WHERE template_task_id = NEW.template_task_id;
  IF FOUND AND cardinality(s.reviewer_roles) > 0 THEN
    SELECT status INTO latest FROM public.onboarding_task_reviews WHERE task_id = NEW.id ORDER BY submitted_at DESC, round DESC LIMIT 1;
    IF latest IS NULL OR latest NOT IN ('approved','skipped') THEN
      RAISE EXCEPTION 'This step needs review before it is done. Use Submit for review.';
    END IF;
  END IF;
  blocker := private.review_blocker(NEW.id);
  IF blocker IS NOT NULL THEN RAISE EXCEPTION 'Waiting on review of %.', blocker; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER onboarding_review_completion_guard BEFORE UPDATE OF status ON public.onboarding_tasks
  FOR EACH ROW EXECUTE FUNCTION private.onboarding_review_completion_guard();

-- Handoff guard: Operations cannot accept while a handoff-blocking review is open.
CREATE FUNCTION private.onboarding_review_handoff_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE blocker text;
BEGIN
  IF NEW.handoff_state IS DISTINCT FROM 'accepted' OR OLD.handoff_state IS NOT DISTINCT FROM 'accepted' THEN RETURN NEW; END IF;
  SELECT b.title INTO blocker
  FROM public.onboarding_tasks b JOIN public.onboarding_step_review_settings s ON s.template_task_id = b.template_task_id
  WHERE b.property_id = NEW.property_id AND s.blocks = 'handoff' AND cardinality(s.reviewer_roles) > 0
    AND b.archived_at IS NULL AND b.exception_at IS NULL AND b.status <> 'complete'
  ORDER BY b.sort_order NULLS LAST, b.title LIMIT 1;
  IF blocker IS NOT NULL THEN RAISE EXCEPTION 'Waiting on review of %. Operations can accept after it is approved.', blocker; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER onboarding_review_handoff_guard BEFORE UPDATE OF handoff_state ON public.onboarding_projects
  FOR EACH ROW EXECUTE FUNCTION private.onboarding_review_handoff_guard();

CREATE FUNCTION public.set_onboarding_step_review_settings(_step_id uuid, _reviewer_roles text[], _time_limit_days integer,
  _alerts_enabled boolean, _blocks text, _blocked_step_ids uuid[], _blocked_stage text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _actor uuid := auth.uid(); step public.onboarding_template_tasks; before jsonb; after jsonb; roles text[];
BEGIN
  IF _actor IS NULL OR NOT private.is_onboarding_leader(_actor) THEN
    RAISE EXCEPTION 'Only the Onboarding Director or a Supervisor can change review settings.';
  END IF;
  SELECT * INTO step FROM public.onboarding_template_tasks WHERE id = _step_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'That step no longer exists.'; END IF;
  SELECT coalesce(array_agg(DISTINCT r), '{}') INTO roles FROM unnest(coalesce(_reviewer_roles,'{}')) r WHERE nullif(trim(r),'') IS NOT NULL;
  IF cardinality(roles) > 2 THEN RAISE EXCEPTION 'Choose up to two reviewers.'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(roles) r WHERE r = 'owner' OR NOT EXISTS (SELECT 1 FROM public.functional_roles f WHERE f.code = r AND f.active)) THEN
    RAISE EXCEPTION 'Choose an active team role for each reviewer.';
  END IF;
  IF coalesce(_blocks,'nothing') NOT IN ('nothing','steps','handoff','stage') THEN RAISE EXCEPTION 'Choose what an open review blocks.'; END IF;
  IF _blocks = 'steps' AND (cardinality(coalesce(_blocked_step_ids,'{}')) = 0 OR _step_id = ANY(_blocked_step_ids)
     OR EXISTS (SELECT 1 FROM unnest(_blocked_step_ids) b WHERE NOT EXISTS (SELECT 1 FROM public.onboarding_template_tasks x WHERE x.id = b AND x.template_id = step.template_id))) THEN
    RAISE EXCEPTION 'Choose other steps in this plan to block.';
  END IF;
  IF _blocks = 'stage' AND nullif(trim(coalesce(_blocked_stage,'')),'') IS NULL THEN RAISE EXCEPTION 'Choose a stage to block.'; END IF;
  SELECT to_jsonb(s) INTO before FROM public.onboarding_step_review_settings s WHERE template_task_id = _step_id FOR UPDATE;
  INSERT INTO public.onboarding_step_review_settings AS s (template_task_id, reviewer_roles, time_limit_business_days, alerts_enabled, blocks, blocked_step_ids, blocked_stage, updated_by, updated_at)
  VALUES (_step_id, roles, coalesce(_time_limit_days,1), coalesce(_alerts_enabled,false), coalesce(_blocks,'nothing'),
          CASE WHEN _blocks = 'steps' THEN _blocked_step_ids ELSE '{}' END,
          CASE WHEN _blocks = 'stage' THEN trim(_blocked_stage) END, _actor, now())
  ON CONFLICT (template_task_id) DO UPDATE SET reviewer_roles = excluded.reviewer_roles, time_limit_business_days = excluded.time_limit_business_days,
    alerts_enabled = excluded.alerts_enabled, blocks = excluded.blocks, blocked_step_ids = excluded.blocked_step_ids,
    blocked_stage = excluded.blocked_stage, updated_by = excluded.updated_by, updated_at = excluded.updated_at
  RETURNING to_jsonb(s) INTO after;
  INSERT INTO public.onboarding_step_review_settings_history(template_task_id, before_value, after_value, changed_by) VALUES (_step_id, before, after, _actor);
END $$;

CREATE FUNCTION public.set_staff_no_second_look(_user_id uuid, _on boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _actor uuid := auth.uid(); before boolean;
BEGIN
  IF _actor IS NULL OR NOT (public.has_role(_actor,'admin') OR public.is_onboarding_director(_actor)
     OR _actor = public.seat_holder('director_ops')) THEN
    RAISE EXCEPTION 'Only an Admin or a Director can change this setting.';
  END IF;
  IF _user_id IS NULL OR _on IS NULL THEN RAISE EXCEPTION 'Choose a person and a setting.'; END IF;
  SELECT no_second_look INTO before FROM public.staff_review_preferences WHERE user_id = _user_id FOR UPDATE;
  IF before IS NOT DISTINCT FROM _on THEN RETURN; END IF;
  INSERT INTO public.staff_review_preferences(user_id, no_second_look, updated_by, updated_at) VALUES (_user_id, _on, _actor, now())
  ON CONFLICT (user_id) DO UPDATE SET no_second_look = excluded.no_second_look, updated_by = excluded.updated_by, updated_at = excluded.updated_at;
  INSERT INTO public.staff_review_preference_history(user_id, before_value, after_value, changed_by) VALUES (_user_id, before, _on, _actor);
END $$;

CREATE FUNCTION public.submit_onboarding_task_review(_task_id uuid, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _actor uuid := auth.uid(); t public.onboarding_tasks; s public.onboarding_step_review_settings; proj uuid;
  rnd integer; rid uuid; due timestamptz; blocker text; reviewers uuid[];
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Sign in to submit this step.'; END IF;
  SELECT * INTO t FROM public.onboarding_tasks WHERE id = _task_id FOR UPDATE;
  IF NOT FOUND OR t.archived_at IS NOT NULL THEN RAISE EXCEPTION 'That Task is not available.'; END IF;
  IF NOT (t.assigned_to = _actor OR public.is_onboarding_staff(_actor) OR public.has_role(_actor,'admin')) THEN
    RAISE EXCEPTION 'You cannot submit this Task.';
  END IF;
  IF t.status = 'complete' THEN RAISE EXCEPTION 'This Task is already done.'; END IF;
  SELECT * INTO s FROM public.onboarding_step_review_settings WHERE template_task_id = t.template_task_id;
  IF NOT FOUND OR cardinality(s.reviewer_roles) = 0 THEN RAISE EXCEPTION 'This step does not need review.'; END IF;
  IF EXISTS (SELECT 1 FROM public.onboarding_task_reviews WHERE task_id = t.id AND status = 'pending') THEN
    RAISE EXCEPTION 'This step is already waiting for review.';
  END IF;
  blocker := private.review_blocker(t.id);
  IF blocker IS NOT NULL THEN RAISE EXCEPTION 'Waiting on review of %.', blocker; END IF;
  SELECT id INTO proj FROM public.onboarding_projects WHERE property_id = t.property_id ORDER BY created_at DESC LIMIT 1;
  SELECT coalesce(max(round),0) + 1 INTO rnd FROM public.onboarding_task_reviews WHERE task_id = t.id;

  IF EXISTS (SELECT 1 FROM public.staff_review_preferences WHERE user_id = _actor AND no_second_look) THEN
    INSERT INTO public.onboarding_task_reviews(task_id, property_id, project_id, round, status, reviewer_roles, submitted_by, alerts_enabled, closed_at, is_demo)
    VALUES (t.id, t.property_id, proj, rnd, 'skipped', s.reviewer_roles, _actor, false, now(), coalesce(t.is_demo,false)) RETURNING id INTO rid;
    INSERT INTO public.onboarding_task_review_events(task_id, review_id, kind, actor_id, note)
    VALUES (t.id, rid, 'skipped', _actor, 'Skipped: no second look needed for '||private.review_person_name(_actor));
    UPDATE public.onboarding_tasks SET status = 'complete', completed_at = now(), completed_by = _actor, blocker = NULL WHERE id = t.id;
    RETURN jsonb_build_object('review_id', rid, 'status', 'skipped');
  END IF;

  due := private.review_due_at(now(), s.time_limit_business_days);
  INSERT INTO public.onboarding_task_reviews(task_id, property_id, project_id, round, status, reviewer_roles, submitted_by, due_at, alerts_enabled, is_demo)
  VALUES (t.id, t.property_id, proj, rnd, 'pending', s.reviewer_roles, _actor, due, s.alerts_enabled, coalesce(t.is_demo,false)) RETURNING id INTO rid;
  INSERT INTO public.onboarding_task_review_events(task_id, review_id, kind, actor_id, note)
  VALUES (t.id, rid, CASE WHEN rnd > 1 THEN 'resubmitted' ELSE 'submitted' END, _actor, nullif(trim(coalesce(_note,'')),''));
  IF s.alerts_enabled THEN
    SELECT array_agg(private.review_role_person(proj, r)) INTO reviewers FROM unnest(s.reviewer_roles) r;
    PERFORM private.review_notify(reviewers, _actor, 'onboarding_review_requested', 'Review needed: '||t.title,
      'Submitted by '||private.review_person_name(_actor)||'.', t.id, t.property_id, t.is_demo);
  END IF;
  RETURN jsonb_build_object('review_id', rid, 'status', 'pending', 'due_at', due);
END $$;

CREATE FUNCTION public.decide_onboarding_task_review(_review_id uuid, _decision text, _note text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _actor uuid := auth.uid(); rv public.onboarding_task_reviews; t public.onboarding_tasks; mine text[]; r text; remaining integer;
BEGIN
  IF _actor IS NULL THEN RAISE EXCEPTION 'Sign in to review.'; END IF;
  IF _decision NOT IN ('approved','sent_back') THEN RAISE EXCEPTION 'Choose Approve or Send back.'; END IF;
  SELECT * INTO rv FROM public.onboarding_task_reviews WHERE id = _review_id FOR UPDATE;
  IF NOT FOUND OR rv.status <> 'pending' THEN RAISE EXCEPTION 'This review is no longer waiting.'; END IF;
  SELECT coalesce(array_agg(x), '{}') INTO mine FROM unnest(rv.reviewer_roles) x
    WHERE private.review_role_person(rv.project_id, x) = _actor
      AND NOT EXISTS (SELECT 1 FROM public.onboarding_task_review_decisions d WHERE d.review_id = rv.id AND d.role_code = x);
  IF cardinality(mine) = 0 THEN RAISE EXCEPTION 'Only the assigned reviewer can do this.'; END IF;
  IF _decision = 'sent_back' AND length(trim(coalesce(_note,''))) < 3 THEN RAISE EXCEPTION 'Add a note saying what needs to change.'; END IF;
  SELECT * INTO t FROM public.onboarding_tasks WHERE id = rv.task_id FOR UPDATE;
  FOREACH r IN ARRAY mine LOOP
    INSERT INTO public.onboarding_task_review_decisions(review_id, role_code, reviewer_id, decision, note)
    VALUES (rv.id, r, _actor, _decision, nullif(trim(coalesce(_note,'')),''));
    INSERT INTO public.onboarding_task_review_events(task_id, review_id, kind, actor_id, role_code, note)
    VALUES (rv.task_id, rv.id, _decision, _actor, r, nullif(trim(coalesce(_note,'')),''));
  END LOOP;
  IF _decision = 'sent_back' THEN
    UPDATE public.onboarding_task_reviews SET status = 'changes_requested', closed_at = now() WHERE id = rv.id;
    PERFORM private.review_notify(ARRAY[coalesce(t.assigned_to, rv.submitted_by)], _actor, 'onboarding_review_changes', 'Changes requested: '||t.title,
      trim(_note), t.id, t.property_id, t.is_demo);
    RETURN jsonb_build_object('status', 'changes_requested');
  END IF;
  SELECT count(*) INTO remaining FROM unnest(rv.reviewer_roles) x
    WHERE NOT EXISTS (SELECT 1 FROM public.onboarding_task_review_decisions d WHERE d.review_id = rv.id AND d.role_code = x AND d.decision = 'approved');
  IF remaining > 0 THEN RETURN jsonb_build_object('status', 'pending', 'remaining', remaining); END IF;
  UPDATE public.onboarding_task_reviews SET status = 'approved', closed_at = now() WHERE id = rv.id;
  INSERT INTO public.onboarding_task_review_events(task_id, review_id, kind, actor_id) VALUES (rv.task_id, rv.id, 'review_complete', _actor);
  IF t.status <> 'complete' THEN
    UPDATE public.onboarding_tasks SET status = 'complete', completed_at = now(), completed_by = coalesce(rv.submitted_by, _actor), blocker = NULL WHERE id = t.id;
  END IF;
  RETURN jsonb_build_object('status', 'approved');
END $$;

CREATE FUNCTION public.record_onboarding_review_edit(_review_id uuid, _note text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _actor uuid := auth.uid(); rv public.onboarding_task_reviews;
BEGIN
  SELECT * INTO rv FROM public.onboarding_task_reviews WHERE id = _review_id;
  IF _actor IS NULL OR NOT FOUND OR rv.status <> 'pending' THEN RAISE EXCEPTION 'This review is no longer waiting.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM unnest(rv.reviewer_roles) x WHERE private.review_role_person(rv.project_id, x) = _actor) THEN
    RAISE EXCEPTION 'Only the assigned reviewer can do this.';
  END IF;
  IF length(trim(coalesce(_note,''))) < 3 THEN RAISE EXCEPTION 'Say what you changed.'; END IF;
  INSERT INTO public.onboarding_task_review_events(task_id, review_id, kind, actor_id, note) VALUES (rv.task_id, rv.id, 'edited', _actor, trim(_note));
END $$;

-- Everything the Task drawer shows about review, in one read.
CREATE FUNCTION public.onboarding_task_review_state(_task_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _actor uuid := auth.uid(); t public.onboarding_tasks; s public.onboarding_step_review_settings; rv public.onboarding_task_reviews; proj uuid; reviewers jsonb;
BEGIN
  IF _actor IS NULL OR NOT (public.is_onboarding_staff(_actor) OR public.is_supervisor(_actor)) THEN RAISE EXCEPTION 'Not available.'; END IF;
  SELECT * INTO t FROM public.onboarding_tasks WHERE id = _task_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO s FROM public.onboarding_step_review_settings WHERE template_task_id = t.template_task_id;
  SELECT * INTO rv FROM public.onboarding_task_reviews WHERE task_id = t.id ORDER BY submitted_at DESC, round DESC LIMIT 1;
  proj := coalesce(rv.project_id, (SELECT id FROM public.onboarding_projects WHERE property_id = t.property_id ORDER BY created_at DESC LIMIT 1));
  SELECT coalesce(jsonb_agg(jsonb_build_object('role', x, 'user_id', private.review_role_person(proj, x),
      'name', CASE WHEN private.review_role_person(proj, x) IS NULL THEN NULL ELSE private.review_person_name(private.review_role_person(proj, x)) END,
      'decision', (SELECT d.decision FROM public.onboarding_task_review_decisions d WHERE d.review_id = rv.id AND d.role_code = x))), '[]')
    INTO reviewers FROM unnest(coalesce(CASE WHEN rv.status = 'pending' THEN rv.reviewer_roles END, s.reviewer_roles, '{}')) x;
  RETURN jsonb_build_object(
    'enabled', s.template_task_id IS NOT NULL AND cardinality(s.reviewer_roles) > 0,
    'settings', to_jsonb(s),
    'review', to_jsonb(rv),
    'reviewers', reviewers,
    'blocked_by', private.review_blocker(t.id),
    'history', (SELECT coalesce(jsonb_agg(jsonb_build_object('kind', e.kind, 'role', e.role_code, 'note', e.note, 'at', e.created_at,
                 'by', private.review_person_name(e.actor_id)) ORDER BY e.created_at), '[]') FROM public.onboarding_task_review_events e WHERE e.task_id = t.id));
END $$;

CREATE FUNCTION public.my_onboarding_reviews()
RETURNS TABLE(review_id uuid, task_id uuid, property_id uuid, title text, roles text[], submitted_at timestamptz, due_at timestamptz, submitted_by_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT rv.id, rv.task_id, rv.property_id, t.title,
    ARRAY(SELECT x FROM unnest(rv.reviewer_roles) x WHERE private.review_role_person(rv.project_id, x) = auth.uid()
          AND NOT EXISTS (SELECT 1 FROM public.onboarding_task_review_decisions d WHERE d.review_id = rv.id AND d.role_code = x)),
    rv.submitted_at, rv.due_at, private.review_person_name(rv.submitted_by)
  FROM public.onboarding_task_reviews rv JOIN public.onboarding_tasks t ON t.id = rv.task_id
  WHERE auth.uid() IS NOT NULL AND rv.status = 'pending'
    AND EXISTS (SELECT 1 FROM unnest(rv.reviewer_roles) x WHERE private.review_role_person(rv.project_id, x) = auth.uid()
          AND NOT EXISTS (SELECT 1 FROM public.onboarding_task_review_decisions d WHERE d.review_id = rv.id AND d.role_code = x))
  ORDER BY rv.due_at NULLS LAST
$$;

-- Overdue pass (5-minute job, server only). One alert per review, in-app only.
CREATE FUNCTION public.onboarding_review_overdue_sweep()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE rv record; n integer := 0; people uuid[];
BEGIN
  FOR rv IN SELECT r.*, t.title, t.is_demo AS task_demo FROM public.onboarding_task_reviews r JOIN public.onboarding_tasks t ON t.id = r.task_id
    WHERE r.status = 'pending' AND r.alerts_enabled AND r.overdue_alerted_at IS NULL AND r.due_at < now() FOR UPDATE OF r SKIP LOCKED LOOP
    SELECT array_agg(private.review_role_person(rv.project_id, x)) INTO people FROM unnest(rv.reviewer_roles) x
      WHERE NOT EXISTS (SELECT 1 FROM public.onboarding_task_review_decisions d WHERE d.review_id = rv.id AND d.role_code = x);
    people := coalesce(people,'{}') || public.seat_holder_at('onboarding_director', now());
    PERFORM private.review_notify(people, NULL, 'onboarding_review_overdue', 'Review overdue: '||rv.title, 'This review is past its time limit.', rv.task_id, rv.property_id, rv.task_demo);
    UPDATE public.onboarding_task_reviews SET overdue_alerted_at = now() WHERE id = rv.id;
    INSERT INTO public.onboarding_task_review_events(task_id, review_id, kind) VALUES (rv.task_id, rv.id, 'overdue');
    n := n + 1;
  END LOOP;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION private.review_role_person(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.review_due_at(timestamptz, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.review_person_name(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.review_notify(uuid[], uuid, text, text, text, uuid, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.review_blocker(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.onboarding_review_completion_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.onboarding_review_handoff_guard() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_onboarding_step_review_settings(uuid, text[], integer, boolean, text, uuid[], text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_staff_no_second_look(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.submit_onboarding_task_review(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.decide_onboarding_task_review(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.record_onboarding_review_edit(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.onboarding_task_review_state(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_onboarding_reviews() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.onboarding_review_overdue_sweep() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_onboarding_step_review_settings(uuid, text[], integer, boolean, text, uuid[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_staff_no_second_look(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_onboarding_task_review(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decide_onboarding_task_review(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_onboarding_review_edit(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.onboarding_task_review_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_onboarding_reviews() TO authenticated;
GRANT EXECUTE ON FUNCTION public.onboarding_review_overdue_sweep() TO service_role;
