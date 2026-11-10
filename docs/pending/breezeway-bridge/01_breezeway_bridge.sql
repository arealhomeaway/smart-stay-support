-- Breezeway bridge (Emily, Nov 10; register T15, C4, C5, C6).
-- The bridge switch is real (same pattern as email intake, register E1): one Turn on action moves
-- a forward only start line and records who and when; every creation path checks the switch and
-- the start line; anything older is skipped and recorded with the reason "before the bridge started".
-- Reported Issues become one ordinary ticket each; finished maintenance work orders get one
-- Maintenance Review for Team B, due 24 hours after the finish time. Internal work orders get
-- their own switch, off: while off no Resolve work order and no Breezeway task can be created.
-- Additive: new nullable columns, two new tables, new functions and triggers. The 5,233 mirrored
-- rows keep working (new columns are empty for them). Both switches stay off.
-- Undo: undo/01_breezeway_bridge.sql. No BEGIN/COMMIT: the migration tool runs this in one transaction.

-- 1. What the webhook already fetches, now kept on the mirror (empty where unknown).
ALTER TABLE public.breezeway_work_orders
  ADD COLUMN IF NOT EXISTS tags text[],
  ADD COLUMN IF NOT EXISTS created_by_id text,
  ADD COLUMN IF NOT EXISTS created_by_name text,
  ADD COLUMN IF NOT EXISTS requested_by text,
  ADD COLUMN IF NOT EXISTS reported_issue boolean,
  ADD COLUMN IF NOT EXISTS report_url text,
  ADD COLUMN IF NOT EXISTS bridge_keep boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.breezeway_work_orders.bridge_keep IS
  'True once the bridge made a ticket or a review from this row, so the safety sweep never removes it.';

-- 2. Home tags from Breezeway (GET /property/{id}/tags), read only, for the New House skip.
CREATE TABLE IF NOT EXISTS public.breezeway_home_tags (
  home_id text PRIMARY KEY,
  tags text[] NOT NULL DEFAULT '{}',
  fetched_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.breezeway_home_tags TO authenticated;
GRANT ALL ON public.breezeway_home_tags TO service_role;
ALTER TABLE public.breezeway_home_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read Breezeway home tags" ON public.breezeway_home_tags
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- 3. One record per bridge decision: created, skipped (with the reason) or failed.
CREATE TABLE IF NOT EXISTS public.breezeway_bridge_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  breezeway_task_id bigint NOT NULL,
  work_order_id uuid,
  breezeway_home_id text,
  property_id uuid,
  kind text NOT NULL CHECK (kind IN ('reported_issue', 'maintenance_review')),
  outcome text NOT NULL CHECK (outcome IN ('created', 'skipped', 'failed')),
  reason text NOT NULL DEFAULT '',
  ticket_id uuid,
  routine_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS breezeway_bridge_records_once
  ON public.breezeway_bridge_records (breezeway_task_id, kind) WHERE outcome = 'created';
CREATE UNIQUE INDEX IF NOT EXISTS breezeway_bridge_records_skip_once
  ON public.breezeway_bridge_records (breezeway_task_id, kind, reason) WHERE outcome = 'skipped';
CREATE INDEX IF NOT EXISTS breezeway_bridge_records_created_at
  ON public.breezeway_bridge_records (created_at DESC);
GRANT SELECT ON public.breezeway_bridge_records TO authenticated;
GRANT ALL ON public.breezeway_bridge_records TO service_role;
ALTER TABLE public.breezeway_bridge_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read bridge records" ON public.breezeway_bridge_records
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. Switches and the start line. The start line lives in app_settings key
-- breezeway_bridge_start_line ({"at": ..., "by": ...}); no row means no start line yet.
-- The internal_work_orders switch starts off: no Resolve work order and no Breezeway task is
-- created while it is off (register C4).
INSERT INTO public.feature_flags (key, label, enabled, description)
VALUES ('internal_work_orders', 'Resolve work orders', false,
        'Resolve work orders. Off: work orders are made in Breezeway and linked on the ticket; nothing is sent to Breezeway.')
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION private.guard_breezeway_bridge_switch()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF coalesce(current_setting('resolve.breezeway_bridge_switch', true), '') = 'on' THEN
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'feature_flags' THEN
    IF NEW.key = 'breezeway_bridge'
       AND ((TG_OP = 'INSERT' AND NEW.enabled)
            OR (TG_OP = 'UPDATE' AND NEW.enabled IS DISTINCT FROM OLD.enabled)) THEN
      RAISE EXCEPTION 'The Breezeway bridge can only be turned on or off with its own switch, so the start line moves with it.';
    END IF;
    RETURN NEW;
  END IF;
  -- app_settings: the start line only moves inside set_breezeway_bridge.
  IF (TG_OP = 'DELETE' AND OLD.key = 'breezeway_bridge_start_line')
     OR (TG_OP = 'INSERT' AND NEW.key = 'breezeway_bridge_start_line' AND nullif(NEW.value ->> 'at', '') IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND (NEW.key = 'breezeway_bridge_start_line' OR OLD.key = 'breezeway_bridge_start_line')
         AND (NEW.value IS DISTINCT FROM OLD.value OR NEW.key IS DISTINCT FROM OLD.key)) THEN
    RAISE EXCEPTION 'The Breezeway bridge start line only moves when the bridge is turned on.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER feature_flags_breezeway_bridge_guard
  BEFORE INSERT OR UPDATE ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION private.guard_breezeway_bridge_switch();
CREATE TRIGGER app_settings_breezeway_bridge_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION private.guard_breezeway_bridge_switch();

CREATE OR REPLACE FUNCTION private.breezeway_bridge_start_line()
RETURNS timestamptz
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nullif(value ->> 'at', '')::timestamptz
    FROM public.app_settings WHERE key = 'breezeway_bridge_start_line';
$$;

-- The one way to turn the bridge on or off (Admin only). On: the start line moves to that moment
-- (forward only) and the safety sweep starts in the same step. Off: creation stops and the sweep
-- stops. Who and when are recorded either way.
CREATE OR REPLACE FUNCTION public.set_breezeway_bridge(_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _me uuid := auth.uid();
  _was boolean;
  _before timestamptz;
  _after timestamptz;
  _line timestamptz := date_trunc('second', clock_timestamp()) + interval '1 second';
  _job_id bigint;
  _job_was boolean;
BEGIN
  IF _me IS NULL OR NOT private.has_role(_me, 'admin') THEN
    RAISE EXCEPTION 'Only an Admin can turn the Breezeway bridge on or off.';
  END IF;
  IF _enabled IS NULL THEN
    RAISE EXCEPTION 'Choose on or off.';
  END IF;
  SELECT enabled INTO _was FROM public.feature_flags WHERE key = 'breezeway_bridge' FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'The Breezeway bridge switch was not found.';
  END IF;
  SELECT j.jobid, j.active INTO _job_id, _job_was
    FROM cron.job j WHERE j.jobname = 'breezeway-safety-sweep' LIMIT 1;
  IF _enabled AND _job_id IS NULL THEN
    RAISE EXCEPTION 'The safety sweep was not found, so the Breezeway bridge stays off.';
  END IF;
  PERFORM 1 FROM public.app_settings WHERE key = 'breezeway_bridge_start_line' FOR UPDATE;
  _before := private.breezeway_bridge_start_line();
  _after := _before;

  IF _was = _enabled THEN
    IF _job_id IS NOT NULL AND _job_was IS DISTINCT FROM _enabled THEN
      PERFORM cron.alter_job(job_id := _job_id, active := _enabled);
    END IF;
    RETURN jsonb_build_object('enabled', _was, 'changed', false, 'start_line', _before,
                              'sweep', CASE WHEN _job_id IS NULL THEN false ELSE _enabled END);
  END IF;

  PERFORM set_config('resolve.breezeway_bridge_switch', 'on', true);
  IF _enabled AND (_before IS NULL OR _before < _line) THEN
    _after := _line;
    INSERT INTO public.app_settings (key, value, updated_by, updated_at)
    VALUES ('breezeway_bridge_start_line', jsonb_build_object('at', _after, 'by', _me), _me, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_by = _me, updated_at = now();
  END IF;
  UPDATE public.feature_flags
     SET enabled = _enabled, updated_by = _me, updated_at = now()
   WHERE key = 'breezeway_bridge';
  PERFORM set_config('resolve.breezeway_bridge_switch', '', true);
  IF _job_id IS NOT NULL THEN
    PERFORM cron.alter_job(job_id := _job_id, active := _enabled);
  END IF;
  INSERT INTO public.integration_events
    (system, direction, operation, status, resolved_by, resolved_at, previous_value, request_payload)
  VALUES ('breezeway', 'inbound', 'bridge_switch',
          CASE WHEN _enabled THEN 'on' ELSE 'off' END, _me, now(),
          jsonb_build_object('enabled', _was, 'start_line', _before, 'sweep', coalesce(_job_was, false)),
          jsonb_build_object('enabled', _enabled, 'start_line', _after,
                             'sweep', CASE WHEN _job_id IS NULL THEN false ELSE _enabled END));
  RETURN jsonb_build_object('enabled', _enabled, 'changed', true, 'start_line', _after,
                            'sweep', CASE WHEN _job_id IS NULL THEN false ELSE _enabled END);
END $$;

REVOKE ALL ON FUNCTION public.set_breezeway_bridge(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_breezeway_bridge(boolean) TO authenticated, service_role;

-- 5. The one place a bridge record is skipped: same order on every path.
CREATE OR REPLACE FUNCTION private.breezeway_bridge_skip_reason(
  _on boolean, _line timestamptz, _at timestamptz, _property_id uuid, _mapping_state text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN NOT coalesce(_on, false) THEN 'the bridge is off'
    WHEN _line IS NULL OR _at IS NULL OR _at < _line THEN 'before the bridge started'
    WHEN _property_id IS NULL OR coalesce(_mapping_state, '') <> 'verified' THEN 'not a verified Resolve home'
    ELSE NULL
  END;
$$;

-- New House: the Breezeway home tag when Breezeway gives it, else the home's name.
CREATE OR REPLACE FUNCTION private.breezeway_is_new_house(
  _home_id text, _task_tags text[], _home_name text, _home_nickname text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
           SELECT 1 FROM public.breezeway_home_tags h, unnest(h.tags) t
            WHERE h.home_id = _home_id AND t ILIKE '%new house%')
      OR EXISTS (SELECT 1 FROM unnest(coalesce(_task_tags, '{}'::text[])) t WHERE t ILIKE '%new house%')
      OR coalesce(_home_name, '') ILIKE '%new house%'
      OR coalesce(_home_nickname, '') ILIKE '%new house%';
$$;

-- 6. Creation, once per task, from every mirror write (webhook, recovery, sweep, manual refresh).
CREATE OR REPLACE FUNCTION private.breezeway_bridge_apply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _on boolean;
  _line timestamptz;
  _prop record;
  _reason text;
  _ticket uuid;
  _routine uuid;
  _priority text;
  _at timestamptz;
  _link text;
  -- Finished stage: Finished, Approved and Closed all sit in it. Lawn care is maintenance.
  _maint boolean := lower(coalesce(NEW.department, '')) = 'maintenance'
                    AND (lower(coalesce(NEW.stage, '')) = 'finished'
                         OR lower(coalesce(NEW.status, '')) IN ('finished', 'approved', 'closed'));
BEGIN
  IF coalesce(current_setting('resolve.breezeway_bridge_applying', true), '') = 'on' THEN
    RETURN NEW;
  END IF;
  IF NEW.breezeway_task_id IS NULL OR NOT (NEW.reported_issue IS TRUE OR _maint) THEN
    RETURN NEW;
  END IF;
  -- Bridge off: nothing is created and nothing is recorded (turning it off stops creation).
  SELECT enabled INTO _on FROM public.feature_flags WHERE key = 'breezeway_bridge';
  IF NOT coalesce(_on, false) THEN
    RETURN NEW;
  END IF;

  BEGIN
    _line := private.breezeway_bridge_start_line();
    SELECT p.id, p.name, p.nickname, p.is_demo, p.breezeway_mapping_state
      INTO _prop FROM public.properties p WHERE p.id = NEW.property_id;
    _link := coalesce(nullif(btrim(NEW.report_url), ''),
                      'https://app.breezeway.io/task/' || NEW.breezeway_task_id);

    -- Reported Issue: one ordinary ticket, unowned, From Breezeway, Team B.
    IF NEW.reported_issue IS TRUE AND NOT EXISTS (
         SELECT 1 FROM public.breezeway_bridge_records
          WHERE breezeway_task_id = NEW.breezeway_task_id AND kind = 'reported_issue' AND outcome = 'created') THEN
      -- Never later than Breezeway's own last update: old work first seen late stays old.
      _at := least(coalesce(NEW.breezeway_created_at, NEW.created_at),
                   coalesce(NEW.breezeway_updated_at, NEW.breezeway_created_at, NEW.created_at));
      _reason := private.breezeway_bridge_skip_reason(_on, _line, _at, _prop.id, _prop.breezeway_mapping_state);
      IF _reason IS NULL AND NEW.linked_ticket_id IS NOT NULL THEN
        _reason := 'already has a ticket';
      END IF;
      IF _reason IS NOT NULL THEN
        INSERT INTO public.breezeway_bridge_records
          (breezeway_task_id, work_order_id, breezeway_home_id, property_id, kind, outcome, reason, ticket_id)
        VALUES (NEW.breezeway_task_id, NEW.id, NEW.breezeway_home_id, NEW.property_id,
                'reported_issue', 'skipped', _reason, NEW.linked_ticket_id)
        ON CONFLICT DO NOTHING;
      ELSE
        _priority := CASE lower(coalesce(NEW.priority, ''))
                       WHEN 'urgent' THEN 'p1' WHEN 'high' THEN 'p2' ELSE 'p3' END;
        -- A normal ticket: the clocks start when Resolve receives it, with the same priority
        -- defaults as every other new ticket (slaDueDates in src/lib/tickets.ts).
        INSERT INTO public.tickets
          (record_type, title, description, property_id, priority, suggested_priority, status,
           source_channel, initiator_type, external_source, external_id, external_url,
           external_synced_at, breezeway_task_id, reported_at, department_code, is_demo,
           response_due_at, action_due_at)
        VALUES ('active_task', coalesce(nullif(btrim(NEW.name), ''), 'Breezeway reported issue'),
                NEW.description, NEW.property_id, _priority, _priority, 'open',
                'breezeway', 'external', 'breezeway', NEW.breezeway_task_id::text, _link,
                now(), NEW.breezeway_task_id, least(now(), coalesce(_at, now())), 'operations',
                coalesce(_prop.is_demo, false),
                now() + make_interval(mins => CASE _priority WHEN 'p1' THEN 3 WHEN 'p2' THEN 30 ELSE 120 END),
                now() + make_interval(mins => CASE _priority WHEN 'p1' THEN 5 WHEN 'p2' THEN 60 ELSE 480 END))
        ON CONFLICT (external_source, external_id)
          WHERE external_source IS NOT NULL AND external_id IS NOT NULL
          DO NOTHING
        RETURNING id INTO _ticket;
        IF _ticket IS NULL THEN
          SELECT id INTO _ticket FROM public.tickets
           WHERE external_source = 'breezeway' AND external_id = NEW.breezeway_task_id::text;
        END IF;
        PERFORM set_config('resolve.breezeway_bridge_applying', 'on', true);
        UPDATE public.breezeway_work_orders
           SET linked_ticket_id = coalesce(linked_ticket_id, _ticket), bridge_keep = true
         WHERE id = NEW.id;
        PERFORM set_config('resolve.breezeway_bridge_applying', '', true);
        INSERT INTO public.breezeway_bridge_records
          (breezeway_task_id, work_order_id, breezeway_home_id, property_id, kind, outcome, ticket_id)
        VALUES (NEW.breezeway_task_id, NEW.id, NEW.breezeway_home_id, NEW.property_id,
                'reported_issue', 'created', _ticket)
        ON CONFLICT DO NOTHING;
      END IF;
    END IF;

    -- Finished maintenance (lawn too): one Maintenance Review for Team B, due 24 hours after finish.
    IF _maint AND NEW.finished_at IS NOT NULL AND NOT EXISTS (
         SELECT 1 FROM public.breezeway_bridge_records
          WHERE breezeway_task_id = NEW.breezeway_task_id AND kind = 'maintenance_review' AND outcome = 'created') THEN
      _at := least(NEW.finished_at, coalesce(NEW.breezeway_updated_at, NEW.finished_at));
      _reason := private.breezeway_bridge_skip_reason(_on, _line, _at, _prop.id, _prop.breezeway_mapping_state);
      IF _reason IS NULL AND private.breezeway_is_new_house(NEW.breezeway_home_id, NEW.tags, _prop.name, _prop.nickname) THEN
        _reason := 'New House home';
      END IF;
      IF _reason IS NOT NULL THEN
        INSERT INTO public.breezeway_bridge_records
          (breezeway_task_id, work_order_id, breezeway_home_id, property_id, kind, outcome, reason)
        VALUES (NEW.breezeway_task_id, NEW.id, NEW.breezeway_home_id, NEW.property_id,
                'maintenance_review', 'skipped', _reason)
        ON CONFLICT DO NOTHING;
      ELSE
        INSERT INTO public.routine_controls
          (kind, event_key, property_id, title, status, team, due_at, is_demo)
        VALUES ('maintenance_review', 'bz_maint:' || NEW.id, NEW.property_id,
                coalesce(nullif(btrim(NEW.name), ''), 'Maintenance review'), 'due',
                'property_operations', NEW.finished_at + interval '24 hours',
                coalesce(_prop.is_demo, false))
        ON CONFLICT (kind, event_key) DO NOTHING
        RETURNING id INTO _routine;
        PERFORM set_config('resolve.breezeway_bridge_applying', 'on', true);
        UPDATE public.breezeway_work_orders SET bridge_keep = true WHERE id = NEW.id;
        PERFORM set_config('resolve.breezeway_bridge_applying', '', true);
        IF _routine IS NULL THEN
          SELECT id INTO _routine FROM public.routine_controls
           WHERE kind = 'maintenance_review' AND event_key = 'bz_maint:' || NEW.id;
          INSERT INTO public.breezeway_bridge_records
            (breezeway_task_id, work_order_id, breezeway_home_id, property_id, kind, outcome, reason, routine_id)
          VALUES (NEW.breezeway_task_id, NEW.id, NEW.breezeway_home_id, NEW.property_id,
                  'maintenance_review', 'skipped', 'a review already exists', _routine)
          ON CONFLICT DO NOTHING;
        ELSE
          INSERT INTO public.breezeway_bridge_records
            (breezeway_task_id, work_order_id, breezeway_home_id, property_id, kind, outcome, routine_id)
          VALUES (NEW.breezeway_task_id, NEW.id, NEW.breezeway_home_id, NEW.property_id,
                  'maintenance_review', 'created', _routine)
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Never breaks the mirror write. The failure is kept and shown on Integrations.
    PERFORM set_config('resolve.breezeway_bridge_applying', '', true);
    _reason := left(SQLERRM, 300);
    BEGIN
      INSERT INTO public.breezeway_bridge_records
        (breezeway_task_id, work_order_id, breezeway_home_id, property_id, kind, outcome, reason)
      VALUES (NEW.breezeway_task_id, NEW.id, NEW.breezeway_home_id, NEW.property_id,
              CASE WHEN NEW.reported_issue IS TRUE THEN 'reported_issue' ELSE 'maintenance_review' END,
              'failed', _reason);
      INSERT INTO public.integration_events
        (system, direction, operation, status, external_id, error_message)
      VALUES ('breezeway', 'inbound', 'bridge_create', 'failed', NEW.breezeway_task_id::text, _reason);
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'Breezeway bridge failure for task % not recorded: %', NEW.breezeway_task_id, SQLERRM;
    END;
  END;
  RETURN NEW;
END $$;

CREATE TRIGGER breezeway_bridge_apply
  AFTER INSERT OR UPDATE ON public.breezeway_work_orders
  FOR EACH ROW EXECUTE FUNCTION private.breezeway_bridge_apply();

-- 7. No internal work orders while the switch is off (demo practice rows excepted).
CREATE OR REPLACE FUNCTION private.refuse_internal_work_orders()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF coalesce((SELECT enabled FROM public.feature_flags WHERE key = 'internal_work_orders'), false) THEN
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'work_orders' THEN
    IF coalesce(NEW.is_demo, false) THEN
      RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Work orders are made in Breezeway for now. Link the Breezeway work order on the ticket.'
      USING ERRCODE = '42501';
  END IF;
  RAISE EXCEPTION 'Nothing is sent to Breezeway from Resolve for now. Make the task in Breezeway.'
    USING ERRCODE = '42501';
END $$;

CREATE TRIGGER work_orders_internal_switch
  BEFORE INSERT ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION private.refuse_internal_work_orders();
CREATE TRIGGER breezeway_outbound_internal_switch
  BEFORE INSERT ON public.breezeway_outbound_tasks
  FOR EACH ROW EXECUTE FUNCTION private.refuse_internal_work_orders();

-- 8. The true state for the Integrations panel (Admin only).
CREATE OR REPLACE FUNCTION public.breezeway_bridge_status()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, private
AS $$
DECLARE
  _me uuid := auth.uid();
  _line timestamptz := private.breezeway_bridge_start_line();
  _out jsonb;
BEGIN
  IF _me IS NULL OR NOT private.has_role(_me, 'admin') THEN
    RAISE EXCEPTION 'Only an Admin can read the Breezeway bridge status.';
  END IF;
  SELECT jsonb_build_object(
    'enabled', coalesce((SELECT enabled FROM public.feature_flags WHERE key = 'breezeway_bridge'), false),
    'start_line', _line,
    'sweep_found', EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'breezeway-safety-sweep'),
    'sweep_active', coalesce((SELECT active FROM cron.job WHERE jobname = 'breezeway-safety-sweep' LIMIT 1), false),
    'last_switch', (SELECT jsonb_build_object('status', e.status, 'at', e.resolved_at,
                                              'by', coalesce(pr.full_name, pr.email))
                      FROM public.integration_events e
                      LEFT JOIN public.profiles pr ON pr.id = e.resolved_by
                     WHERE e.system = 'breezeway' AND e.operation = 'bridge_switch'
                     ORDER BY e.created_at DESC LIMIT 1),
    'last_processed_at', (SELECT max(received_at) FROM public.breezeway_webhook_events
                           WHERE outcome = 'processed' AND NOT is_fixture),
    'tickets_created', (SELECT count(*) FROM public.breezeway_bridge_records
                         WHERE kind = 'reported_issue' AND outcome = 'created'),
    'reviews_created', (SELECT count(*) FROM public.breezeway_bridge_records
                         WHERE kind = 'maintenance_review' AND outcome = 'created'),
    'skipped', (SELECT count(*) FROM public.breezeway_bridge_records WHERE outcome = 'skipped'),
    'skipped_by_reason', coalesce((SELECT jsonb_object_agg(reason, n) FROM (
                            SELECT reason, count(*) n FROM public.breezeway_bridge_records
                             WHERE outcome = 'skipped' GROUP BY reason) r), '{}'::jsonb),
    'bridge_failed', (SELECT count(*) FROM public.breezeway_bridge_records WHERE outcome = 'failed'),
    'other_homes_since_start', CASE WHEN _line IS NULL THEN 0 ELSE
                                 (SELECT count(*) FROM public.breezeway_webhook_events
                                   WHERE outcome = 'ignored_other_property' AND NOT is_fixture
                                     AND received_at >= _line) END,
    'failed_lookups', (SELECT count(*) FROM public.breezeway_webhook_events
                        WHERE outcome = 'verify_failed' AND retryable AND recovered_at IS NULL
                          AND NOT is_fixture),
    'mirror_failures', (SELECT count(*) FROM public.integration_events
                         WHERE system = 'breezeway' AND operation = 'mirror_refresh' AND status = 'failed'),
    'second_escalations', (SELECT count(*) FROM public.integration_events
                            WHERE system = 'breezeway' AND operation = 'second_escalation'),
    'recent', coalesce((SELECT jsonb_agg(x ORDER BY x.created_at DESC) FROM (
                 SELECT r.created_at, r.kind, r.outcome, r.reason, r.breezeway_task_id,
                        r.breezeway_home_id, r.ticket_id, r.routine_id,
                        coalesce(p.address_line1, p.nickname, p.name) AS home
                   FROM public.breezeway_bridge_records r
                   LEFT JOIN public.properties p ON p.id = r.property_id
                  ORDER BY r.created_at DESC LIMIT 25) x), '[]'::jsonb),
    'recent_failures', coalesce((SELECT jsonb_agg(y ORDER BY y.created_at DESC) FROM (
                 SELECT e.created_at, e.operation, e.status, e.external_id, e.error_message
                   FROM public.integration_events e
                  WHERE e.system = 'breezeway'
                    AND e.operation IN ('mirror_refresh', 'bridge_create', 'second_escalation')
                  ORDER BY e.created_at DESC LIMIT 10) y), '[]'::jsonb)
  ) INTO _out;
  RETURN _out;
END $$;

REVOKE ALL ON FUNCTION public.breezeway_bridge_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.breezeway_bridge_status() TO authenticated, service_role;
