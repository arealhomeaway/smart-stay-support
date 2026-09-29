-- STR Cleaner Hours Safeguard, Phase 1: data foundation + monitoring (internal only).
-- No thresholds, blocking or tax conclusions live here.

CREATE TABLE public.cleaner_workers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL CHECK (length(btrim(display_name)) BETWEEN 1 AND 200),
  account_type text NOT NULL CHECK (account_type IN ('individual','company')),
  active boolean NOT NULL DEFAULT true,
  company_worker_id uuid REFERENCES public.cleaner_workers(id),
  vendor_org_id uuid REFERENCES public.vendor_orgs(id),
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.cleaner_workers TO authenticated;
GRANT ALL ON public.cleaner_workers TO service_role;
ALTER TABLE public.cleaner_workers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leadership reads cleaner workers" ON public.cleaner_workers FOR SELECT TO authenticated USING (public.is_supervisor(auth.uid()));

CREATE TABLE public.cleaner_breezeway_accounts (
  breezeway_person_id bigint PRIMARY KEY,
  last_seen_name text,
  classification text NOT NULL DEFAULT 'unclassified'
    CHECK (classification IN ('unclassified','individual','company','duplicate','unknown')),
  worker_id uuid REFERENCES public.cleaner_workers(id),
  classification_note text,
  classified_by uuid,
  classified_at timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cleaner_account_worker_matches_class
    CHECK ((classification IN ('individual','company','duplicate')) = (worker_id IS NOT NULL))
);
CREATE INDEX cleaner_breezeway_accounts_worker_idx ON public.cleaner_breezeway_accounts(worker_id);
GRANT SELECT ON public.cleaner_breezeway_accounts TO authenticated;
GRANT ALL ON public.cleaner_breezeway_accounts TO service_role;
ALTER TABLE public.cleaner_breezeway_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leadership reads cleaner accounts" ON public.cleaner_breezeway_accounts FOR SELECT TO authenticated USING (public.is_supervisor(auth.uid()));

CREATE TABLE public.cleaner_account_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  breezeway_person_id bigint NOT NULL,
  from_classification text,
  to_classification text NOT NULL,
  from_worker_id uuid,
  to_worker_id uuid,
  note text,
  actor_id uuid,
  actor_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cleaner_account_events_person_idx ON public.cleaner_account_events(breezeway_person_id, created_at);
GRANT SELECT ON public.cleaner_account_events TO authenticated;
GRANT ALL ON public.cleaner_account_events TO service_role;
ALTER TABLE public.cleaner_account_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leadership reads cleaner account history" ON public.cleaner_account_events FOR SELECT TO authenticated USING (public.is_supervisor(auth.uid()));

CREATE TABLE public.cleaner_task_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  breezeway_task_id bigint NOT NULL,
  breezeway_home_id bigint,
  property_id uuid REFERENCES public.properties(id),
  status_code text,
  status_stage text,
  department text,
  template_id bigint,
  task_name text,
  scheduled_date date,
  started_at timestamptz,
  finished_at timestamptz,
  total_time text,
  elapsed_seconds integer,
  finished_by_id bigint,
  finished_by_name text,
  assignees jsonb NOT NULL DEFAULT '[]'::jsonb,
  linked_reservation jsonb,
  source_updated_at timestamptz,
  payload jsonb NOT NULL,
  payload_hash text NOT NULL,
  source text NOT NULL CHECK (source IN ('webhook','reconcile','backfill','fixture')),
  is_fixture boolean NOT NULL DEFAULT false,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX cleaner_task_snapshots_task_idx ON public.cleaner_task_snapshots(breezeway_task_id, synced_at DESC);
CREATE INDEX cleaner_task_snapshots_assignees_idx ON public.cleaner_task_snapshots USING gin (assignees jsonb_path_ops);
GRANT SELECT ON public.cleaner_task_snapshots TO authenticated;
GRANT ALL ON public.cleaner_task_snapshots TO service_role;
ALTER TABLE public.cleaner_task_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leadership reads cleaner snapshots" ON public.cleaner_task_snapshots FOR SELECT TO authenticated USING (public.is_supervisor(auth.uid()));

-- Pointer to the latest snapshot + last time Breezeway was checked (history lives in snapshots).
CREATE TABLE public.cleaner_task_state (
  breezeway_task_id bigint PRIMARY KEY,
  latest_snapshot_id uuid REFERENCES public.cleaner_task_snapshots(id),
  property_id uuid REFERENCES public.properties(id),
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  last_source text,
  is_fixture boolean NOT NULL DEFAULT false
);
GRANT SELECT ON public.cleaner_task_state TO authenticated;
GRANT ALL ON public.cleaner_task_state TO service_role;
ALTER TABLE public.cleaner_task_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leadership reads cleaner task state" ON public.cleaner_task_state FOR SELECT TO authenticated USING (public.is_supervisor(auth.uid()));

CREATE TABLE public.cleaner_exposure_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_key text NOT NULL,
  worker_id uuid REFERENCES public.cleaner_workers(id),
  breezeway_person_id bigint,
  breezeway_person_name text,
  property_id uuid REFERENCES public.properties(id),
  completion_date date NOT NULL,
  breezeway_task_id bigint,
  assignee_count integer,
  raw_elapsed_seconds integer,
  attributed_minutes numeric(10,2),
  original_minutes numeric(10,2),
  attribution_method text NOT NULL CHECK (attribution_method IN (
    'single_individual_assignee','multi_assignee_full_elapsed','manual_correction','manual_entry',
    'company_only_needs_review','invalid_duration_needs_review','company_account_not_counted')),
  counted boolean NOT NULL,
  review_state text NOT NULL CHECK (review_state IN ('auto','needs_review','reviewed','not_counted')),
  confidence text NOT NULL CHECK (confidence IN ('high','medium','low')),
  snapshot_id uuid REFERENCES public.cleaner_task_snapshots(id),
  source_revision timestamptz,
  synced_at timestamptz NOT NULL DEFAULT now(),
  supersedes_id uuid REFERENCES public.cleaner_exposure_ledger(id),
  superseded_at timestamptz,
  superseded_reason text,
  reason text,
  author_id uuid,
  author_name text,
  is_fixture boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cleaner_manual_needs_reason CHECK (attribution_method NOT IN ('manual_correction','manual_entry') OR length(btrim(coalesce(reason,''))) >= 5)
);
CREATE UNIQUE INDEX cleaner_ledger_one_active ON public.cleaner_exposure_ledger(entry_key) WHERE superseded_at IS NULL;
CREATE INDEX cleaner_ledger_task_idx ON public.cleaner_exposure_ledger(breezeway_task_id);
CREATE INDEX cleaner_ledger_active_idx ON public.cleaner_exposure_ledger(property_id, completion_date) WHERE superseded_at IS NULL;
CREATE INDEX cleaner_ledger_worker_idx ON public.cleaner_exposure_ledger(worker_id) WHERE superseded_at IS NULL;
GRANT SELECT ON public.cleaner_exposure_ledger TO authenticated;
GRANT ALL ON public.cleaner_exposure_ledger TO service_role;
ALTER TABLE public.cleaner_exposure_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leadership reads cleaner ledger" ON public.cleaner_exposure_ledger FOR SELECT TO authenticated USING (public.is_supervisor(auth.uid()));

CREATE TABLE public.cleaner_review_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('company_only','unclassified_assignee','possible_duplicate_identity',
    'zero_duration','short_duration','long_duration','unmatched_property','manual_entry',
    'source_changed_after_correction','source_missing')),
  dedupe_key text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','dismissed')),
  breezeway_task_id bigint,
  breezeway_person_id bigint,
  breezeway_home_id bigint,
  property_id uuid REFERENCES public.properties(id),
  ledger_entry_id uuid REFERENCES public.cleaner_exposure_ledger(id),
  source_revision timestamptz,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_fixture boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid,
  resolved_by_name text,
  resolution_note text
);
CREATE UNIQUE INDEX cleaner_review_one_open ON public.cleaner_review_items(dedupe_key) WHERE status = 'open';
CREATE INDEX cleaner_review_status_idx ON public.cleaner_review_items(status, kind);
GRANT SELECT ON public.cleaner_review_items TO authenticated;
GRANT ALL ON public.cleaner_review_items TO service_role;
ALTER TABLE public.cleaner_review_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leadership reads cleaner review queue" ON public.cleaner_review_items FOR SELECT TO authenticated USING (public.is_supervisor(auth.uid()));

CREATE TABLE public.cleaner_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('backfill','nightly')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','complete','failed')),
  window_from date NOT NULL,
  window_to date NOT NULL,
  home_queue jsonb NOT NULL DEFAULT '[]'::jsonb,
  cursor integer NOT NULL DEFAULT 0,
  tasks_seen integer NOT NULL DEFAULT 0,
  snapshots_created integer NOT NULL DEFAULT 0,
  errors jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_error text,
  people_refreshed_at timestamptz,
  started_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);
GRANT SELECT ON public.cleaner_sync_runs TO authenticated;
GRANT ALL ON public.cleaner_sync_runs TO service_role;
ALTER TABLE public.cleaner_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Leadership reads cleaner sync runs" ON public.cleaner_sync_runs FOR SELECT TO authenticated USING (public.is_supervisor(auth.uid()));

-- Append-only guards. Fixture rows may be removed after QA; nothing else is deleted.
CREATE OR REPLACE FUNCTION private.cleaner_block_snapshot_change()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD.is_fixture THEN RETURN OLD; END IF;
  RAISE EXCEPTION 'Cleaner source records are permanent history and cannot be changed or deleted.';
END $$;
CREATE TRIGGER cleaner_snapshots_append_only BEFORE UPDATE OR DELETE ON public.cleaner_task_snapshots
  FOR EACH ROW EXECUTE FUNCTION private.cleaner_block_snapshot_change();
CREATE TRIGGER cleaner_account_events_append_only BEFORE UPDATE OR DELETE ON public.cleaner_account_events
  FOR EACH ROW EXECUTE FUNCTION private.cleaner_block_snapshot_change();

CREATE OR REPLACE FUNCTION private.cleaner_guard_ledger()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_fixture THEN RETURN OLD; END IF;
    RAISE EXCEPTION 'Cleaner exposure entries are never deleted; a correction supersedes them.';
  END IF;
  IF OLD.superseded_at IS NOT NULL OR NEW.superseded_at IS NULL
     OR (to_jsonb(NEW) - 'superseded_at' - 'superseded_reason') <> (to_jsonb(OLD) - 'superseded_at' - 'superseded_reason') THEN
    RAISE EXCEPTION 'Cleaner exposure entries are append-only; only marking an entry superseded is allowed.';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER cleaner_ledger_append_only BEFORE UPDATE OR DELETE ON public.cleaner_exposure_ledger
  FOR EACH ROW EXECUTE FUNCTION private.cleaner_guard_ledger();

-- Helpers ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.cleaner_parse_elapsed(_t text)
 RETURNS integer LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE m text[]; days int := 0;
BEGIN
  IF _t IS NULL OR btrim(_t) = '' THEN RETURN NULL; END IF;
  m := regexp_match(btrim(_t), '^(?:(\d+) days?, )?(\d+):(\d{2}):(\d{2})(?:\.\d+)?$');
  IF m IS NULL THEN RETURN NULL; END IF;
  days := coalesce(m[1]::int, 0);
  RETURN days*86400 + m[2]::int*3600 + m[3]::int*60 + m[4]::int;
END $$;

CREATE OR REPLACE FUNCTION private.cleaner_open_review(_kind text, _key text, _task bigint, _person bigint,
  _home bigint, _property uuid, _revision timestamptz, _detail jsonb, _fixture boolean)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  -- A staff decision on this exact source revision is respected; a newer revision reopens.
  IF EXISTS (SELECT 1 FROM cleaner_review_items WHERE dedupe_key=_key AND status IN ('resolved','dismissed')
             AND resolved_by IS NOT NULL AND source_revision IS NOT DISTINCT FROM _revision) THEN RETURN; END IF;
  INSERT INTO cleaner_review_items(kind, dedupe_key, breezeway_task_id, breezeway_person_id, breezeway_home_id,
    property_id, source_revision, detail, is_fixture)
  VALUES (_kind, _key, _task, _person, _home, _property, _revision, coalesce(_detail,'{}'::jsonb), _fixture)
  ON CONFLICT (dedupe_key) WHERE status='open'
  DO UPDATE SET source_revision = EXCLUDED.source_revision, detail = EXCLUDED.detail, property_id = EXCLUDED.property_id;
END $$;

CREATE OR REPLACE FUNCTION private.cleaner_close_review(_key text, _note text)
 RETURNS void LANGUAGE sql SET search_path TO 'public' AS $$
  UPDATE cleaner_review_items SET status='resolved', resolved_at=now(), resolution_note=_note
   WHERE dedupe_key=_key AND status='open';
$$;

CREATE OR REPLACE FUNCTION private.cleaner_person_reviews(_person bigint, _fixture boolean)
 RETURNS void LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE a record; others int;
BEGIN
  SELECT * INTO a FROM cleaner_breezeway_accounts WHERE breezeway_person_id=_person;
  IF a IS NULL THEN RETURN; END IF;
  IF a.classification IN ('unclassified','unknown') THEN
    PERFORM private.cleaner_open_review('unclassified_assignee', 'person:unclassified:'||_person, NULL, _person, NULL, NULL,
      NULL, jsonb_build_object('name', a.last_seen_name, 'classification', a.classification), _fixture);
    SELECT count(*) INTO others FROM cleaner_breezeway_accounts o
     WHERE o.breezeway_person_id <> _person
       AND lower(regexp_replace(btrim(coalesce(o.last_seen_name,'')), '\s+', ' ', 'g'))
         = lower(regexp_replace(btrim(coalesce(a.last_seen_name,'')), '\s+', ' ', 'g'))
       AND coalesce(a.last_seen_name,'') <> '';
    IF others > 0 THEN
      PERFORM private.cleaner_open_review('possible_duplicate_identity', 'person:dup:'||_person, NULL, _person, NULL, NULL,
        NULL, jsonb_build_object('name', a.last_seen_name, 'same_name_accounts', others), _fixture);
    ELSE
      PERFORM private.cleaner_close_review('person:dup:'||_person, 'No other account shares this name');
    END IF;
  ELSE
    PERFORM private.cleaner_close_review('person:unclassified:'||_person, 'Classified as '||a.classification);
    PERFORM private.cleaner_close_review('person:dup:'||_person, 'Classified as '||a.classification);
  END IF;
END $$;

-- The one normalization rule. Webhook, nightly reconcile, backfill and
-- reclassification all come through here, from the latest stored snapshot.
CREATE OR REPLACE FUNCTION private.cleaner_recompute_task(_task bigint)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  s record; a record; acct record; cur record; person_ids bigint[] := '{}';
  secs int; invalid boolean; short boolean; long boolean; finished boolean;
  comp_date date; n_ind int; n_comp int; key text;
  d_method text; d_minutes numeric; d_counted boolean; d_state text; d_conf text; d_worker uuid;
  inserted int := 0; unchanged int := 0; voided int := 0;
BEGIN
  SELECT * INTO s FROM cleaner_task_snapshots WHERE breezeway_task_id=_task ORDER BY synced_at DESC, id DESC LIMIT 1;
  IF s IS NULL THEN RETURN jsonb_build_object('skipped','no snapshot'); END IF;

  finished := coalesce(s.department,'') = 'housekeeping' AND coalesce(s.status_stage,'') = 'finished' AND s.finished_at IS NOT NULL;
  secs := s.elapsed_seconds;
  invalid := secs IS NULL OR secs <= 0;
  short := NOT invalid AND secs < 600;
  long := NOT invalid AND secs > 28800;
  comp_date := (s.finished_at AT TIME ZONE 'America/Chicago')::date;

  -- Register every assignee account seen on the Task (identity by Breezeway ID, never by name).
  FOR a IN SELECT DISTINCT ON ((x->>'assignee_id')::bigint) (x->>'assignee_id')::bigint AS pid, nullif(btrim(x->>'name'),'') AS nm
             FROM jsonb_array_elements(s.assignees) x WHERE (x->>'assignee_id') ~ '^\d+$' LOOP
    INSERT INTO cleaner_breezeway_accounts(breezeway_person_id, last_seen_name, first_seen_at, last_seen_at)
    VALUES (a.pid, a.nm, now(), now())
    ON CONFLICT (breezeway_person_id) DO UPDATE SET last_seen_name = coalesce(EXCLUDED.last_seen_name, cleaner_breezeway_accounts.last_seen_name),
      last_seen_at = now(), updated_at = now();
    person_ids := person_ids || a.pid;
    PERFORM private.cleaner_person_reviews(a.pid, s.is_fixture);
  END LOOP;

  -- Unmatched property: keep the source, never guess a property, no exposure.
  IF s.property_id IS NULL THEN
    IF finished THEN
      PERFORM private.cleaner_open_review('unmatched_property', 'task:unmatched:'||_task, _task, NULL, s.breezeway_home_id, NULL,
        s.source_updated_at, jsonb_build_object('task', s.task_name, 'home_id', s.breezeway_home_id, 'completed', comp_date), s.is_fixture);
    END IF;
    FOR cur IN SELECT * FROM cleaner_exposure_ledger WHERE breezeway_task_id=_task AND superseded_at IS NULL AND attribution_method <> 'manual_correction' AND entry_key LIKE 'bz:%' LOOP
      UPDATE cleaner_exposure_ledger SET superseded_at=now(), superseded_reason='Breezeway home is no longer matched to a Resolve property' WHERE id=cur.id;
      voided := voided + 1;
    END LOOP;
    RETURN jsonb_build_object('unmatched', true, 'voided', voided);
  END IF;
  PERFORM private.cleaner_close_review('task:unmatched:'||_task, 'Property matched');

  IF NOT finished THEN
    FOR cur IN SELECT * FROM cleaner_exposure_ledger WHERE breezeway_task_id=_task AND superseded_at IS NULL AND entry_key LIKE 'bz:%' LOOP
      IF cur.attribution_method = 'manual_correction' THEN
        PERFORM private.cleaner_open_review('source_changed_after_correction', 'task:corr:'||_task||':'||coalesce(cur.breezeway_person_id::text,''),
          _task, cur.breezeway_person_id, s.breezeway_home_id, s.property_id, s.source_updated_at,
          jsonb_build_object('change','Task is no longer finished in Breezeway','status', s.status_code), s.is_fixture);
      ELSE
        UPDATE cleaner_exposure_ledger SET superseded_at=now(), superseded_reason='Task is no longer finished in Breezeway ('||coalesce(s.status_code,'unknown')||')' WHERE id=cur.id;
        voided := voided + 1;
      END IF;
    END LOOP;
    PERFORM private.cleaner_close_review('task:dur:'||_task, 'Task not finished');
    PERFORM private.cleaner_close_review('task:company:'||_task, 'Task not finished');
    RETURN jsonb_build_object('finished', false, 'voided', voided);
  END IF;

  SELECT count(*) FILTER (WHERE coalesce(c.classification,'unclassified') <> 'company'),
         count(*) FILTER (WHERE c.classification = 'company')
    INTO n_ind, n_comp
    FROM unnest(person_ids) p(pid) LEFT JOIN cleaner_breezeway_accounts c ON c.breezeway_person_id = p.pid;

  FOR acct IN SELECT c.* FROM unnest(person_ids) p(pid) JOIN cleaner_breezeway_accounts c ON c.breezeway_person_id=p.pid LOOP
    key := 'bz:'||_task||':'||acct.breezeway_person_id;
    d_worker := acct.worker_id;
    IF acct.classification = 'company' THEN
      IF n_ind > 0 THEN
        d_method := 'company_account_not_counted'; d_minutes := NULL; d_counted := false; d_state := 'not_counted'; d_conf := 'low';
      ELSE
        d_method := 'company_only_needs_review'; d_minutes := CASE WHEN invalid THEN NULL ELSE round(secs/60.0, 2) END;
        d_counted := NOT invalid; d_state := 'needs_review'; d_conf := 'low';
      END IF;
    ELSIF invalid THEN
      d_method := 'invalid_duration_needs_review'; d_minutes := NULL; d_counted := false; d_state := 'needs_review'; d_conf := 'low';
    ELSE
      d_method := CASE WHEN n_ind = 1 THEN 'single_individual_assignee' ELSE 'multi_assignee_full_elapsed' END;
      d_minutes := round(secs/60.0, 2); d_counted := true;
      IF acct.classification IN ('individual','duplicate') AND NOT short AND NOT long THEN
        d_state := 'auto'; d_conf := CASE WHEN n_ind = 1 THEN 'high' ELSE 'medium' END;
      ELSE
        d_state := 'needs_review'; d_conf := 'low';
      END IF;
    END IF;

    SELECT * INTO cur FROM cleaner_exposure_ledger WHERE entry_key=key AND superseded_at IS NULL;
    IF cur.id IS NOT NULL AND cur.attribution_method = 'manual_correction' THEN
      IF cur.source_revision IS DISTINCT FROM s.source_updated_at
         AND (cur.raw_elapsed_seconds IS DISTINCT FROM secs OR cur.property_id IS DISTINCT FROM s.property_id OR cur.completion_date IS DISTINCT FROM comp_date) THEN
        PERFORM private.cleaner_open_review('source_changed_after_correction', 'task:corr:'||_task||':'||acct.breezeway_person_id,
          _task, acct.breezeway_person_id, s.breezeway_home_id, s.property_id, s.source_updated_at,
          jsonb_build_object('corrected_minutes', cur.attributed_minutes, 'new_elapsed_seconds', secs), s.is_fixture);
      END IF;
      unchanged := unchanged + 1;
      CONTINUE;
    END IF;
    IF cur.id IS NOT NULL
       AND cur.worker_id IS NOT DISTINCT FROM d_worker AND cur.property_id IS NOT DISTINCT FROM s.property_id
       AND cur.completion_date = comp_date AND cur.raw_elapsed_seconds IS NOT DISTINCT FROM secs
       AND cur.attributed_minutes IS NOT DISTINCT FROM d_minutes AND cur.attribution_method = d_method
       AND cur.review_state = d_state AND cur.counted = d_counted AND cur.confidence = d_conf
       AND cur.assignee_count IS NOT DISTINCT FROM cardinality(person_ids)
       AND cur.breezeway_person_name IS NOT DISTINCT FROM acct.last_seen_name THEN
      unchanged := unchanged + 1;
      CONTINUE;
    END IF;
    IF cur.id IS NOT NULL THEN
      UPDATE cleaner_exposure_ledger SET superseded_at=now(), superseded_reason='Recalculated from Breezeway revision '||coalesce(s.source_updated_at::text,'unknown') WHERE id=cur.id;
    END IF;
    INSERT INTO cleaner_exposure_ledger(entry_key, worker_id, breezeway_person_id, breezeway_person_name, property_id,
      completion_date, breezeway_task_id, assignee_count, raw_elapsed_seconds, attributed_minutes, attribution_method,
      counted, review_state, confidence, snapshot_id, source_revision, supersedes_id, is_fixture)
    VALUES (key, d_worker, acct.breezeway_person_id, acct.last_seen_name, s.property_id, comp_date, _task,
      cardinality(person_ids), secs, d_minutes, d_method, d_counted, d_state, d_conf, s.id, s.source_updated_at, cur.id, s.is_fixture);
    inserted := inserted + 1;
  END LOOP;

  -- Assignees removed in Breezeway.
  FOR cur IN SELECT * FROM cleaner_exposure_ledger WHERE breezeway_task_id=_task AND superseded_at IS NULL AND entry_key LIKE 'bz:%'
               AND NOT (breezeway_person_id = ANY(person_ids)) LOOP
    IF cur.attribution_method = 'manual_correction' THEN
      PERFORM private.cleaner_open_review('source_changed_after_correction', 'task:corr:'||_task||':'||cur.breezeway_person_id,
        _task, cur.breezeway_person_id, s.breezeway_home_id, s.property_id, s.source_updated_at,
        jsonb_build_object('change','Assignee removed in Breezeway'), s.is_fixture);
    ELSE
      UPDATE cleaner_exposure_ledger SET superseded_at=now(), superseded_reason='Assignee removed from the Task in Breezeway' WHERE id=cur.id;
      voided := voided + 1;
    END IF;
  END LOOP;

  -- Task-level review items.
  IF invalid OR short OR long THEN
    PERFORM private.cleaner_open_review(CASE WHEN invalid THEN 'zero_duration' WHEN short THEN 'short_duration' ELSE 'long_duration' END,
      'task:dur:'||_task, _task, NULL, s.breezeway_home_id, s.property_id, s.source_updated_at,
      jsonb_build_object('task', s.task_name, 'total_time', s.total_time, 'elapsed_seconds', secs, 'completed', comp_date), s.is_fixture);
  ELSE
    PERFORM private.cleaner_close_review('task:dur:'||_task, 'Elapsed time now within 10 minutes – 8 hours');
  END IF;
  IF n_comp > 0 AND n_ind = 0 THEN
    PERFORM private.cleaner_open_review('company_only', 'task:company:'||_task, _task, NULL, s.breezeway_home_id, s.property_id,
      s.source_updated_at, jsonb_build_object('task', s.task_name, 'completed', comp_date), s.is_fixture);
  ELSE
    PERFORM private.cleaner_close_review('task:company:'||_task, 'Individual cleaner now identified on the Task');
  END IF;

  RETURN jsonb_build_object('inserted', inserted, 'unchanged', unchanged, 'voided', voided);
END $$;

-- Server-only entry point (service role): store a snapshot if the source changed, then recompute.
CREATE OR REPLACE FUNCTION public.cleaner_ingest_task(_payload jsonb, _property_id uuid, _source text, _fixture boolean DEFAULT false)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE task bigint; h text; latest record; snap uuid; created boolean := false; fin jsonb; res jsonb;
BEGIN
  task := (_payload->>'id')::bigint;
  IF task IS NULL THEN RAISE EXCEPTION 'Task payload has no id'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('cleaner_task:'||task, 0));
  h := md5(_payload::text || '|' || coalesce(_property_id::text,''));
  SELECT id, payload_hash INTO latest FROM cleaner_task_snapshots WHERE breezeway_task_id=task ORDER BY synced_at DESC, id DESC LIMIT 1;
  IF latest.id IS NULL OR latest.payload_hash <> h THEN
    fin := _payload->'finished_by';
    INSERT INTO cleaner_task_snapshots(breezeway_task_id, breezeway_home_id, property_id, status_code, status_stage, department,
      template_id, task_name, scheduled_date, started_at, finished_at, total_time, elapsed_seconds, finished_by_id, finished_by_name,
      assignees, linked_reservation, source_updated_at, payload, payload_hash, source, is_fixture)
    VALUES (task, nullif(_payload->>'home_id','')::bigint, _property_id, _payload#>>'{type_task_status,code}', _payload#>>'{type_task_status,stage}',
      _payload->>'type_department', nullif(_payload->>'template_id','')::bigint, _payload->>'name', nullif(_payload->>'scheduled_date','')::date,
      CASE WHEN nullif(_payload->>'started_at','') IS NULL THEN NULL ELSE (_payload->>'started_at')::timestamp AT TIME ZONE 'UTC' END,
      CASE WHEN nullif(_payload->>'finished_at','') IS NULL THEN NULL ELSE (_payload->>'finished_at')::timestamp AT TIME ZONE 'UTC' END,
      _payload->>'total_time', private.cleaner_parse_elapsed(_payload->>'total_time'),
      CASE WHEN jsonb_typeof(fin)='object' THEN nullif(fin->>'id','')::bigint END,
      CASE WHEN jsonb_typeof(fin)='object' THEN fin->>'name' END,
      coalesce(CASE WHEN jsonb_typeof(_payload->'assignments')='array' THEN _payload->'assignments' END, '[]'::jsonb),
      CASE WHEN jsonb_typeof(_payload->'linked_reservation')='object' THEN _payload->'linked_reservation' END,
      nullif(_payload->>'updated_at','')::timestamptz, _payload, h, _source, _fixture)
    RETURNING id INTO snap;
    created := true;
  ELSE
    snap := latest.id;
  END IF;
  INSERT INTO cleaner_task_state(breezeway_task_id, latest_snapshot_id, property_id, last_synced_at, last_source, is_fixture)
  VALUES (task, snap, _property_id, now(), _source, _fixture)
  ON CONFLICT (breezeway_task_id) DO UPDATE SET latest_snapshot_id=EXCLUDED.latest_snapshot_id, property_id=EXCLUDED.property_id,
    last_synced_at=now(), last_source=EXCLUDED.last_source;
  res := private.cleaner_recompute_task(task);
  RETURN jsonb_build_object('task', task, 'snapshot_created', created) || res;
END $$;
REVOKE ALL ON FUNCTION public.cleaner_ingest_task(jsonb, uuid, text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleaner_ingest_task(jsonb, uuid, text, boolean) TO service_role;

-- Staff actions (admin/manager) -----------------------------------------
CREATE OR REPLACE FUNCTION private.cleaner_actor_name(_uid uuid) RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT coalesce((SELECT full_name FROM profiles WHERE id=_uid), 'ARHA staff');
$$;

CREATE OR REPLACE FUNCTION public.classify_cleaner_account(_person bigint, _classification text, _worker_id uuid DEFAULT NULL,
  _new_worker_name text DEFAULT NULL, _note text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE a record; w record; target uuid; t bigint; n int := 0;
BEGIN
  IF NOT public.is_supervisor(auth.uid()) THEN RAISE EXCEPTION 'Only Operations leadership can classify cleaner accounts.'; END IF;
  IF _classification NOT IN ('unclassified','individual','company','duplicate','unknown') THEN RAISE EXCEPTION 'Unknown classification.'; END IF;
  SELECT * INTO a FROM cleaner_breezeway_accounts WHERE breezeway_person_id=_person FOR UPDATE;
  IF a IS NULL THEN RAISE EXCEPTION 'This Breezeway account has not been seen on a cleaning Task.'; END IF;
  IF _classification = 'duplicate' THEN
    IF _worker_id IS NULL THEN RAISE EXCEPTION 'Choose the existing worker this account duplicates.'; END IF;
    IF length(btrim(coalesce(_note,''))) < 5 THEN RAISE EXCEPTION 'Explain how you confirmed these accounts are the same person.'; END IF;
  END IF;
  IF _classification IN ('individual','company','duplicate') THEN
    IF _worker_id IS NOT NULL THEN
      SELECT * INTO w FROM cleaner_workers WHERE id=_worker_id;
      IF w IS NULL THEN RAISE EXCEPTION 'Worker not found.'; END IF;
      IF _classification <> 'duplicate' AND w.account_type <> _classification THEN RAISE EXCEPTION 'That worker is a different account type.'; END IF;
      target := w.id;
    ELSE
      INSERT INTO cleaner_workers(display_name, account_type, created_by, updated_by)
      VALUES (coalesce(nullif(btrim(_new_worker_name),''), a.last_seen_name, 'Breezeway #'||_person), _classification, auth.uid(), auth.uid())
      RETURNING id INTO target;
    END IF;
  END IF;
  INSERT INTO cleaner_account_events(breezeway_person_id, from_classification, to_classification, from_worker_id, to_worker_id, note, actor_id, actor_name)
  VALUES (_person, a.classification, _classification, a.worker_id, target, nullif(btrim(_note),''), auth.uid(), private.cleaner_actor_name(auth.uid()));
  UPDATE cleaner_breezeway_accounts SET classification=_classification, worker_id=target, classification_note=nullif(btrim(_note),''),
    classified_by=auth.uid(), classified_at=now(), updated_at=now() WHERE breezeway_person_id=_person;
  PERFORM private.cleaner_person_reviews(_person, false);
  FOR t IN SELECT DISTINCT breezeway_task_id FROM cleaner_task_snapshots
            WHERE assignees @> jsonb_build_array(jsonb_build_object('assignee_id', _person)) LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('cleaner_task:'||t, 0));
    PERFORM private.cleaner_recompute_task(t);
    n := n + 1;
  END LOOP;
  RETURN jsonb_build_object('worker_id', target, 'tasks_recalculated', n);
END $$;

CREATE OR REPLACE FUNCTION public.correct_cleaner_exposure(_entry uuid, _minutes numeric, _worker_id uuid, _reason text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE e record; w record; nid uuid;
BEGIN
  IF NOT public.is_supervisor(auth.uid()) THEN RAISE EXCEPTION 'Only Operations leadership can correct cleaner time.'; END IF;
  IF length(btrim(coalesce(_reason,''))) < 5 THEN RAISE EXCEPTION 'A reason is required for every correction.'; END IF;
  IF _minutes IS NULL OR _minutes < 0 OR _minutes > 1440 THEN RAISE EXCEPTION 'Corrected minutes must be between 0 and 1,440.'; END IF;
  SELECT * INTO e FROM cleaner_exposure_ledger WHERE id=_entry AND superseded_at IS NULL FOR UPDATE;
  IF e IS NULL THEN RAISE EXCEPTION 'This entry is no longer current. Refresh and try again.'; END IF;
  IF _worker_id IS NOT NULL THEN
    SELECT * INTO w FROM cleaner_workers WHERE id=_worker_id;
    IF w IS NULL OR w.account_type <> 'individual' THEN RAISE EXCEPTION 'Choose an individual cleaner.'; END IF;
  END IF;
  UPDATE cleaner_exposure_ledger SET superseded_at=now(), superseded_reason='Manually corrected: '||btrim(_reason) WHERE id=e.id;
  INSERT INTO cleaner_exposure_ledger(entry_key, worker_id, breezeway_person_id, breezeway_person_name, property_id, completion_date,
    breezeway_task_id, assignee_count, raw_elapsed_seconds, attributed_minutes, original_minutes, attribution_method, counted,
    review_state, confidence, snapshot_id, source_revision, supersedes_id, reason, author_id, author_name, is_fixture)
  VALUES (e.entry_key, coalesce(_worker_id, e.worker_id), e.breezeway_person_id, e.breezeway_person_name, e.property_id, e.completion_date,
    e.breezeway_task_id, e.assignee_count, e.raw_elapsed_seconds, round(_minutes, 2), e.attributed_minutes, 'manual_correction', true,
    'reviewed', 'high', e.snapshot_id, e.source_revision, e.id, btrim(_reason), auth.uid(), private.cleaner_actor_name(auth.uid()), e.is_fixture)
  RETURNING id INTO nid;
  RETURN nid;
END $$;

CREATE OR REPLACE FUNCTION public.add_manual_cleaner_clean(_worker_id uuid, _property_id uuid, _date date, _minutes numeric, _reason text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE w record; nid uuid := gen_random_uuid();
BEGIN
  IF NOT public.is_supervisor(auth.uid()) THEN RAISE EXCEPTION 'Only Operations leadership can add cleaner time.'; END IF;
  IF length(btrim(coalesce(_reason,''))) < 5 THEN RAISE EXCEPTION 'Explain where this clean is documented.'; END IF;
  IF _minutes IS NULL OR _minutes <= 0 OR _minutes > 1440 THEN RAISE EXCEPTION 'Minutes must be between 1 and 1,440.'; END IF;
  IF _date IS NULL OR _date > (now() AT TIME ZONE 'America/Chicago')::date THEN RAISE EXCEPTION 'The clean date cannot be in the future.'; END IF;
  SELECT * INTO w FROM cleaner_workers WHERE id=_worker_id;
  IF w IS NULL OR w.account_type <> 'individual' THEN RAISE EXCEPTION 'Choose an individual cleaner.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM properties WHERE id=_property_id) THEN RAISE EXCEPTION 'Property not found.'; END IF;
  INSERT INTO cleaner_exposure_ledger(id, entry_key, worker_id, property_id, completion_date, attributed_minutes, attribution_method,
    counted, review_state, confidence, reason, author_id, author_name)
  VALUES (nid, 'manual:'||nid, _worker_id, _property_id, _date, round(_minutes,2), 'manual_entry', true, 'needs_review', 'medium',
    btrim(_reason), auth.uid(), private.cleaner_actor_name(auth.uid()));
  PERFORM private.cleaner_open_review('manual_entry', 'manual:'||nid, NULL, NULL, NULL, _property_id, NULL,
    jsonb_build_object('worker', w.display_name, 'minutes', _minutes, 'date', _date, 'reason', btrim(_reason)), false);
  UPDATE cleaner_review_items SET ledger_entry_id = nid WHERE dedupe_key='manual:'||nid AND status='open';
  RETURN nid;
END $$;

CREATE OR REPLACE FUNCTION public.resolve_cleaner_review(_id uuid, _status text, _note text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.is_supervisor(auth.uid()) THEN RAISE EXCEPTION 'Only Operations leadership can close review items.'; END IF;
  IF _status NOT IN ('resolved','dismissed') THEN RAISE EXCEPTION 'Unknown status.'; END IF;
  IF length(btrim(coalesce(_note,''))) < 5 THEN RAISE EXCEPTION 'Add a note explaining the decision.'; END IF;
  UPDATE cleaner_review_items SET status=_status, resolved_at=now(), resolved_by=auth.uid(),
    resolved_by_name=private.cleaner_actor_name(auth.uid()), resolution_note=btrim(_note)
   WHERE id=_id AND status='open';
  IF NOT FOUND THEN RAISE EXCEPTION 'This review item is already closed.'; END IF;
END $$;

REVOKE ALL ON FUNCTION public.classify_cleaner_account(bigint, text, uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.correct_cleaner_exposure(uuid, numeric, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_manual_cleaner_clean(uuid, uuid, date, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_cleaner_review(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.classify_cleaner_account(bigint, text, uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.correct_cleaner_exposure(uuid, numeric, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_manual_cleaner_clean(uuid, uuid, date, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_cleaner_review(uuid, text, text) TO authenticated;

-- Monitoring views (caller's permissions apply) ----------------------------
CREATE VIEW public.cleaner_exposure_summary WITH (security_invoker = true) AS
SELECT extract(year FROM l.completion_date)::int AS year,
       l.property_id,
       l.worker_id,
       CASE WHEN l.worker_id IS NULL THEN l.breezeway_person_id END AS unlinked_person_id,
       coalesce(w.display_name, l.breezeway_person_name, 'Unidentified') AS worker_name,
       coalesce(w.account_type, 'unclassified') AS worker_type,
       sum(l.attributed_minutes) FILTER (WHERE l.counted) AS attributed_minutes,
       count(DISTINCT coalesce(l.breezeway_task_id::text, l.entry_key)) AS cleans,
       count(*) FILTER (WHERE l.review_state IN ('auto','reviewed')) AS reviewed_entries,
       count(*) FILTER (WHERE l.review_state = 'needs_review') AS unreviewed_entries,
       count(*) FILTER (WHERE l.attributed_minutes IS NULL AND l.review_state <> 'not_counted') AS unknown_time_entries,
       max(l.completion_date) AS last_clean,
       CASE WHEN bool_or(l.confidence='low') THEN 'low' WHEN bool_or(l.confidence='medium') THEN 'medium' ELSE 'high' END AS lowest_confidence
  FROM public.cleaner_exposure_ledger l
  LEFT JOIN public.cleaner_workers w ON w.id = l.worker_id
 WHERE l.superseded_at IS NULL AND NOT l.is_fixture AND l.review_state <> 'not_counted'
 GROUP BY 1, 2, 3, 4, 5, 6;
GRANT SELECT ON public.cleaner_exposure_summary TO authenticated;

-- Existing owner hours, read-only, same counting rule as Active Owner (a correction replaces the entry it amends).
CREATE VIEW public.cleaner_owner_hours_by_property WITH (security_invoker = true) AS
SELECT extract(year FROM e.entry_date)::int AS year, ep.property_id, sum(e.minutes) AS owner_minutes, count(*) AS entries
  FROM public.owner_time_entries e
  JOIN public.owner_time_entry_properties ep ON ep.entry_id = e.id
 WHERE NOT e.is_demo
   AND NOT EXISTS (SELECT 1 FROM public.owner_time_entries x WHERE x.amends_entry_id = e.id)
 GROUP BY 1, 2;
GRANT SELECT ON public.cleaner_owner_hours_by_property TO authenticated;