-- Handoff never blocks, part 2: clear the required and blocking marks (Emily, Nov 7, 2026;
-- register O4; punch list H4). Data step: applied with the data tool, not as a migration.
-- Undo: 03_undo_clear_handoff_flags.sql. Needs 02 first. Stops with no change on any surprise.
--
-- 1. Saves the exact before values of every row it changes in onboarding_flag_snapshots.
-- 2. Standard plan (ARHA Onboarding - Standard): the 25 steps in Preparing for Handoff (18) and
--    Handoff (7) lose Required and Blocks handoff. Every other step and flag is untouched.
-- 3. Home Tasks: every Task marked Blocks handoff that is not completed (1,490 of the 1,550; the
--    60 completed ones are left exactly as they are) loses Required and Blocks handoff, on homes
--    whose handoff is not accepted or in review (none is today). They stay Tasks; any still open
--    at handoff becomes a carry over item, as today.
-- 4. Publishes the plan as version 4, made the same way publish_onboarding_template does. It runs
--    only if the live plan matched version 3 exactly before the change, so version 4 is version 3
--    with only these marks cleared. Version 3 is never changed (versions are permanent). New homes
--    start on version 4; homes already started keep their own Tasks.
-- 5. History: one audit line for the plan and one per home, actor empty, reason decision O4.

DO $step$
DECLARE
  _key constant text := 'handoff_never_blocks_2026_11_08';
  _tpl constant uuid := '84f3a777-44a8-430a-af7e-8f18dc9a7dae';
  _v3 constant uuid := '7851b728-3b06-4bcb-87a6-cc69e2125c19';
  _n int;
  _diff int;
  _version int;
  _new uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.onboarding_flag_snapshots WHERE snapshot_key = _key) THEN
    RAISE EXCEPTION 'This step has already run.';
  END IF;
  IF (SELECT max(version) FROM public.onboarding_template_versions WHERE template_id = _tpl) <> 3 THEN
    RAISE EXCEPTION 'The Standard plan is no longer on version 3. Stop and review.';
  END IF;

  -- The live plan must equal version 3 before anything changes.
  SELECT count(*) INTO _diff FROM (
    (SELECT s FROM public.onboarding_template_versions v, jsonb_array_elements(v.snapshot->'steps') s WHERE v.id = _v3
     EXCEPT ALL
     SELECT to_jsonb(t) - 'created_at' - 'updated_at' FROM public.onboarding_template_tasks t WHERE t.template_id = _tpl AND t.is_active)
    UNION ALL
    (SELECT to_jsonb(t) - 'created_at' - 'updated_at' FROM public.onboarding_template_tasks t WHERE t.template_id = _tpl AND t.is_active
     EXCEPT ALL
     SELECT s FROM public.onboarding_template_versions v, jsonb_array_elements(v.snapshot->'steps') s WHERE v.id = _v3)) d;
  IF _diff <> 0 THEN
    RAISE EXCEPTION 'The live Standard plan differs from version 3 (% steps). Stop and review.', _diff;
  END IF;

  -- 1. Snapshot.
  INSERT INTO public.onboarding_flag_snapshots(snapshot_key, table_name, row_id, blocks_handoff, is_required, updated_at)
  SELECT _key, 'onboarding_template_tasks', id, blocks_handoff, is_required, updated_at
    FROM public.onboarding_template_tasks
   WHERE template_id = _tpl AND stage IN ('Preparing for Handoff', 'Handoff');
  GET DIAGNOSTICS _n = ROW_COUNT;
  IF _n <> 25 THEN RAISE EXCEPTION 'Expected 25 handoff steps in the Standard plan, found %.', _n; END IF;

  INSERT INTO public.onboarding_flag_snapshots(snapshot_key, table_name, row_id, blocks_handoff, is_required, updated_at)
  SELECT _key, 'onboarding_tasks', id, blocks_handoff, is_required, updated_at
    FROM public.onboarding_tasks t
   WHERE t.blocks_handoff
     AND t.status <> 'complete' AND t.completed_at IS NULL
     AND NOT private.onboarding_work_locked(ARRAY[t.property_id]);
  GET DIAGNOSTICS _n = ROW_COUNT;
  IF _n <> 1490 THEN RAISE EXCEPTION 'Expected 1,490 open blocking home Tasks, found %.', _n; END IF;

  -- 2. Plan steps.
  UPDATE public.onboarding_template_tasks t SET blocks_handoff = false, is_required = false
    FROM public.onboarding_flag_snapshots s
   WHERE s.snapshot_key = _key AND s.table_name = 'onboarding_template_tasks' AND s.row_id = t.id;
  GET DIAGNOSTICS _n = ROW_COUNT;
  IF _n <> 25 THEN RAISE EXCEPTION 'Plan update touched % steps, expected 25.', _n; END IF;

  -- 3. Home Tasks.
  UPDATE public.onboarding_tasks t SET blocks_handoff = false, is_required = false
    FROM public.onboarding_flag_snapshots s
   WHERE s.snapshot_key = _key AND s.table_name = 'onboarding_tasks' AND s.row_id = t.id;
  GET DIAGNOSTICS _n = ROW_COUNT;
  IF _n <> 1490 THEN RAISE EXCEPTION 'Home Task update touched % Tasks, expected 1,490.', _n; END IF;

  -- 4. Version 4, built exactly like publish_onboarding_template.
  SELECT coalesce(max(version), 0) + 1 INTO _version FROM public.onboarding_template_versions WHERE template_id = _tpl;
  INSERT INTO public.onboarding_template_versions(template_id, version, snapshot, published_by)
  SELECT _tpl, _version, jsonb_build_object(
    'stages', coalesce((SELECT jsonb_agg(jsonb_build_object('name', s.name, 'sort_order', s.sort_order) ORDER BY s.sort_order)
                FROM public.onboarding_template_stages s WHERE s.template_id = _tpl AND s.active), '[]'::jsonb),
    'steps', coalesce((SELECT jsonb_agg(to_jsonb(t) - 'created_at' - 'updated_at' ORDER BY t.sort_order)
                FROM public.onboarding_template_tasks t WHERE t.template_id = _tpl AND t.is_active
                  AND (NOT EXISTS (SELECT 1 FROM public.onboarding_template_stages s WHERE s.template_id = _tpl)
                       OR EXISTS (SELECT 1 FROM public.onboarding_template_stages s WHERE s.template_id = _tpl AND s.name = t.stage AND s.active))), '[]'::jsonb)),
    NULL
  RETURNING id INTO _new;

  -- 5. History.
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, before_value, after_value)
  SELECT NULL, 'handoff_never_blocks_applied', 'onboarding_template', _tpl, 'ARHA Onboarding - Standard',
         jsonb_build_object('version', 3, 'steps', jsonb_agg(jsonb_build_object('stepId', s.row_id, 'blocksHandoff', s.blocks_handoff, 'isRequired', s.is_required) ORDER BY s.row_id)),
         jsonb_build_object('version', _version, 'versionId', _new, 'blocksHandoff', false, 'isRequired', false,
                            'decision', 'O4: a handoff never blocks (Nov 7, 2026)', 'snapshotKey', _key)
    FROM public.onboarding_flag_snapshots s
   WHERE s.snapshot_key = _key AND s.table_name = 'onboarding_template_tasks';

  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, before_value, after_value)
  SELECT NULL, 'handoff_never_blocks_applied', 'property', t.property_id, 'Onboarding Tasks',
         jsonb_build_object('tasks', count(*), 'blocksHandoff', true, 'isRequired', true),
         jsonb_build_object('tasks', count(*), 'blocksHandoff', false, 'isRequired', false,
                            'decision', 'O4: a handoff never blocks (Nov 7, 2026)', 'snapshotKey', _key)
    FROM public.onboarding_flag_snapshots s
    JOIN public.onboarding_tasks t ON t.id = s.row_id
   WHERE s.snapshot_key = _key AND s.table_name = 'onboarding_tasks'
   GROUP BY t.property_id;
END
$step$;
