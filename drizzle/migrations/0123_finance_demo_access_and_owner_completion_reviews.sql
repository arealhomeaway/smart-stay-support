
-- ===== Dedicated Finance demo access (synthetic accounts only, audited) =====
CREATE OR REPLACE FUNCTION private.is_demo_finance_tester(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL
    AND EXISTS (SELECT 1 FROM app_settings s
                 WHERE s.key = 'demo_finance_accounts' AND jsonb_typeof(s.value) = 'array'
                   AND s.value ? _uid::text)
    AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = _uid AND lower(u.email) LIKE '%@resolve-test.invalid')
    AND (public.is_finance_lead(_uid) OR public.is_accounting(_uid))
$$;

CREATE OR REPLACE FUNCTION public.my_demo_access()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'admin', coalesce(public.has_role(auth.uid(), 'admin'), false),
    'finance_tester', private.is_demo_finance_tester(auth.uid()))
$$;

CREATE OR REPLACE FUNCTION public.set_demo_finance_access(_user uuid, _on boolean, _reason text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _before jsonb; _after jsonb; _email text;
BEGIN
  IF NOT coalesce(public.has_role(auth.uid(), 'admin'), false) THEN
    RAISE EXCEPTION 'Only an administrator can change demo Finance access.';
  END IF;
  IF length(trim(coalesce(_reason, ''))) < 3 THEN RAISE EXCEPTION 'Give a reason for this change.'; END IF;
  SELECT email INTO _email FROM auth.users WHERE id = _user;
  IF _on AND (lower(coalesce(_email, '')) NOT LIKE '%@resolve-test.invalid') THEN
    RAISE EXCEPTION 'Demo Finance access is only for designated synthetic test accounts.';
  END IF;
  IF _on AND NOT (public.is_finance_lead(_user) OR public.is_accounting(_user)) THEN
    RAISE EXCEPTION 'The account must already hold a Finance seat.';
  END IF;
  SELECT coalesce(value, '[]'::jsonb) INTO _before FROM app_settings WHERE key = 'demo_finance_accounts';
  _before := coalesce(_before, '[]'::jsonb);
  IF _on THEN
    _after := CASE WHEN _before ? _user::text THEN _before ELSE _before || to_jsonb(_user::text) END;
  ELSE
    _after := coalesce((SELECT jsonb_agg(x) FROM jsonb_array_elements(_before) x WHERE x #>> '{}' <> _user::text), '[]'::jsonb);
  END IF;
  INSERT INTO app_settings(key, value, updated_by, updated_at) VALUES ('demo_finance_accounts', _after, auth.uid(), now())
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by, updated_at = now();
  INSERT INTO audit_log(actor_id, action, entity_type, entity_id, entity_label, reason, before_value, after_value)
  VALUES (auth.uid(), CASE WHEN _on THEN 'demo_finance_access_granted' ELSE 'demo_finance_access_revoked' END,
          'user', _user, _email, trim(_reason), _before, _after);
END $$;

REVOKE ALL ON FUNCTION public.my_demo_access() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_demo_finance_access(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_demo_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_demo_finance_access(uuid, boolean, text) TO authenticated;

-- Invoice date history: keep prior values in the append-only expense history.
CREATE OR REPLACE FUNCTION private.log_expense_invoice_date()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.invoice_date IS DISTINCT FROM OLD.invoice_date THEN
    INSERT INTO expense_events(expense_id, actor_id, kind, before_value, after_value, reason)
    VALUES (NEW.id, auth.uid(), 'edited', jsonb_build_object('invoice_date', OLD.invoice_date), jsonb_build_object('invoice_date', NEW.invoice_date), NULL);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS expenses_invoice_date_history ON public.expenses;
CREATE TRIGGER expenses_invoice_date_history AFTER UPDATE OF invoice_date ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION private.log_expense_invoice_date();

-- ===== Owner completions to review (staff follow-through only) =====
CREATE TABLE public.owner_completion_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_item_id uuid NOT NULL REFERENCES public.work_items(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('needs_review','follow_up_needed','reviewed')),
  internal_note text,
  follow_up_task_id uuid REFERENCES public.onboarding_tasks(id),
  owner_feedback_message_id uuid REFERENCES public.owner_request_messages(id),
  actor_id uuid,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX owner_completion_reviews_item_idx ON public.owner_completion_reviews(work_item_id, created_at DESC);
GRANT SELECT ON public.owner_completion_reviews TO authenticated;
GRANT ALL ON public.owner_completion_reviews TO service_role;
ALTER TABLE public.owner_completion_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read owner completion reviews" ON public.owner_completion_reviews
  FOR SELECT TO authenticated USING (private.is_staff(auth.uid()) OR public.is_onboarding_staff(auth.uid()));

CREATE OR REPLACE FUNCTION private.block_completion_review_mutation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Owner completion review history is append-only.'; END $$;
CREATE TRIGGER owner_completion_reviews_append_only BEFORE UPDATE OR DELETE ON public.owner_completion_reviews
  FOR EACH ROW EXECUTE FUNCTION private.block_completion_review_mutation();

CREATE OR REPLACE FUNCTION public.record_owner_completion_review(
  _id uuid, _status text, _internal_note text DEFAULT NULL, _follow_up_task_id uuid DEFAULT NULL, _owner_feedback text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w record; _cur text; _rid uuid; _mid uuid; _home text; _name text; _pm uuid;
  t_creator uuid; t_assignee uuid; f_assignee uuid; _to uuid[];
  _note text := nullif(trim(coalesce(_internal_note,'')), '');
  _fb text := nullif(trim(coalesce(_owner_feedback,'')), '');
BEGIN
  IF NOT (private.is_staff(auth.uid()) OR public.is_onboarding_staff(auth.uid())) THEN
    RAISE EXCEPTION 'Only ARHA staff can review owner completions.';
  END IF;
  IF _status NOT IN ('needs_review','follow_up_needed','reviewed') THEN RAISE EXCEPTION 'Unknown review status.'; END IF;
  SELECT wi.*, p.owner_user_id AS prog_owner INTO w FROM work_items wi LEFT JOIN owner_programs p ON p.id = wi.program_id
   WHERE wi.id = _id AND wi.kind = 'opportunity';
  IF w.id IS NULL OR w.status <> 'complete' THEN RAISE EXCEPTION 'Only owner-completed Opportunities can be reviewed.'; END IF;
  IF NOT private.onboarding_scope_ok(auth.uid(), w.property_id) THEN RAISE EXCEPTION 'This home is outside your onboarding scope.'; END IF;
  IF length(coalesce(_note,'')) > 5000 OR length(coalesce(_fb,'')) > 5000 THEN RAISE EXCEPTION 'Please keep notes under 5,000 characters.'; END IF;
  IF _status = 'follow_up_needed' AND _note IS NULL AND _follow_up_task_id IS NULL THEN
    RAISE EXCEPTION 'Say what follow-up is needed, or link the Task that will handle it.';
  END IF;
  IF _follow_up_task_id IS NOT NULL THEN
    SELECT assigned_to INTO f_assignee FROM onboarding_tasks WHERE id = _follow_up_task_id AND property_id = w.property_id AND archived_at IS NULL;
    IF NOT FOUND THEN RAISE EXCEPTION 'The follow-up Task must belong to this home.'; END IF;
  END IF;
  SELECT status INTO _cur FROM owner_completion_reviews WHERE work_item_id = w.id ORDER BY created_at DESC LIMIT 1;
  IF coalesce(_cur,'needs_review') = _status AND _note IS NULL AND _fb IS NULL AND _follow_up_task_id IS NULL THEN
    RAISE EXCEPTION 'Nothing new to record.';
  END IF;

  IF _fb IS NOT NULL THEN
    IF w.prog_owner IS NULL THEN RAISE EXCEPTION 'The homeowner does not have portal access yet, so feedback cannot be shared.'; END IF;
    SELECT coalesce(full_name,'Your ARHA team') INTO _name FROM profiles WHERE id = auth.uid();
    INSERT INTO owner_request_messages(work_item_id, property_id, program_id, task_id, author_id, author_type, author_name, event, body, is_demo)
    VALUES (w.id, w.property_id, w.program_id, w.source_task_id, auth.uid(), 'staff', coalesce(_name,'Your ARHA team'), 'completion_feedback', _fb, coalesce(w.is_demo,false))
    RETURNING id INTO _mid;
    SELECT coalesce(nickname, name, address_line1, 'your home') INTO _home FROM properties WHERE id = w.property_id;
    -- In-app only: no email or text delivery for completion feedback.
    INSERT INTO owner_notifications(program_id, owner_user_id, kind, priority, title, body, action_path, email_status, is_demo)
    VALUES (w.program_id, w.prog_owner, 'opportunity_reply', 'p3', 'Feedback from Your ARHA Team', w.title||' · '||_home,
      '/owner?home='||w.property_id||'&opportunity='||w.id, 'skipped', coalesce(w.is_demo,false));
  END IF;

  INSERT INTO owner_completion_reviews(work_item_id, status, internal_note, follow_up_task_id, owner_feedback_message_id, actor_id, is_demo)
  VALUES (w.id, _status, _note, _follow_up_task_id, _mid, auth.uid(), coalesce(w.is_demo,false))
  RETURNING id INTO _rid;

  IF w.source_task_id IS NOT NULL THEN
    SELECT created_by, assigned_to INTO t_creator, t_assignee FROM onboarding_tasks WHERE id = w.source_task_id;
  END IF;
  SELECT project_manager INTO _pm FROM onboarding_projects WHERE property_id = w.property_id AND status <> 'cancelled' ORDER BY created_at DESC LIMIT 1;
  _to := ARRAY[_pm, t_creator, t_assignee, w.assigned_to, f_assignee]
      || coalesce((SELECT array_agg(user_id) FROM onboarding_follows WHERE property_id = w.property_id), '{}');
  IF _pm IS NULL THEN _to := _to || public.seat_holder('onboarding_director'); END IF;
  SELECT coalesce(nickname, name, address_line1, 'the home') INTO _home FROM properties WHERE id = w.property_id;
  PERFORM private.notify_onboarding_recipients(_to, auth.uid(), 'owner_completion_review',
    'Owner completion '||CASE _status WHEN 'reviewed' THEN 'reviewed' WHEN 'follow_up_needed' THEN 'needs follow-up' ELSE 'returned to review' END
      ||CASE WHEN _fb IS NOT NULL THEN ' · feedback shared with owner' ELSE '' END,
    w.title||' · '||_home, 'work_item', w.id,
    '/onboarding/'||w.property_id||'?tab=work'||CASE WHEN _follow_up_task_id IS NOT NULL THEN '&task='||_follow_up_task_id
      WHEN w.source_task_id IS NOT NULL THEN '&task='||w.source_task_id ELSE '' END,
    w.is_demo);
  RETURN _rid;
END $$;

CREATE OR REPLACE FUNCTION public.owner_completions_for_review(_demo boolean, _property uuid DEFAULT NULL)
RETURNS TABLE(work_item_id uuid, property_id uuid, property_name text, title text, owner_name text, completed_at timestamptz,
  responsible_id uuid, responsible_name text, assignment_exception boolean, evidence_count integer,
  latest_feedback text, latest_feedback_at timestamptz, review_status text, reviewed_at timestamptz, reviewed_by_name text,
  latest_internal_note text, follow_up_task_id uuid, new_owner_activity boolean, source_task_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH base AS (
    SELECT w.* FROM work_items w
     WHERE w.kind = 'opportunity' AND w.status = 'complete' AND w.retired_at IS NULL
       AND w.is_demo = _demo AND (_property IS NULL OR w.property_id = _property)
       AND (private.is_staff(auth.uid()) OR public.is_onboarding_staff(auth.uid()))
       AND private.onboarding_scope_ok(auth.uid(), w.property_id)
  )
  SELECT b.id, b.property_id, coalesce(pp.nickname, pp.name, pp.address_line1),
    b.title, coalesce(op.full_name, 'Homeowner'), b.completed_at,
    pm.project_manager, pmp.full_name, pm.project_manager IS NULL,
    ((SELECT count(*) FROM documents d WHERE d.work_item_id = b.id AND d.deleted_at IS NULL)
      + (SELECT count(*) FROM work_item_resources r WHERE r.work_item_id = b.id AND r.removed_at IS NULL))::int,
    coalesce(m.body, b.owner_response -> -1 ->> 'text'), coalesce(m.created_at, b.responded_at),
    coalesce(rv.status, 'needs_review'), rv.created_at, rvp.full_name, rv.internal_note, rv.follow_up_task_id,
    (rv.created_at IS NOT NULL AND (coalesce(m.created_at, b.responded_at) > rv.created_at OR b.completed_at > rv.created_at
      OR EXISTS (SELECT 1 FROM documents d WHERE d.work_item_id = b.id AND d.created_at > rv.created_at))),
    b.source_task_id
  FROM base b
  LEFT JOIN properties pp ON pp.id = b.property_id
  LEFT JOIN owner_programs prg ON prg.id = b.program_id
  LEFT JOIN profiles op ON op.id = prg.owner_user_id
  LEFT JOIN LATERAL (SELECT project_manager FROM onboarding_projects o WHERE o.property_id = b.property_id AND o.status <> 'cancelled' ORDER BY o.created_at DESC LIMIT 1) pm ON true
  LEFT JOIN profiles pmp ON pmp.id = pm.project_manager
  LEFT JOIN LATERAL (SELECT body, created_at FROM owner_request_messages x WHERE x.work_item_id = b.id AND x.author_type = 'homeowner' ORDER BY created_at DESC LIMIT 1) m ON true
  LEFT JOIN LATERAL (SELECT * FROM owner_completion_reviews r WHERE r.work_item_id = b.id ORDER BY created_at DESC LIMIT 1) rv ON true
  LEFT JOIN profiles rvp ON rvp.id = rv.actor_id
  ORDER BY (coalesce(rv.status,'needs_review') = 'reviewed'), b.completed_at DESC NULLS LAST
$$;

REVOKE ALL ON FUNCTION public.record_owner_completion_review(uuid, text, text, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.owner_completions_for_review(boolean, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_owner_completion_review(uuid, text, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_completions_for_review(boolean, uuid) TO authenticated;
