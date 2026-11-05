-- STAGED ONLY. Run as the approved Admin/Operations Director caller, never service identity.
DO $$
DECLARE old public.playbooks; body jsonb; step_index integer; new_id uuid;
BEGIN
  SELECT * INTO old FROM public.playbooks
    WHERE id='a998f212-8b1c-4905-984b-482c2815cd82' AND checklist_category='cleaning' AND status='approved' FOR UPDATE;
  IF NOT FOUND OR old.version<>1 OR md5(old.checklist::text)<>'a54db86e7ac93640746fe90e7464d563' THEN
    RAISE EXCEPTION 'Cleaning checklist changed. Stop and repeat the precheck.';
  END IF;
  SELECT ordinality::integer-1 INTO step_index FROM jsonb_array_elements(old.checklist->'steps') WITH ORDINALITY
    WHERE value->>'key'='repeat';
  IF step_index IS NULL THEN RAISE EXCEPTION 'Cleaning repeat step missing.'; END IF;
  body := jsonb_set(old.checklist, ARRAY['steps',step_index::text,'question'],
    to_jsonb('Repeat complaint within the past {repeat_window_days} days for the same cleaner? If so, flag the cleaning team lead.'::text));
  body := jsonb_set(body, ARRAY['steps',step_index::text,'help'], to_jsonb('Check earlier complaints for this cleaner. This is a manual review.'::text));
  body := jsonb_set(body, '{settings}', coalesce(body->'settings','[]'::jsonb)||
    '[{"key":"repeat_window_days","label":"Repeat complaint window (days)","value":"60"}]'::jsonb);
  new_id := public.publish_ticket_checklist('cleaning',old.title,body,old.sop_url,
    'Emily approved: same-cleaner repeat complaints within 60 days.');
  RAISE NOTICE 'Published cleaning version 2: %', new_id;
END $$;