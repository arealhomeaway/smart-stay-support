-- Fix 5 (changed Nov 11, approved by the Admin): move the four Active Owner homes on ARHA Onboarding V2
-- to the Standard plan (latest published version). Apply ONLY after the Admin approves the 05a dry run.
--
-- INPUT LIST: per home, the Standard step IDs confirmed done in real life (from the Admin's checklist).
-- Leave a list empty when nothing is confirmed. The same list must be pasted into 05a; a test checks
-- that the two copies are identical. Step IDs are the "id" of each step in the Standard plan.
-- >>> CONFIRMED DONE LIST >>>
CREATE TEMP TABLE IF NOT EXISTS ao_move_input(list jsonb);
TRUNCATE ao_move_input;
INSERT INTO ao_move_input(list) VALUES ('[
  {"project": "0c2d2b1d-6967-4b2a-a973-2685c06cfd3b", "home": "9211 Fitzgerald Dr", "done_steps": []},
  {"project": "94338f4a-4a97-4268-869a-79ed103bbc8b", "home": "3915 W 104th St S", "done_steps": []},
  {"project": "add4e549-2929-42db-b5fd-131787088768", "home": "1399 Foxtail Ln", "done_steps": []},
  {"project": "11bb7e6a-cb17-4b6d-b27f-df9b505d4400", "home": "1464 Buckland Ct", "done_steps": []}
]');
-- <<< CONFIRMED DONE LIST <<<
--
-- What the move does, per home, in one step (all or none):
--   every V2 Task -> archived: archived_at and archived_by set, each one recorded in the receipts.
--                    Nothing is deleted; completed V2 work keeps its who, when and evidence on the record.
--   listed step   -> created completed: completed by the approving Admin (COO), now, with the note
--                    "Done before Resolve, confirmed by the COO, Nov 11". Its subtasks are created
--                    completed the same way. A card whose linked steps are all listed is Already covered
--                    when the plan starts.
--   other step    -> created open, assigned and dated as the Standard plan assigns them.
-- There is no title matching. A listed step that needs a homeowner decision, is a handoff step, or is
-- not on the home's Standard plan stops the move before anything is written. No email or notification
-- is sent by this file (Tasks are created already completed; no status change happens).
CREATE TABLE IF NOT EXISTS public.ao_plan_move_receipts (
  id bigserial PRIMARY KEY,
  project_id uuid NOT NULL,
  property_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('created', 'created_done', 'archived_v2', 'version')),
  task_id uuid,
  step_id uuid,
  prior_version_id uuid,
  archived_at timestamptz,
  actor_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ao_plan_move_receipts TO authenticated;
GRANT ALL ON public.ao_plan_move_receipts TO service_role;
ALTER TABLE public.ao_plan_move_receipts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ao_plan_move_receipts_staff_read ON public.ao_plan_move_receipts;
CREATE POLICY ao_plan_move_receipts_staff_read ON public.ao_plan_move_receipts FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

DO $move$
DECLARE std uuid; snap jsonb; pr public.onboarding_projects; step jsonb; who uuid; role text;
  anchor date; due date; unit text; nid uuid; sid uuid; sub text; sub_i int; created jsonb; src text;
  listed boolean; bad text; input jsonb; done_steps uuid[];
  note text := 'Done before Resolve, confirmed by the COO, Nov 11';
  actor uuid := '98bd6696-4018-4965-b645-0471c5ae3925';
  projects uuid[] := ARRAY['0c2d2b1d-6967-4b2a-a973-2685c06cfd3b', '94338f4a-4a97-4268-869a-79ed103bbc8b',
                           'add4e549-2929-42db-b5fd-131787088768', '11bb7e6a-cb17-4b6d-b27f-df9b505d4400']::uuid[];
  p uuid; stamp timestamptz := now();
BEGIN
  SELECT list INTO input FROM ao_move_input;
  SELECT v2.id, v2.snapshot INTO std, snap FROM public.onboarding_template_versions v2
    JOIN public.onboarding_templates t ON t.id = v2.template_id AND t.key = 'arha_onboarding_standard'
   ORDER BY v2.version DESC LIMIT 1;
  IF std <> '94ef41f6-b195-4b94-b09c-830f706f5d1a' THEN
    RAISE EXCEPTION 'The Standard plan changed since the dry run. Run 05a again and re-approve.';
  END IF;
  -- The list names only these four homes, each at most once.
  SELECT string_agg(e ->> 'project', ', ') INTO bad FROM jsonb_array_elements(input) e
   WHERE NOT ((e ->> 'project')::uuid = ANY (projects));
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'The confirmed done list names a home that is not part of this move: %', bad; END IF;
  IF (SELECT count(*) <> count(DISTINCT e ->> 'project') FROM jsonb_array_elements(input) e) THEN
    RAISE EXCEPTION 'The confirmed done list names a home twice. Merge its steps into one line.';
  END IF;
  FOREACH p IN ARRAY projects LOOP
    SELECT * INTO pr FROM public.onboarding_projects WHERE id = p FOR UPDATE;
    CONTINUE WHEN pr.template_version_id = std; -- already moved: a repeat changes nothing
    IF NOT EXISTS (SELECT 1 FROM public.onboarding_template_versions cv JOIN public.onboarding_templates ct ON ct.id = cv.template_id
                    WHERE cv.id = pr.template_version_id AND ct.key = 'arha_v2') THEN
      RAISE EXCEPTION 'Project % is no longer on ARHA Onboarding V2. Run 05a again.', p;
    END IF;
    SELECT coalesce(array_agg(DISTINCT x::uuid), ARRAY[]::uuid[]) INTO done_steps
      FROM jsonb_array_elements(input) e, jsonb_array_elements_text(coalesce(e -> 'done_steps', '[]'::jsonb)) x
     WHERE (e ->> 'project')::uuid = p;
    -- Every listed step must be on this home's Standard plan and must not need a homeowner decision.
    SELECT string_agg(d::text, ', ') INTO bad FROM unnest(done_steps) d
     WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(snap -> 'steps') s
                        WHERE (s ->> 'id')::uuid = d AND coalesce((s ->> 'is_active')::boolean, true)
                          AND public.plan_step_applies(s -> 'condition', pr.furnishing_scope, pr.modules));
    IF bad IS NOT NULL THEN RAISE EXCEPTION 'Listed steps not on this home''s Standard plan (project %): %', p, bad; END IF;
    SELECT string_agg(s ->> 'title', '; ') INTO bad FROM jsonb_array_elements(snap -> 'steps') s
     WHERE (s ->> 'id')::uuid = ANY (done_steps)
       AND (coalesce((s ->> 'requires_owner_approval')::boolean, false) OR s ->> 'owner_dependency' = 'business_decision');
    IF bad IS NOT NULL THEN
      RAISE EXCEPTION 'These listed steps need a homeowner decision and cannot be marked done before Resolve (project %): %', p, bad;
    END IF;

    -- 1. Archive every V2 Task on the home (kept, never deleted), each recorded.
    WITH a AS (
      UPDATE public.onboarding_tasks SET archived_at = stamp, archived_by = actor
       WHERE property_id = pr.property_id AND archived_at IS NULL
      RETURNING id)
    INSERT INTO public.ao_plan_move_receipts(project_id, property_id, kind, task_id, archived_at, actor_id)
    SELECT pr.id, pr.property_id, 'archived_v2', a.id, stamp, actor FROM a;

    -- 2. Create every Standard step: listed ones completed, the rest open as the plan assigns them.
    created := '{}'::jsonb;
    FOR step IN SELECT * FROM jsonb_array_elements(snap -> 'steps') LOOP
      CONTINUE WHEN coalesce((step ->> 'is_active')::boolean, true) = false;
      CONTINUE WHEN NOT public.plan_step_applies(step -> 'condition', pr.furnishing_scope, pr.modules);
      sid := (step ->> 'id')::uuid;
      listed := sid = ANY (done_steps);
      role := step ->> 'functional_role';
      unit := coalesce(step ->> 'offset_unit', 'calendar');
      who := CASE WHEN role IS NULL THEN NULL ELSE public.project_role_assignee(pr.id, role) END;
      anchor := CASE step ->> 'schedule_anchor'
        WHEN 'planned_closing' THEN pr.planned_closing_on WHEN 'actual_closing' THEN pr.planned_closing_on
        WHEN 'project_created' THEN (pr.created_at AT TIME ZONE 'America/Chicago')::date
        WHEN 'target_handoff' THEN pr.target_handoff_on ELSE pr.possession_on END;
      due := public.plan_due_from_rule(anchor, (step ->> 'offset_days')::int, unit);
      INSERT INTO public.onboarding_tasks(property_id, stage, title, detail, description, done_when, video_url, assigned_to, assigned_seat, due_on,
        status, completed_at, completed_by, evidence_note, owner_approval_status, blocks_handoff, is_required, requires_owner_approval,
        evidence_required, sort_order, schedule_anchor, schedule_offset_days, schedule_offset_unit, due_on_source, tags, template_task_id,
        is_demo, owner_dependency, created_by)
      VALUES (pr.property_id, step ->> 'stage', step ->> 'title', step ->> 'detail', step ->> 'description', step ->> 'done_when', step ->> 'video_url',
        who, role, due, CASE WHEN listed THEN 'complete' ELSE 'open' END,
        CASE WHEN listed THEN stamp END, CASE WHEN listed THEN actor END, CASE WHEN listed THEN note END, 'not_required',
        coalesce((step ->> 'blocks_handoff')::boolean, false), coalesce((step ->> 'is_required')::boolean, true),
        coalesce((step ->> 'requires_owner_approval')::boolean, false), coalesce((step ->> 'evidence_required')::boolean, false),
        coalesce((step ->> 'sort_order')::int, 0), step ->> 'schedule_anchor', (step ->> 'offset_days')::int, unit, 'template_v2',
        coalesce((SELECT array_agg(x) FROM jsonb_array_elements_text(coalesce(step -> 'tags', '[]'::jsonb)) x), '{}'),
        sid, pr.is_demo, nullif(step ->> 'owner_dependency', 'none'), actor)
      RETURNING id INTO nid;
      -- The handoff is recorded only through its own steps, never by this list.
      IF listed AND public.handoff_step_for_task(nid) IS NOT NULL THEN
        RAISE EXCEPTION 'The listed step "%" is a handoff step. Record the handoff through the Handoff section instead.', step ->> 'title';
      END IF;
      created := created || jsonb_build_object(step ->> 'id', nid::text);
      INSERT INTO public.ao_plan_move_receipts(project_id, property_id, kind, task_id, step_id, actor_id)
        VALUES (pr.id, pr.property_id, CASE WHEN listed THEN 'created_done' ELSE 'created' END, nid, sid, actor);
      sub_i := 0;
      FOR sub IN SELECT * FROM jsonb_array_elements_text(coalesce(step -> 'subtasks', '[]'::jsonb)) LOOP
        CONTINUE WHEN btrim(sub) = '';
        sub_i := sub_i + 1;
        INSERT INTO public.onboarding_tasks(property_id, stage, title, parent_task_id, assigned_to, assigned_seat, due_on, status,
          completed_at, completed_by, evidence_note, blocks_handoff, is_required, sort_order, due_on_source, is_demo, created_by)
        VALUES (pr.property_id, step ->> 'stage', btrim(sub), nid, who, role, due, CASE WHEN listed THEN 'complete' ELSE 'open' END,
          CASE WHEN listed THEN stamp END, CASE WHEN listed THEN actor END, CASE WHEN listed THEN note END,
          coalesce((step ->> 'blocks_handoff')::boolean, false), coalesce((step ->> 'is_required')::boolean, true), sub_i, 'template_v2', pr.is_demo, actor)
        RETURNING id INTO nid;
        INSERT INTO public.ao_plan_move_receipts(project_id, property_id, kind, task_id, step_id, actor_id)
          VALUES (pr.id, pr.property_id, CASE WHEN listed THEN 'created_done' ELSE 'created' END, nid, sid, actor);
      END LOOP;
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
    INSERT INTO public.ao_plan_move_receipts(project_id, property_id, kind, prior_version_id, actor_id)
      VALUES (pr.id, pr.property_id, 'version', pr.template_version_id, actor);
    UPDATE public.onboarding_projects SET template_version_id = std WHERE id = pr.id;
    INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
      VALUES (actor, 'onboarding_plan_moved', 'onboarding_project', pr.id, 'Moved to the Standard plan',
              jsonb_build_object(
                'archived_v2', (SELECT count(*) FROM public.ao_plan_move_receipts r WHERE r.project_id = pr.id AND r.kind = 'archived_v2' AND r.archived_at = stamp),
                'created_open', (SELECT count(*) FROM public.ao_plan_move_receipts r WHERE r.project_id = pr.id AND r.kind = 'created' AND r.created_at = stamp),
                'created_done', (SELECT count(*) FROM public.ao_plan_move_receipts r WHERE r.project_id = pr.id AND r.kind = 'created_done' AND r.created_at = stamp),
                'confirmed_done_steps', to_jsonb(done_steps)));
  END LOOP;
END $move$;
DROP TABLE IF EXISTS ao_move_input;
