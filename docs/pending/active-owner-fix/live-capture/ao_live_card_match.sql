CREATE OR REPLACE FUNCTION private.ao_live_card_match(_property uuid, _task uuid, _template uuid, _title text)
 RETURNS TABLE(plan_card_id uuid, code text, title text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT pc.id, c.code, c.title FROM public.ao_home_plan_cards pc
  JOIN public.ao_library_cards c ON c.id = pc.card_id
  JOIN public.ao_home_plan_settings s ON s.property_id = pc.property_id AND s.automated
  WHERE pc.property_id = _property AND pc.join_outcome IN ('locked','open') AND pc.expired_at IS NULL
    AND ((_task IS NOT NULL AND pc.linked_task_id = _task)
      OR EXISTS (SELECT 1 FROM public.ao_card_item_map m WHERE m.card_code = c.code AND m.status = 'confirmed'
           AND ((m.match_kind = 'template_id' AND _template IS NOT NULL AND m.match_value = _template::text)
             OR (m.match_kind = 'title_pattern' AND coalesce(_title,'') ILIKE m.match_value))))
  ORDER BY (pc.linked_task_id IS NOT DISTINCT FROM _task) DESC, c.code LIMIT 1
$function$
;
