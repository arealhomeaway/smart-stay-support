-- Fix 5 dry run (changed Nov 11; read only, writes nothing). One row per home moving from ARHA Onboarding
-- V2 to the Standard plan (latest published version of 'arha_onboarding_standard', v4 on Nov 11):
--   v2_tasks_to_archive      every current Task on the home (all of them come from the V2 plan)
--   standard_steps_to_create Standard steps the move creates (plus subtasks_to_create under them)
--   created_completed        listed steps created completed from the confirmed done list below
--   already_covered_cards    released owner cards whose linked steps on this home are ALL listed
--   stops                    anything in the list that would stop 05b before it writes anything
-- The confirmed done list below must be identical to the one at the top of 05b (a test checks it).
-- To find a step's ID for the list: SELECT s ->> 'id', s ->> 'stage', s ->> 'title' FROM
--   public.onboarding_template_versions v, jsonb_array_elements(v.snapshot -> 'steps') s
--   WHERE v.id = '94ef41f6-b195-4b94-b09c-830f706f5d1a' ORDER BY (s ->> 'sort_order')::int;
WITH input AS (SELECT
-- >>> CONFIRMED DONE LIST >>>
'[
  {"project": "0c2d2b1d-6967-4b2a-a973-2685c06cfd3b", "home": "9211 Fitzgerald Dr", "done_steps": []},
  {"project": "94338f4a-4a97-4268-869a-79ed103bbc8b", "home": "3915 W 104th St S", "done_steps": []},
  {"project": "add4e549-2929-42db-b5fd-131787088768", "home": "1399 Foxtail Ln", "done_steps": []},
  {"project": "11bb7e6a-cb17-4b6d-b27f-df9b505d4400", "home": "1464 Buckland Ct", "done_steps": []}
]'
-- <<< CONFIRMED DONE LIST <<<
  ::jsonb AS list
), listed AS (
  SELECT (e ->> 'project')::uuid AS project_id, x::uuid AS step_id
  FROM input, jsonb_array_elements(list) e, jsonb_array_elements_text(coalesce(e -> 'done_steps', '[]'::jsonb)) x
), std_version AS (
  SELECT v.id, v.snapshot FROM public.onboarding_template_versions v
  JOIN public.onboarding_templates t ON t.id = v.template_id AND t.key = 'arha_onboarding_standard'
  ORDER BY v.version DESC LIMIT 1
), homes AS (
  SELECT op.id AS project_id, op.property_id, op.furnishing_scope, op.modules, ct.key = 'arha_v2' AS on_v2,
         public.format_property_label(to_jsonb(h)) ->> 'primary' AS home
  FROM public.onboarding_projects op
  JOIN public.properties h ON h.id = op.property_id
  LEFT JOIN public.onboarding_template_versions cv ON cv.id = op.template_version_id
  LEFT JOIN public.onboarding_templates ct ON ct.id = cv.template_id
  WHERE op.id = ANY (ARRAY['0c2d2b1d-6967-4b2a-a973-2685c06cfd3b', '94338f4a-4a97-4268-869a-79ed103bbc8b',
                           'add4e549-2929-42db-b5fd-131787088768', '11bb7e6a-cb17-4b6d-b27f-df9b505d4400']::uuid[])
), steps AS (
  SELECT hm.project_id, (s ->> 'id')::uuid AS step_id, s ->> 'title' AS title,
         jsonb_array_length(coalesce(s -> 'subtasks', '[]'::jsonb)) AS subs,
         coalesce((s ->> 'requires_owner_approval')::boolean, false) OR s ->> 'owner_dependency' = 'business_decision' AS needs_owner,
         coalesce(s -> 'tags', '[]'::jsonb) ?| ARRAY['handoff_step:ready', 'handoff_step:accepted']
           OR pg_get_functiondef('public.handoff_step_for_task(uuid)'::regprocedure) LIKE '%' || (s ->> 'id') || '%' AS handoff
  FROM homes hm, std_version sv, jsonb_array_elements(sv.snapshot -> 'steps') s
  WHERE coalesce((s ->> 'is_active')::boolean, true)
    AND public.plan_step_applies(s -> 'condition', hm.furnishing_scope, hm.modules)
), per_home AS (
  SELECT hm.*,
    (SELECT count(*) FROM public.onboarding_tasks t WHERE t.property_id = hm.property_id AND t.archived_at IS NULL) AS v2_tasks_to_archive,
    (SELECT count(*) FROM steps s WHERE s.project_id = hm.project_id) AS standard_steps_to_create,
    (SELECT coalesce(sum(s.subs), 0) FROM steps s WHERE s.project_id = hm.project_id) AS subtasks_to_create,
    (SELECT count(DISTINCT l.step_id) FROM listed l JOIN steps s ON s.project_id = l.project_id AND s.step_id = l.step_id
      WHERE l.project_id = hm.project_id AND NOT s.needs_owner AND NOT s.handoff) AS created_completed,
    (SELECT string_agg(c.code, ', ' ORDER BY c.code) FROM public.ao_library_cards c
      WHERE c.status = 'released'
        AND EXISTS (SELECT 1 FROM steps s WHERE s.project_id = hm.project_id AND s.step_id = ANY (c.linked_template_task_ids))
        AND NOT EXISTS (SELECT 1 FROM steps s WHERE s.project_id = hm.project_id AND s.step_id = ANY (c.linked_template_task_ids)
                          AND NOT EXISTS (SELECT 1 FROM listed l WHERE l.project_id = hm.project_id AND l.step_id = s.step_id))) AS already_covered_cards,
    concat_ws('; ',
      CASE WHEN NOT coalesce(hm.on_v2, false) THEN 'home is no longer on ARHA Onboarding V2' END,
      (SELECT 'not on this home''s Standard plan: ' || string_agg(l.step_id::text, ', ') FROM listed l
        WHERE l.project_id = hm.project_id AND NOT EXISTS (SELECT 1 FROM steps s WHERE s.project_id = l.project_id AND s.step_id = l.step_id)),
      (SELECT 'needs a homeowner decision: ' || string_agg(s.title, ', ') FROM listed l JOIN steps s ON s.project_id = l.project_id AND s.step_id = l.step_id
        WHERE l.project_id = hm.project_id AND s.needs_owner),
      (SELECT 'handoff step: ' || string_agg(s.title, ', ') FROM listed l JOIN steps s ON s.project_id = l.project_id AND s.step_id = l.step_id
        WHERE l.project_id = hm.project_id AND s.handoff)) AS stops
  FROM homes hm
)
SELECT home, v2_tasks_to_archive, standard_steps_to_create, subtasks_to_create, created_completed,
       coalesce(already_covered_cards, 'none') AS already_covered_cards, nullif(stops, '') AS stops
FROM per_home
UNION ALL
SELECT 'list problem', NULL, NULL, NULL, NULL, NULL,
       'the list names a home that is not part of this move: ' || string_agg(DISTINCT l.project_id::text, ', ')
FROM listed l WHERE NOT EXISTS (SELECT 1 FROM homes h WHERE h.project_id = l.project_id)
HAVING count(*) > 0
ORDER BY 1;
