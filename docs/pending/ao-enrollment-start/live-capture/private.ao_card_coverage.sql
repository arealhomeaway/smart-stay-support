CREATE OR REPLACE FUNCTION private.ao_card_coverage(_property uuid, _code text, _task uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record;
BEGIN
  IF _task IS NOT NULL THEN
    SELECT o.id, o.title INTO r FROM public.owner_reviews o
      WHERE o.onboarding_task_id = _task AND o.archived_at IS NULL ORDER BY o.created_at LIMIT 1;
    IF FOUND THEN RETURN jsonb_build_object('reason','linked_task','source','owner_review','item_id',r.id,'item_title',r.title); END IF;
    SELECT w.id, w.title INTO r FROM public.work_items w
      WHERE w.kind = 'opportunity' AND (w.source_task_id = _task OR w.linked_task_id = _task)
        AND w.retired_at IS NULL AND w.status <> 'archived' ORDER BY w.created_at LIMIT 1;
    IF FOUND THEN RETURN jsonb_build_object('reason','linked_task','source','work_item','item_id',r.id,'item_title',r.title); END IF;
  END IF;
  SELECT o.id, o.title, m.id AS map_id INTO r FROM public.owner_reviews o
    JOIN public.ao_card_item_map m ON m.card_code = _code AND m.status = 'confirmed'
      AND ((m.match_kind = 'template_id' AND o.template_id::text = m.match_value)
        OR (m.match_kind = 'title_pattern' AND o.title ILIKE m.match_value))
    WHERE o.archived_at IS NULL
      AND (o.property_id = _property OR (o.property_id IS NULL AND EXISTS (
            SELECT 1 FROM public.owner_programs p WHERE p.id = o.program_id AND p.property_id = _property)))
      AND NOT EXISTS (SELECT 1 FROM public.ao_home_plan_cards pc WHERE pc.owner_review_id = o.id)
    ORDER BY o.created_at LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('reason','confirmed_map','source','owner_review','item_id',r.id,'item_title',r.title,'map_id',r.map_id); END IF;
  SELECT w.id, w.title, m.id AS map_id INTO r FROM public.work_items w
    JOIN public.ao_card_item_map m ON m.card_code = _code AND m.status = 'confirmed'
      AND ((m.match_kind = 'template_id' AND w.library_template_id::text = m.match_value)
        OR (m.match_kind = 'title_pattern' AND w.title ILIKE m.match_value))
    WHERE w.kind = 'opportunity' AND w.property_id = _property AND w.retired_at IS NULL AND w.status <> 'archived'
    ORDER BY w.created_at LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('reason','confirmed_map','source','work_item','item_id',r.id,'item_title',r.title,'map_id',r.map_id); END IF;
  RETURN NULL;
END $function$
;

