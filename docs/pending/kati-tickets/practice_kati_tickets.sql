-- Practice for Build 15 on the real database, cancelled on purpose at the end (nothing kept).
-- Runs as the Director of Onboarding's own account on 624 Daniel Court. Ran Nov 10 after 0330.
DO $$
DECLARE
  _kati uuid := '40de2f41-5596-4ec1-98d7-29e16549a25f';
  _home uuid := '2ac3120b-cec9-4735-b4b6-c130bdab63fd';
  _five uuid[] := ARRAY['c1216e61-df1f-42cf-b65d-b9408d40607c','4da28d33-c68b-4fe9-bb8d-cbd682c048ad',
    'ffa7a517-21db-4c87-82a7-1cff768f6848','f2ff0fed-f581-4319-9ff6-df88310e47a8','74b42905-245a-4dcd-ab3a-9f6f2e24ec83']::uuid[];
  _mood uuid := '37be0cf9-0ae0-4f4f-be0e-02a17dc0cbee';
  _keys uuid := '2a331c17-9668-4b65-99d1-edfef81e133d';
  _owner uuid := (SELECT owner_user_id FROM public.owner_programs WHERE id = '2d05252c-dd0d-4473-adf8-b979fc5b5216');
  _mirror bigint := (SELECT breezeway_task_id FROM public.breezeway_work_orders ORDER BY last_synced_at DESC NULLS LAST LIMIT 1);
  _person bigint := (SELECT breezeway_person_id FROM public.breezeway_people WHERE active AND NOT is_integration_identity ORDER BY first_name LIMIT 1);
  _out jsonb := '{}'::jsonb; _r jsonb; _id uuid;
BEGIN
  PERFORM set_config('request.jwt.claims', json_build_object('sub', _kati, 'role', 'authenticated')::text, true);
  EXECUTE 'SET LOCAL ROLE authenticated';
  _r := public.bulk_complete_onboarding_tasks(_home, _five || _mood, 'Signed copies are in the SharePoint home folder', NULL, NULL, true);
  _out := _out || jsonb_build_object('dry_ready', jsonb_array_length(_r->'ready'), 'dry_held', _r->'held');
  BEGIN PERFORM public.bulk_complete_onboarding_tasks(_home, _five, 'done', NULL, NULL, false);
  EXCEPTION WHEN OTHERS THEN _out := _out || jsonb_build_object('short_note', SQLERRM); END;
  _r := public.bulk_complete_onboarding_tasks(_home, _five, 'Signed copies are in the SharePoint home folder', '2026-11-02', NULL, false);
  _out := _out || jsonb_build_object('completed', _r->'completed',
    'rows', (SELECT jsonb_agg(jsonb_build_object('status', status, 'by', completed_by = _kati,
              'day', (completed_at AT TIME ZONE 'America/Chicago')::date, 'note', evidence_note)) FROM public.onboarding_tasks WHERE id = ANY(_five)));
  EXECUTE 'RESET ROLE';
  _out := _out || jsonb_build_object('audit', (SELECT count(*) FROM public.audit_log WHERE action = 'onboarding_task_bulk_completed' AND entity_id = ANY(_five)));
  EXECUTE 'SET LOCAL ROLE authenticated';
  _id := public.prepare_onboarding_task_approval(_mood, _home, 'Mood boards v1');
  UPDATE public.approvals SET approver_id = _owner WHERE id = _id AND status = 'pending';
  _out := _out || jsonb_build_object('approval', (SELECT jsonb_build_object('status', a.status, 'routed_to_owner', a.approver_id = _owner,
            'task_status', t.owner_approval_status) FROM public.approvals a JOIN public.onboarding_tasks t ON t.id = a.entity_id WHERE a.id = _id));
  INSERT INTO public.onboarding_tasks(property_id, stage, title, assigned_seat, due_on, requires_owner_approval,
    owner_approval_status, evidence_required, status, blocks_handoff, created_by, is_demo)
  VALUES (_home, 'Pre-Close', 'Share the floor plans with the owner', 'lead_designer', '2026-11-12', true, 'pending', false, 'open', false, _kati, false)
  RETURNING id INTO _id;
  _out := _out || jsonb_build_object('added_task', (SELECT jsonb_build_object('seat', assigned_seat, 'approval', owner_approval_status,
            'approvals', (SELECT count(*) FROM public.approvals WHERE entity_id = _id)) FROM public.onboarding_tasks WHERE id = _id));
  _r := public.save_onboarding_task_breezeway(_keys, '2026-11-12', 'unassigned', NULL, '');
  _out := _out || jsonb_build_object('bz_unassigned', _r->>'assignee_choice');
  _r := public.save_onboarding_task_breezeway(_keys, '2026-11-12', 'person', _person, 'https://app.breezeway.io/task/' || _mirror);
  _out := _out || jsonb_build_object('bz_person', _r->>'assignee_name' IS NOT NULL, 'bz_task', (_r->>'breezeway_task_id')::bigint = _mirror,
    'bz_mirror_found', EXISTS (SELECT 1 FROM public.breezeway_work_orders WHERE breezeway_task_id = (_r->>'breezeway_task_id')::bigint),
    'bz_history', (SELECT count(*) FROM public.onboarding_task_breezeway_events WHERE task_id = _keys),
    'switch', (SELECT enabled FROM public.feature_flags WHERE key = 'onboarding_breezeway_send'));
  BEGIN PERFORM public.save_onboarding_task_breezeway(_mood, NULL, NULL, NULL, '123');
  EXCEPTION WHEN OTHERS THEN _out := _out || jsonb_build_object('bz_not_work_order', SQLERRM); END;
  EXECUTE 'RESET ROLE';
  RAISE EXCEPTION 'PRACTICE CANCELLED %', _out::text;
END $$;
