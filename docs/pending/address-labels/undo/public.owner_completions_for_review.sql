CREATE OR REPLACE FUNCTION public.owner_completions_for_review(_demo boolean, _property uuid DEFAULT NULL::uuid)
 RETURNS TABLE(work_item_id uuid, property_id uuid, property_name text, title text, owner_name text, completed_at timestamp with time zone, responsible_id uuid, responsible_name text, assignment_exception boolean, evidence_count integer, latest_feedback text, latest_feedback_at timestamp with time zone, review_status text, reviewed_at timestamp with time zone, reviewed_by_name text, latest_internal_note text, follow_up_task_id uuid, new_owner_activity boolean, source_task_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH base AS (
    SELECT w.* FROM work_items w
     WHERE w.kind = 'opportunity' AND w.status = 'complete' AND w.retired_at IS NULL
       AND w.is_demo = (_demo OR private.is_synthetic_account()) AND (_property IS NULL OR w.property_id = _property)
       -- Forward-only: completions before the feature start are never backfilled into the queue.
       AND w.completed_at >= coalesce((SELECT (value #>> '{}')::timestamptz FROM app_settings WHERE key = 'owner_completion_review_start'), now())
       AND (private.is_staff(auth.uid()) OR public.is_onboarding_staff(auth.uid()))
       AND private.onboarding_scope_ok(auth.uid(), w.property_id)
  )
  SELECT b.id, b.property_id, coalesce(pp.nickname, pp.name, pp.address_line1),
    b.title, coalesce(op.full_name, 'Homeowner'), b.completed_at,
    pm.project_manager, pmp.full_name, pm.project_manager IS NULL,
    ((SELECT count(*) FROM documents d WHERE d.work_item_id = b.id AND d.deleted_at IS NULL)
      + (SELECT count(*) FROM work_item_resources r WHERE r.work_item_id = b.id AND r.removed_at IS NULL))::int,
    coalesce(m.body, b.owner_response -> -1 ->> 'text'), coalesce(m.created_at, b.responded_at),
    coalesce(rv.status, 'needs_review'), rv.created_at, rvp.full_name, rv.internal_note, rv.follow_up_task_id,
    (rv.created_at IS NOT NULL AND (coalesce(m.created_at, b.responded_at) > rv.created_at OR b.completed_at > rv.created_at
      OR EXISTS (SELECT 1 FROM documents d WHERE d.work_item_id = b.id AND d.created_at > rv.created_at))),
    b.source_task_id
  FROM base b
  LEFT JOIN properties pp ON pp.id = b.property_id
  LEFT JOIN owner_programs prg ON prg.id = b.program_id
  LEFT JOIN profiles op ON op.id = prg.owner_user_id
  LEFT JOIN LATERAL (SELECT project_manager FROM onboarding_projects o WHERE o.property_id = b.property_id AND o.status <> 'cancelled' ORDER BY o.created_at DESC LIMIT 1) pm ON true
  LEFT JOIN profiles pmp ON pmp.id = pm.project_manager
  LEFT JOIN LATERAL (SELECT body, created_at FROM owner_request_messages x WHERE x.work_item_id = b.id AND x.author_type = 'homeowner' ORDER BY created_at DESC LIMIT 1) m ON true
  LEFT JOIN LATERAL (SELECT * FROM owner_completion_reviews r WHERE r.work_item_id = b.id ORDER BY created_at DESC LIMIT 1) rv ON true
  LEFT JOIN profiles rvp ON rvp.id = rv.actor_id
  ORDER BY (coalesce(rv.status,'needs_review') = 'reviewed'), b.completed_at DESC NULLS LAST
$function$
;