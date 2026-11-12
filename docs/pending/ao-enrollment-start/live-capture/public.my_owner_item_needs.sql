CREATE OR REPLACE FUNCTION public.my_owner_item_needs()
 RETURNS TABLE(review_id uuid, property_id uuid, task_id uuid, title text, why text, since timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  WITH items AS (
    SELECT r.id, r.property_id, s.task_id, r.title, r.respond_by, s.sent_at,
      (SELECT m.author_type FROM public.owner_request_messages m WHERE m.review_id = r.id AND m.event IS NULL ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_author,
      (SELECT m.created_at FROM public.owner_request_messages m WHERE m.review_id = r.id AND m.event IS NULL ORDER BY m.created_at DESC, m.id DESC LIMIT 1) AS last_at,
      EXISTS (SELECT 1 FROM public.owner_request_messages m WHERE m.review_id = r.id AND m.author_type = 'homeowner') AS owner_spoke
    FROM public.owner_item_task_sends s JOIN public.owner_reviews r ON r.id = s.review_id
    WHERE r.archived_at IS NULL AND r.status <> 'closed' AND private.owner_item_answerer(r.id) = auth.uid()
      AND coalesce(r.is_demo, false) = coalesce(private.is_synthetic_account(), false)
  )
  SELECT id, property_id, task_id, title,
         CASE WHEN last_author = 'homeowner' THEN 'The homeowner wrote back' ELSE 'No answer from the homeowner yet' END,
         CASE WHEN last_author = 'homeowner' THEN last_at ELSE (respond_by + 1)::timestamp AT TIME ZONE 'America/Chicago' END
  FROM items
  WHERE last_author = 'homeowner'
     OR (NOT owner_spoke AND respond_by IS NOT NULL AND respond_by < (now() AT TIME ZONE 'America/Chicago')::date)
  ORDER BY 6
$function$
;

