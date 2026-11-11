-- STAGED, NOT APPLIED. Plan version 5 of "ARHA Onboarding - Standard" (Kati help ticket 66, Emily Nov 10).
-- Run only with Emily's explicit approval. No BEGIN/COMMIT: the migration tool runs the file in one transaction.
-- Replaces the one step "Share the mood boards and floor plans with the owner" with TWO Lead Designer
-- steps, each needing owner approval: "Share the mood boards with the owner" and "Share the floor plans
-- with the owner". Every other step is identical. Only homes started from version 5 get the new steps;
-- versions 1 to 4 and every home already on them (624 Daniel Court included) are untouched. The old
-- step is retired from future versions (is_active = false), never deleted.

DO $do$ BEGIN
  IF (SELECT max(version) FROM public.onboarding_template_versions WHERE template_id = '84f3a777-44a8-430a-af7e-8f18dc9a7dae') IS DISTINCT FROM 4 THEN
    RAISE EXCEPTION 'Standard plan is no longer on version 4; nothing applied'; END IF;
  IF (SELECT md5(snapshot::text) FROM public.onboarding_template_versions WHERE template_id = '84f3a777-44a8-430a-af7e-8f18dc9a7dae' AND version = 4) IS DISTINCT FROM 'a55aa81853f631e222a3badc771017b6' THEN
    RAISE EXCEPTION 'Version 4 snapshot changed since it was read on Nov 10; nothing applied'; END IF;
  IF (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'created_at' - 'updated_at' ORDER BY t.sort_order),'[]'::jsonb) FROM public.onboarding_template_tasks t WHERE t.template_id = '84f3a777-44a8-430a-af7e-8f18dc9a7dae' AND t.is_active)
     IS DISTINCT FROM (SELECT snapshot->'steps' FROM public.onboarding_template_versions WHERE template_id = '84f3a777-44a8-430a-af7e-8f18dc9a7dae' AND version = 4) THEN
    RAISE EXCEPTION 'Standard working steps changed since version 4; nothing applied'; END IF;
  IF (SELECT md5((to_jsonb(t) - 'created_at' - 'updated_at')::text) FROM public.onboarding_template_tasks t WHERE id = '465ed7be-2ae9-497f-857f-447553df16c5') IS DISTINCT FROM '521e505ce2bce4ea33e58ee31cf01842' THEN
    RAISE EXCEPTION 'The mood boards and floor plans step changed since it was read; nothing applied'; END IF;
  IF EXISTS (SELECT 1 FROM public.onboarding_template_tasks WHERE id IN ('6a7e0b15-0c66-4d2b-9c1a-5b0e9f4d7a01','6a7e0b15-0c66-4d2b-9c1a-5b0e9f4d7a02')) THEN
    RAISE EXCEPTION 'The two new steps already exist; nothing applied'; END IF;
END $do$;

-- Both new steps copy every field of the old step; only the id, title and sort order differ.
-- The Active Owner opportunity (Review your selection boards) stays with the mood boards step.
INSERT INTO public.onboarding_template_tasks (
  id, template_id, stage, title, role, detail, sort_order, blocks_handoff, requires_owner_approval,
  owner_approval_when_active_owner, evidence_required, schedule_anchor, offset_days, breezeway_template_id,
  subtasks, tags, is_required, is_active, functional_role, module, condition, opportunity, owner_dependency,
  description, done_when, video_url, offset_unit, show_files_from)
SELECT '6a7e0b15-0c66-4d2b-9c1a-5b0e9f4d7a01', template_id, stage, 'Share the mood boards with the owner', role, detail, 750,
  blocks_handoff, requires_owner_approval, owner_approval_when_active_owner, evidence_required, schedule_anchor, offset_days,
  breezeway_template_id, subtasks, tags, is_required, true, functional_role, module, condition, opportunity, owner_dependency,
  description, done_when, video_url, offset_unit, show_files_from
FROM public.onboarding_template_tasks WHERE id = '465ed7be-2ae9-497f-857f-447553df16c5';
INSERT INTO public.onboarding_template_tasks (
  id, template_id, stage, title, role, detail, sort_order, blocks_handoff, requires_owner_approval,
  owner_approval_when_active_owner, evidence_required, schedule_anchor, offset_days, breezeway_template_id,
  subtasks, tags, is_required, is_active, functional_role, module, condition, opportunity, owner_dependency,
  description, done_when, video_url, offset_unit, show_files_from)
SELECT '6a7e0b15-0c66-4d2b-9c1a-5b0e9f4d7a02', template_id, stage, 'Share the floor plans with the owner', role, detail, 751,
  blocks_handoff, requires_owner_approval, owner_approval_when_active_owner, evidence_required, schedule_anchor, offset_days,
  breezeway_template_id, subtasks, tags, is_required, true, functional_role, module, condition, NULL, owner_dependency,
  description, done_when, video_url, offset_unit, show_files_from
FROM public.onboarding_template_tasks WHERE id = '465ed7be-2ae9-497f-857f-447553df16c5';

UPDATE public.onboarding_template_tasks SET is_active = false WHERE id = '465ed7be-2ae9-497f-857f-447553df16c5';

-- The Active Owner card "Review and respond to the mood board" also unlocks from the new mood boards
-- step on version 5 homes (the old step stays linked for homes on versions 1 to 4).
UPDATE public.ao_library_cards
   SET linked_template_task_ids = array_append(linked_template_task_ids, '6a7e0b15-0c66-4d2b-9c1a-5b0e9f4d7a01'::uuid),
       version = version + 1, updated_at = now()
 WHERE id = '890a7893-bb00-4f0d-8e48-1464494bd3d5'
   AND NOT ('6a7e0b15-0c66-4d2b-9c1a-5b0e9f4d7a01'::uuid = ANY(linked_template_task_ids));
INSERT INTO public.ao_library_card_history (card_id, version, snapshot, changed_by)
SELECT c.id, c.version, to_jsonb(c), NULL FROM public.ao_library_cards c WHERE c.id = '890a7893-bb00-4f0d-8e48-1464494bd3d5';

-- Publish version 5 (same snapshot shape as publish_onboarding_template and version 3).
INSERT INTO public.onboarding_template_versions (template_id, version, snapshot, published_by)
SELECT '84f3a777-44a8-430a-af7e-8f18dc9a7dae', 5, jsonb_build_object(
  'stages', coalesce((SELECT jsonb_agg(jsonb_build_object('name',s.name,'sort_order',s.sort_order) ORDER BY s.sort_order)
              FROM public.onboarding_template_stages s WHERE s.template_id='84f3a777-44a8-430a-af7e-8f18dc9a7dae' AND s.active),'[]'::jsonb),
  'steps', coalesce((SELECT jsonb_agg(to_jsonb(t) - 'created_at' - 'updated_at' ORDER BY t.sort_order)
              FROM public.onboarding_template_tasks t WHERE t.template_id='84f3a777-44a8-430a-af7e-8f18dc9a7dae' AND t.is_active
                AND (NOT EXISTS (SELECT 1 FROM public.onboarding_template_stages s WHERE s.template_id='84f3a777-44a8-430a-af7e-8f18dc9a7dae')
                     OR EXISTS (SELECT 1 FROM public.onboarding_template_stages s WHERE s.template_id='84f3a777-44a8-430a-af7e-8f18dc9a7dae' AND s.name=t.stage AND s.active))),'[]'::jsonb)),
  NULL;
