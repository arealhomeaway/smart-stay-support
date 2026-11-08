-- Undo for 03_clear_handoff_flags.sql. Data step (data tool). No BEGIN/COMMIT.
--
-- Restores the exact saved Required and Blocks handoff values of every row 03 changed (from
-- onboarding_flag_snapshots). Published versions are permanent, so version 4 stays in history and
-- the plan is published again as a new version whose steps and stages are copied exactly from
-- version 3; new homes then start on version 3's content again. One audit line records the undo.

DO $undo$
DECLARE
  _key constant text := 'handoff_never_blocks_2026_11_08';
  _tpl constant uuid := '84f3a777-44a8-430a-af7e-8f18dc9a7dae';
  _v3 constant uuid := '7851b728-3b06-4bcb-87a6-cc69e2125c19';
  _t int;
  _h int;
  _version int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.onboarding_flag_snapshots WHERE snapshot_key = _key) THEN
    RAISE EXCEPTION 'Nothing to undo: no saved values for this step.';
  END IF;

  UPDATE public.onboarding_template_tasks t SET blocks_handoff = s.blocks_handoff, is_required = s.is_required
    FROM public.onboarding_flag_snapshots s
   WHERE s.snapshot_key = _key AND s.table_name = 'onboarding_template_tasks' AND s.row_id = t.id;
  GET DIAGNOSTICS _t = ROW_COUNT;

  UPDATE public.onboarding_tasks t SET blocks_handoff = s.blocks_handoff, is_required = s.is_required
    FROM public.onboarding_flag_snapshots s
   WHERE s.snapshot_key = _key AND s.table_name = 'onboarding_tasks' AND s.row_id = t.id;
  GET DIAGNOSTICS _h = ROW_COUNT;

  SELECT coalesce(max(version), 0) + 1 INTO _version FROM public.onboarding_template_versions WHERE template_id = _tpl;
  INSERT INTO public.onboarding_template_versions(template_id, version, snapshot, published_by)
  SELECT _tpl, _version, snapshot, NULL FROM public.onboarding_template_versions WHERE id = _v3;

  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, before_value, after_value)
  VALUES (NULL, 'handoff_never_blocks_undone', 'onboarding_template', _tpl, 'ARHA Onboarding - Standard',
          jsonb_build_object('snapshotKey', _key),
          jsonb_build_object('stepsRestored', _t, 'tasksRestored', _h, 'version', _version, 'copiedFrom', 3));
END
$undo$;
