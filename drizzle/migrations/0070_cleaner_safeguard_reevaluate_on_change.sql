-- Any change to active attributed cleaner time (correction, provisional review,
-- off-Breezeway approval, worker reassignment, supersede) re-evaluates the
-- safeguard immediately. Alerts only on newly entering Warning / Restricted /
-- Hard Block / inversion; lowering closes the stale state item (audit trail)
-- without alerting.
CREATE OR REPLACE FUNCTION private.cleaner_safeguard_thresholds(_property uuid, _fixture boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d date := (now() AT TIME ZONE 'America/Chicago')::date; y int := extract(year FROM (now() AT TIME ZONE 'America/Chicago'))::int;
  w uuid; ev jsonb; st text; key text; rid uuid; nm text; pname text; it record; cur_key text;
BEGIN
  IF private.cleaner_tracking_from(_property) IS NULL THEN RETURN; END IF;
  SELECT name INTO pname FROM properties WHERE id=_property;

  -- 1. Close open state items that no longer match the recalculated state.
  FOR it IN SELECT * FROM cleaner_review_items WHERE kind='threshold_reached' AND status='open' AND property_id=_property
              AND dedupe_key LIKE 'thr:'||_property||':%:'||y||':%' LOOP
    w := nullif(it.detail->>'worker_id','')::uuid;
    IF w IS NULL THEN CONTINUE; END IF;
    ev := private.cleaner_safeguard_eval(_property, w, d, 0);
    st := ev->>'state';
    cur_key := CASE WHEN st IN ('warning','restricted','hard_block') OR (ev->>'inversion')::boolean
      THEN 'thr:'||_property||':'||w||':'||y||':'||CASE WHEN (ev->>'inversion')::boolean AND st <> 'hard_block' THEN 'inversion' ELSE st END END;
    IF cur_key IS DISTINCT FROM it.dedupe_key THEN
      UPDATE cleaner_review_items SET status='resolved', resolved_at=now(),
        resolution_note='Recalculated: now '||replace(initcap(st),'_',' ')||' at '||(ev->>'current_hours')||' h Attributed Cleaner Time'
          ||CASE WHEN (ev->>'inversion')::boolean THEN ' (inversion)' ELSE '' END,
        detail = it.detail || jsonb_build_object('transition_to', st, 'transition_hours', ev->>'current_hours', 'transition_at', now())
       WHERE id=it.id;
    END IF;
  END LOOP;

  -- 2. Open (and alert on) newly entered states.
  FOR w IN SELECT DISTINCT l.worker_id FROM cleaner_exposure_ledger l JOIN cleaner_workers cw ON cw.id=l.worker_id AND cw.account_type='individual'
            WHERE l.property_id=_property AND l.superseded_at IS NULL AND extract(year FROM l.completion_date)::int = y LOOP
    ev := private.cleaner_safeguard_eval(_property, w, d, 0);
    st := ev->>'state'; nm := ev->>'worker_name';
    IF st IN ('warning','restricted','hard_block') OR (ev->>'inversion')::boolean THEN
      key := 'thr:'||_property||':'||w||':'||y||':'||CASE WHEN (ev->>'inversion')::boolean AND st <> 'hard_block' THEN 'inversion' ELSE st END;
      rid := NULL;
      INSERT INTO cleaner_review_items(kind, dedupe_key, property_id, detail, is_fixture)
      VALUES ('threshold_reached', key, _property, ev || jsonb_build_object('worker_id', w), _fixture)
      ON CONFLICT (dedupe_key) WHERE status='open' DO NOTHING RETURNING id INTO rid;
      IF rid IS NOT NULL THEN
        IF st = 'warning' AND NOT (ev->>'inversion')::boolean THEN
          PERFORM private.cleaner_alert('pc', 'Cleaner in Warning at '||coalesce(pname,'an STR home'),
            nm||' has '||(ev->>'current_hours')||' h Attributed Cleaner Time here. Consider rotating cleaner before the next clean.', 'high', rid, NULL, _fixture);
        ELSE
          PERFORM private.cleaner_alert('leadership',
            CASE WHEN (ev->>'inversion')::boolean AND st <> 'hard_block' THEN 'Hours inversion at ' ELSE replace(initcap(st),'_',' ')||' state at ' END||coalesce(pname,'an STR home'),
            nm||': '||(ev->>'current_hours')||' h Attributed Cleaner Time; owner hours '||(ev->>'owner_hours')||' h. Leadership review required.', 'urgent', rid, NULL, _fixture);
        END IF;
      END IF;
    END IF;
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION private.cleaner_ledger_reevaluate()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.property_id IS NOT NULL THEN
    PERFORM private.cleaner_safeguard_thresholds(NEW.property_id, NEW.is_fixture);
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS cleaner_ledger_reevaluate ON public.cleaner_exposure_ledger;
CREATE TRIGGER cleaner_ledger_reevaluate AFTER INSERT OR UPDATE OF superseded_at ON public.cleaner_exposure_ledger
  FOR EACH ROW EXECUTE FUNCTION private.cleaner_ledger_reevaluate();