-- Fix 5: move the four Active Owner homes on ARHA Onboarding V2 to the Standard plan (latest
-- published version). Apply ONLY after Emily approves the 05a dry run (and after any handoff that has
-- truly happened is recorded). Every write is listed in ao_plan_move_receipts so the undo is exact.
--   mapped V2 Task   -> a Standard Task is created with the V2 Task's status, assignee, due date and,
--                       when completed, the original who, when and evidence; the V2 Task is archived
--                       (kept, never deleted) so the work is not listed twice.
--   new Standard step-> created open with the plan's own due date and role rules (as when a plan starts).
--   V2 Task, no match-> left exactly as it is.
-- Nothing else on the home changes. No email or notification is sent by this file.
CREATE TABLE IF NOT EXISTS public.ao_plan_move_receipts (
  id bigserial PRIMARY KEY,
  project_id uuid NOT NULL,
  property_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('created', 'archived_v2', 'version')),
  task_id uuid,
  from_task_id uuid,
  prior_version_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ao_plan_move_receipts TO authenticated;
GRANT ALL ON public.ao_plan_move_receipts TO service_role;
ALTER TABLE public.ao_plan_move_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ao_plan_move_receipts_staff_read ON public.ao_plan_move_receipts;
CREATE POLICY ao_plan_move_receipts_staff_read ON public.ao_plan_move_receipts FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

DO $move$
DECLARE std uuid; snap jsonb; pr public.onboarding_projects; step jsonb; v public.onboarding_tasks; who uuid; role text;
  anchor date; due date; unit text; nid uuid; sub text; sub_i int; created jsonb; src text;
  actor uuid := '98bd6696-4018-4965-b645-0471c5ae3925';
  projects uuid[] := ARRAY['0c2d2b1d-6967-4b2a-a973-2685c06cfd3b', '94338f4a-4a97-4268-869a-79ed103bbc8b',
                           'add4e549-2929-42db-b5fd-131787088768', '11bb7e6a-cb17-4b6d-b27f-df9b505d4400']::uuid[];
  p uuid;
BEGIN
  SELECT v2.id, v2.snapshot INTO std, snap FROM public.onboarding_template_versions v2
    JOIN public.onboarding_templates t ON t.id = v2.template_id AND t.key = 'arha_onboarding_standard'
   ORDER BY v2.version DESC LIMIT 1;
  IF std <> '94ef41f6-b195-4b94-b09c-830f706f5d1a' THEN
    RAISE EXCEPTION 'The Standard plan changed since the dry run. Run 05a again and re-approve.';
  END IF;
  FOREACH p IN ARRAY projects LOOP
    SELECT * INTO pr FROM public.onboarding_projects WHERE id = p FOR UPDATE;
    CONTINUE WHEN pr.template_version_id = std; -- already moved: a repeat changes nothing
    IF NOT EXISTS (SELECT 1 FROM public.onboarding_template_versions cv JOIN public.onboarding_templates ct ON ct.id = cv.template_id
                    WHERE cv.id = pr.template_version_id AND ct.key = 'arha_v2') THEN
      RAISE EXCEPTION 'Project % is no longer on ARHA Onboarding V2. Run 05a again.', p;
    END IF;
    created := '{}'::jsonb;
    FOR step IN SELECT * FROM jsonb_array_elements(snap -> 'steps') LOOP
      CONTINUE WHEN coalesce((step ->> 'is_active')::boolean, true) = false;
      CONTINUE WHEN NOT public.plan_step_applies(step -> 'condition', pr.furnishing_scope, pr.modules);
      SELECT t.* INTO v FROM public.onboarding_tasks t
       WHERE t.property_id = pr.property_id AND t.archived_at IS NULL AND t.parent_task_id IS NULL
         AND t.template_task_id IS DISTINCT FROM (step ->> 'id')::uuid
         AND lower(regexp_replace(t.title, '[^a-zA-Z0-9]+', '', 'g')) = lower(regexp_replace(step ->> 'title', '[^a-zA-Z0-9]+', '', 'g'))
       ORDER BY t.id LIMIT 1;
      role := step ->> 'functional_role';
      unit := coalesce(step ->> 'offset_unit', 'calendar');
      IF v.id IS NOT NULL THEN
        who := v.assigned_to; due := v.due_on;
      ELSE
        who := CASE WHEN role IS NULL THEN NULL ELSE public.project_role_assignee(pr.id, role) END;
        anchor := CASE step ->> 'schedule_anchor'
          WHEN 'planned_closing' THEN pr.planned_closing_on WHEN 'actual_closing' THEN pr.planned_closing_on
          WHEN 'project_created' THEN (pr.created_at AT TIME ZONE 'America/Chicago')::date
          WHEN 'target_handoff' THEN pr.target_handoff_on ELSE pr.possession_on END;
        due := public.plan_due_from_rule(anchor, (step ->> 'offset_days')::int, unit);
      END IF;
      INSERT INTO public.onboarding_tasks(property_id, stage, title, detail, description, done_when, video_url, assigned_to, assigned_seat, due_on,
        status, completed_at, completed_by, evidence_note, owner_approval_status, blocks_handoff, is_required, requires_owner_approval,
        evidence_required, sort_order, schedule_anchor, schedule_offset_days, schedule_offset_unit, due_on_source, tags, template_task_id,
        is_demo, owner_dependency, created_by)
      VALUES (pr.property_id, step ->> 'stage', step ->> 'title', step ->> 'detail', step ->> 'description', step ->> 'done_when', step ->> 'video_url',
        who, role, due, coalesce(v.status, 'open'), v.completed_at, v.completed_by, v.evidence_note,
        coalesce(v.owner_approval_status, 'not_required'),
        coalesce((step ->> 'blocks_handoff')::boolean, false), coalesce((step ->> 'is_required')::boolean, true),
        coalesce((step ->> 'requires_owner_approval')::boolean, false), coalesce((step ->> 'evidence_required')::boolean, false),
        coalesce((step ->> 'sort_order')::int, 0), step ->> 'schedule_anchor', (step ->> 'offset_days')::int, unit,
        CASE WHEN v.id IS NULL THEN 'template_v2' ELSE v.due_on_source END,
        coalesce((SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(step -> 'tags', '[]'::jsonb)) x), '{}'),
        (step ->> 'id')::uuid, pr.is_demo, nullif(step ->> 'owner_dependency', 'none'), actor)
      RETURNING id INTO nid;
      created := created || jsonb_build_object(step ->> 'id', nid::text);
      INSERT INTO public.ao_plan_move_receipts(project_id, property_id, kind, task_id, from_task_id) VALUES (pr.id, pr.property_id, 'created', nid, v.id);
      IF v.id IS NOT NULL THEN
        UPDATE public.onboarding_tasks SET archived_at = now(), archived_by = actor WHERE id = v.id;
        INSERT INTO public.ao_plan_move_receipts(project_id, property_id, kind, task_id) VALUES (pr.id, pr.property_id, 'archived_v2', v.id);
      ELSE
        sub_i := 0;
        FOR sub IN SELECT * FROM jsonb_array_elements_text(coalesce(step -> 'subtasks', '[]'::jsonb)) LOOP
          CONTINUE WHEN btrim(sub) = '';
          sub_i := sub_i + 1;
          INSERT INTO public.onboarding_tasks(property_id, stage, title, parent_task_id, assigned_to, assigned_seat, due_on, status,
            blocks_handoff, is_required, sort_order, due_on_source, is_demo, created_by)
          VALUES (pr.property_id, step ->> 'stage', btrim(sub), nid, who, role, due, 'open',
            coalesce((step ->> 'blocks_handoff')::boolean, false), coalesce((step ->> 'is_required')::boolean, true), sub_i, 'template_v2', pr.is_demo, actor)
          RETURNING id INTO v.id;
          INSERT INTO public.ao_plan_move_receipts(project_id, property_id, kind, task_id) VALUES (pr.id, pr.property_id, 'created', v.id);
        END LOOP;
      END IF;
      v := NULL;
    END LOOP;
    FOR step IN SELECT * FROM jsonb_array_elements(snap -> 'steps') LOOP
      CONTINUE WHEN NOT (created ? (step ->> 'id'));
      FOR src IN SELECT * FROM jsonb_array_elements_text(coalesce(step -> 'show_files_from', '[]'::jsonb)) LOOP
        IF created ? src AND src <> step ->> 'id' THEN
          INSERT INTO public.onboarding_task_file_links(property_id, receiving_task_id, source_task_id, origin, created_by)
          VALUES (pr.property_id, (created ->> (step ->> 'id'))::uuid, (created ->> src)::uuid, 'template', actor) ON CONFLICT DO NOTHING;
        END IF;
      END LOOP;
    END LOOP;
    INSERT INTO public.ao_plan_move_receipts(project_id, property_id, kind, prior_version_id) VALUES (pr.id, pr.property_id, 'version', pr.template_version_id);
    UPDATE public.onboarding_projects SET template_version_id = std WHERE id = pr.id;
    INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
      VALUES (actor, 'onboarding_plan_moved', 'onboarding_project', pr.id, 'Moved to the Standard plan',
              jsonb_build_object('created', (SELECT count(*) FROM public.ao_plan_move_receipts r WHERE r.project_id = pr.id AND r.kind = 'created'),
                                 'archived_v2', (SELECT count(*) FROM public.ao_plan_move_receipts r WHERE r.project_id = pr.id AND r.kind = 'archived_v2')));
  END LOOP;
END $move$;
