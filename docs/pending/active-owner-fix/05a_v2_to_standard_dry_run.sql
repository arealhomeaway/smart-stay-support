-- Fix 5 dry run (read only, writes nothing). For the four homes on ARHA Onboarding V2 it lists:
--   mapped      a V2 Task and the Standard step it maps to (same title, ignoring capitals, spaces and marks)
--   no_match    a V2 Task with no Standard step of the same title, with the closest Standard step by shared
--               words as a suggestion only (never applied unless added to the approved list in 05b)
--   new_step    a Standard step the home does not have, which the move would add as an open Task
-- Standard plan = latest published version of 'arha_onboarding_standard' (v4 on Nov 11).
WITH std_version AS (
  SELECT v.id, v.snapshot FROM public.onboarding_template_versions v
  JOIN public.onboarding_templates t ON t.id = v.template_id AND t.key = 'arha_onboarding_standard'
  ORDER BY v.version DESC LIMIT 1
), homes AS (
  SELECT op.id AS project_id, op.property_id, op.furnishing_scope, op.modules,
         public.format_property_label(to_jsonb(h)) ->> 'primary' AS home
  FROM public.onboarding_projects op
  JOIN public.properties h ON h.id = op.property_id
  JOIN public.onboarding_template_versions cv ON cv.id = op.template_version_id
  JOIN public.onboarding_templates ct ON ct.id = cv.template_id AND ct.key = 'arha_v2'
  WHERE op.status <> 'cancelled' AND NOT h.is_demo
    AND EXISTS (SELECT 1 FROM public.owner_program_properties e JOIN public.owner_programs p ON p.id = e.program_id
                WHERE e.property_id = op.property_id AND e.inclusion_status = 'included' AND e.archived_at IS NULL
                  AND p.status = 'active' AND p.archived_at IS NULL AND NOT p.is_demo)
), steps AS (
  SELECT hm.property_id, (s ->> 'id')::uuid AS step_id, s ->> 'title' AS title, s ->> 'stage' AS stage,
         lower(regexp_replace(s ->> 'title', '[^a-zA-Z0-9]+', '', 'g')) AS k
  FROM homes hm, std_version sv, jsonb_array_elements(sv.snapshot -> 'steps') s
  WHERE coalesce((s ->> 'is_active')::boolean, true)
    AND public.plan_step_applies(s -> 'condition', hm.furnishing_scope, hm.modules)
), v2 AS (
  SELECT t.property_id, t.id AS task_id, t.title, t.status, t.parent_task_id IS NOT NULL AS subtask,
         lower(regexp_replace(t.title, '[^a-zA-Z0-9]+', '', 'g')) AS k
  FROM public.onboarding_tasks t JOIN homes hm ON hm.property_id = t.property_id
  WHERE t.archived_at IS NULL
), exact AS (
  -- one Standard step per V2 Task and one V2 Task per Standard step (the oldest Task wins)
  SELECT DISTINCT ON (v.property_id, s.step_id) v.property_id, v.task_id, s.step_id
  FROM v2 v JOIN steps s ON s.property_id = v.property_id AND s.k = v.k
  WHERE NOT v.subtask
  ORDER BY v.property_id, s.step_id, v.task_id
), words AS (
  SELECT property_id, task_id AS id, 'v2' AS side, w FROM v2, regexp_split_to_table(lower(title), '[^a-z0-9]+') w WHERE length(w) > 2
  UNION ALL
  SELECT property_id, step_id, 'std', w FROM steps, regexp_split_to_table(lower(title), '[^a-z0-9]+') w WHERE length(w) > 2
), overlap AS (
  SELECT a.property_id, a.id AS task_id, b.id AS step_id, count(DISTINCT a.w) AS shared
  FROM words a JOIN words b ON b.property_id = a.property_id AND b.side = 'std' AND b.w = a.w AND a.side = 'v2'
  GROUP BY 1, 2, 3
), best AS (
  SELECT DISTINCT ON (o.property_id, o.task_id) o.property_id, o.task_id, o.step_id,
    round(o.shared::numeric / nullif((SELECT count(DISTINCT w) FROM words x WHERE x.id = o.task_id AND x.side = 'v2')
      + (SELECT count(DISTINCT w) FROM words x WHERE x.id = o.step_id AND x.side = 'std' AND x.property_id = o.property_id) - o.shared, 0), 2) AS score
  FROM overlap o ORDER BY o.property_id, o.task_id, o.shared DESC, o.step_id
)
SELECT hm.home, 'mapped' AS kind, v.task_id, v.title AS v2_task, v.status AS v2_status, s.step_id, s.title AS standard_step, NULL::numeric AS suggestion_score
FROM exact e JOIN homes hm ON hm.property_id = e.property_id JOIN v2 v ON v.task_id = e.task_id
JOIN steps s ON s.property_id = e.property_id AND s.step_id = e.step_id
UNION ALL
SELECT hm.home, 'no_match', v.task_id, v.title, v.status, b.step_id,
       CASE WHEN b.step_id IS NULL THEN NULL ELSE 'closest: ' || s.title END, b.score
FROM v2 v JOIN homes hm ON hm.property_id = v.property_id
LEFT JOIN best b ON b.property_id = v.property_id AND b.task_id = v.task_id
LEFT JOIN steps s ON s.property_id = v.property_id AND s.step_id = b.step_id
WHERE NOT EXISTS (SELECT 1 FROM exact e WHERE e.task_id = v.task_id)
UNION ALL
SELECT hm.home, 'new_step', NULL, NULL, NULL, s.step_id, s.title, NULL
FROM steps s JOIN homes hm ON hm.property_id = s.property_id
WHERE NOT EXISTS (SELECT 1 FROM exact e WHERE e.property_id = s.property_id AND e.step_id = s.step_id)
ORDER BY 1, 2, 4, 7;
