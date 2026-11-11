-- Fix 4: the Admin owned Active Owner label, then put it on every home now included in a live,
-- not demo program (each add records who and when). Starts no plan. Apply after 02.
INSERT INTO public.property_labels(name, created_by, system_key)
SELECT 'Active Owner', '98bd6696-4018-4965-b645-0471c5ae3925', 'active_owner'
 WHERE NOT EXISTS (SELECT 1 FROM public.property_labels WHERE system_key = 'active_owner');
INSERT INTO public.property_label_events(label_id, property_id, action, to_name, actor_id, actor_label)
SELECT l.id, NULL, 'created', l.name, '98bd6696-4018-4965-b645-0471c5ae3925', 'Admin' FROM public.property_labels l
 WHERE l.system_key = 'active_owner'
   AND NOT EXISTS (SELECT 1 FROM public.property_label_events e WHERE e.label_id = l.id AND e.action = 'created');
SELECT h.property_id, private.ao_label_sync(h.property_id, '98bd6696-4018-4965-b645-0471c5ae3925') AS label
  FROM (SELECT DISTINCT e.property_id FROM public.owner_program_properties e
          JOIN public.owner_programs p ON p.id = e.program_id
         WHERE e.inclusion_status = 'included' AND e.archived_at IS NULL
           AND p.status = 'active' AND p.archived_at IS NULL AND NOT p.is_demo) h
 ORDER BY 1;
