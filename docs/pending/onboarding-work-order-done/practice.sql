-- Practice on the live database as the sending Project Manager. Always rolls back.
-- Painting (date Nov 17, In Progress), Final Inspection (date Nov 24), Lawn Care (date Nov 23, then canceled).
BEGIN;
-- mark-done-breezeway prerequisite, practice only: the same one hold removed in place.
DO $m$ BEGIN
  EXECUTE replace(pg_get_functiondef('public.bulk_complete_onboarding_tasks'::regproc),
    'WHEN private.plan_catch_up_bz_sent(ot.id) THEN ''A Breezeway work order was already sent for it.''',
    'WHEN false THEN ''practice''');
END $m$;
-- @@APPLY@@
-- onboarding-work-order-done: staged, apply only on "Approved: apply onboarding-work-order-done".
-- Needs mark-done-breezeway applied first (preflight stops otherwise).
-- 1. Instructions bookkeeping on each send. 2. A Task is done once its work order exists in Breezeway,
-- through the canonical bulk_complete_onboarding_tasks. 3. A watched Task reopens when its work order
-- is canceled in Breezeway or passes its date unfinished. Reads Breezeway only through the synced mirror.

ALTER TABLE public.breezeway_outbound_tasks
  ADD COLUMN IF NOT EXISTS instructions_set_at timestamptz,
  ADD COLUMN IF NOT EXISTS instructions_error text;

CREATE TABLE public.onboarding_task_work_order_watch (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  outbound_id uuid NOT NULL UNIQUE REFERENCES public.breezeway_outbound_tasks(id),
  task_id uuid NOT NULL REFERENCES public.onboarding_tasks(id),
  property_id uuid NOT NULL,
  breezeway_task_id bigint NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  completed_by uuid,
  state text NOT NULL DEFAULT 'watching' CHECK (state IN ('watching','reopened','finished','stopped')),
  reopen_kind text CHECK (reopen_kind IN ('canceled','missed_date')),
  reopen_reason text,
  reopened_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX onboarding_task_work_order_watch_task ON public.onboarding_task_work_order_watch(task_id);
GRANT SELECT ON public.onboarding_task_work_order_watch TO authenticated;
GRANT ALL ON public.onboarding_task_work_order_watch TO service_role;
ALTER TABLE public.onboarding_task_work_order_watch ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Onboarding staff read work order watch" ON public.onboarding_task_work_order_watch
  FOR SELECT TO authenticated USING (public.is_onboarding_staff(auth.uid()));

-- 2. Called by the sender right after Breezeway returns the new work order's number.
CREATE OR REPLACE FUNCTION public.complete_task_on_work_order_created(_outbound_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  o record; t record; r jsonb; done int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in first.'; END IF;
  SELECT * INTO o FROM public.breezeway_outbound_tasks WHERE id = _outbound_id FOR UPDATE;
  IF NOT FOUND OR o.source_type <> 'onboarding_task' THEN RAISE EXCEPTION 'That work order is not on an onboarding Task.'; END IF;
  IF o.breezeway_task_id IS NULL OR o.status NOT IN ('created','synced') THEN
    RAISE EXCEPTION 'The work order is not created in Breezeway yet.';
  END IF;
  IF o.created_by IS DISTINCT FROM uid AND NOT public.is_onboarding_director(uid) AND NOT public.has_role(uid, 'admin') THEN
    RAISE EXCEPTION 'Only the person who sent this work order can do this.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.onboarding_task_work_order_watch WHERE outbound_id = _outbound_id) THEN
    RETURN jsonb_build_object('completed', 0, 'already', true, 'held', '[]'::jsonb);
  END IF;
  SELECT id, status, is_demo INTO t FROM public.onboarding_tasks WHERE id = o.onboarding_task_id;
  IF t.status = 'complete' THEN
    RETURN jsonb_build_object('completed', 0, 'already', true, 'held', '[]'::jsonb);
  END IF;
  r := public.bulk_complete_onboarding_tasks(
    o.property_id, ARRAY[o.onboarding_task_id],
    'Breezeway work order ' || o.breezeway_task_id || ' created.',
    NULL, NULL, false);
  done := COALESCE((r->>'completed')::int, 0);
  IF done > 0 THEN
    INSERT INTO public.onboarding_task_work_order_watch(outbound_id, task_id, property_id, breezeway_task_id, completed_by, is_demo)
    VALUES (o.id, o.onboarding_task_id, o.property_id, o.breezeway_task_id, uid, COALESCE(t.is_demo, false));
  END IF;
  RETURN jsonb_build_object('completed', done, 'already', false, 'held', COALESCE(r->'held', '[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.complete_task_on_work_order_created(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_task_on_work_order_created(uuid) TO authenticated;

-- 3. Five-minute pass (service only). Never writes to Breezeway.
CREATE OR REPLACE FUNCTION public.reopen_tasks_for_work_orders()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  w record; kind text; reason text; today date; proj record;
  reopened int := 0; finished int := 0; stopped int := 0;
BEGIN
  FOR w IN
    SELECT x.id, x.task_id, x.property_id, x.state, x.is_demo, b.stage, b.status bz_status, b.scheduled_date,
           t.status task_status, t.title, t.completed_at, p.time_zone
    FROM public.onboarding_task_work_order_watch x
    JOIN public.breezeway_work_orders b ON b.breezeway_task_id = x.breezeway_task_id
    JOIN public.onboarding_tasks t ON t.id = x.task_id
    JOIN public.properties p ON p.id = x.property_id
    WHERE x.state IN ('watching','reopened')
    FOR UPDATE OF x SKIP LOCKED
  LOOP
    IF lower(coalesce(w.stage,'')) = 'finished'
       OR lower(coalesce(w.bz_status,'')) IN ('finished','approved','closed','completed','complete') THEN
      UPDATE public.onboarding_task_work_order_watch SET state = 'finished' WHERE id = w.id;
      finished := finished + 1; CONTINUE;
    END IF;
    IF w.state = 'reopened' THEN CONTINUE; END IF;
    IF w.task_status <> 'complete' THEN
      UPDATE public.onboarding_task_work_order_watch SET state = 'stopped' WHERE id = w.id;
      stopped := stopped + 1; CONTINUE;
    END IF;
    today := (now() AT TIME ZONE CASE WHEN w.time_zone IN (SELECT name FROM pg_timezone_names) THEN w.time_zone ELSE 'America/Chicago' END)::date;
    kind := CASE
      WHEN lower(coalesce(w.stage,'')) IN ('deleted','canceled','cancelled') OR lower(coalesce(w.bz_status,'')) IN ('deleted','canceled','cancelled') THEN 'canceled'
      WHEN w.scheduled_date IS NOT NULL AND w.scheduled_date < today THEN 'missed_date'
    END;
    IF kind IS NULL THEN CONTINUE; END IF;
    SELECT id, is_demo INTO proj FROM public.onboarding_projects
      WHERE property_id = w.property_id AND status <> 'cancelled' AND completed_at IS NULL LIMIT 1;
    IF NOT FOUND THEN
      UPDATE public.onboarding_task_work_order_watch SET state = 'stopped' WHERE id = w.id;
      stopped := stopped + 1; CONTINUE;
    END IF;
    reason := CASE kind
      WHEN 'canceled' THEN 'The Breezeway work order was canceled in Breezeway.'
      ELSE 'The Breezeway work order passed its date, ' || trim(to_char(w.scheduled_date, 'Mon FMDD')) || ', without being completed.'
    END;
    UPDATE public.onboarding_tasks SET status = 'open' WHERE id = w.task_id AND status = 'complete';
    UPDATE public.onboarding_task_work_order_watch
      SET state = 'reopened', reopen_kind = kind, reopen_reason = reason, reopened_at = now() WHERE id = w.id;
    INSERT INTO public.onboarding_project_events(project_id, property_id, kind, summary, detail, prior_value, new_value, actor, is_demo)
    VALUES (proj.id, w.property_id, 'task_reopened', 'Reopened "' || w.title || '"', reason,
            'Completed ' || to_char(w.completed_at AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD'), 'Open', NULL, COALESCE(proj.is_demo, w.is_demo));
    INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_id, entity_label, reason, after_value)
    VALUES (NULL, 'Breezeway work order', 'onboarding_task_reopened', 'onboarding_task', w.task_id, w.title, reason,
            jsonb_build_object('status','open','reopen_kind',kind));
    reopened := reopened + 1;
  END LOOP;
  RETURN jsonb_build_object('reopened', reopened, 'finished', finished, 'stopped', stopped);
END $$;
REVOKE ALL ON FUNCTION public.reopen_tasks_for_work_orders() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reopen_tasks_for_work_orders() TO service_role;

INSERT INTO public.audit_log(actor_label, action, entity_type, reason)
VALUES ('Admin', 'onboarding_work_order_done.apply', 'migration', 'Approved: apply onboarding-work-order-done');

DO $p$
DECLARE r1 jsonb; r2 jsonb; r3 jsonb; again jsonb; pass1 jsonb; pass2 jsonb; out text := ''; s text;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub','82bdbc3a-791c-433a-9944-651661f89eb1','role','authenticated')::text, true);
  PERFORM set_config('role', 'authenticated', true);
  r1 := public.complete_task_on_work_order_created('6275fc47-0f2b-448f-be9b-96fcfb039e74');
  r2 := public.complete_task_on_work_order_created('ec314b01-b5db-4347-a1d7-04a2b5899e02');
  r3 := public.complete_task_on_work_order_created('6b5d3992-851f-4248-995f-efae80d8312e');
  again := public.complete_task_on_work_order_created('ec314b01-b5db-4347-a1d7-04a2b5899e02');
  PERFORM set_config('role', 'postgres', true);
  out := out || 'Complete on create: Painting ' || r1::text || ' | Final ' || r2::text || ' | Lawn ' || r3::text || ' | Final again ' || again::text;
  SELECT string_agg(title || '=' || status, ', ') INTO s FROM public.onboarding_tasks WHERE id IN ('e4430d17-8169-4150-bb23-a83198f7a03e','f1b10673-41d4-424d-9fb7-a5fc84ae38d9','41ead900-8b12-49e2-a0b3-9b037239ccb6');
  out := out || ' || Tasks after create: ' || s;
  pass1 := public.reopen_tasks_for_work_orders();
  UPDATE public.breezeway_work_orders SET stage = 'deleted', status = 'Deleted' WHERE breezeway_task_id = (SELECT breezeway_task_id FROM public.breezeway_outbound_tasks WHERE id='6b5d3992-851f-4248-995f-efae80d8312e');
  pass2 := public.reopen_tasks_for_work_orders();
  SELECT string_agg(t.title || '=' || t.status || coalesce(' (' || x.reopen_reason || ')', ''), ', ') INTO s
    FROM public.onboarding_task_work_order_watch x JOIN public.onboarding_tasks t ON t.id = x.task_id;
  out := out || ' || Pass 1 ' || pass1::text || ' Pass 2 (Lawn canceled) ' || pass2::text || ' || Now: ' || s;
  SELECT count(*)::text INTO s FROM public.onboarding_project_events WHERE kind='task_reopened' AND created_at >= now() AND actor IS NULL;
  out := out || ' || reopen history lines ' || s;
  SELECT count(*)::text INTO s FROM public.owner_notifications WHERE created_at >= now();
  out := out || ' | owner notices ' || s;
  RAISE EXCEPTION 'PRACTICE ROLLED BACK: %', out;
END $p$;
ROLLBACK;
