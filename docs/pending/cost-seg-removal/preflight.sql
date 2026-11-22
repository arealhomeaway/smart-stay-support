-- Preflight for cost-seg-removal (read only). Every line must match the README before apply.
SELECT 'template step active' k, count(*)::text v FROM public.onboarding_template_tasks
 WHERE id='2dc6f929-eaa5-4e9c-afd0-56400784ad9e' AND title='Coordinate the cost segregation study' AND is_active
UNION ALL SELECT 'other active steps with this name', count(*)::text FROM public.onboarding_template_tasks
 WHERE title ILIKE '%cost segregation%' AND is_active AND id<>'2dc6f929-eaa5-4e9c-afd0-56400784ad9e'
UNION ALL SELECT 'open tasks on in-progress homes', count(*)::text FROM public.onboarding_tasks t JOIN public.onboarding_projects p ON p.property_id=t.property_id
 WHERE t.template_task_id='2dc6f929-eaa5-4e9c-afd0-56400784ad9e' AND t.archived_at IS NULL AND t.status<>'complete' AND p.status='active'
UNION ALL SELECT 'completed tasks (kept)', count(*)::text FROM public.onboarding_tasks
 WHERE template_task_id='2dc6f929-eaa5-4e9c-afd0-56400784ad9e' AND status='complete'
UNION ALL SELECT 'open tasks with links (cards, owner items, Breezeway, notes)', count(*)::text FROM public.onboarding_tasks t
 WHERE t.template_task_id='2dc6f929-eaa5-4e9c-afd0-56400784ad9e' AND t.status<>'complete' AND (
   EXISTS (SELECT 1 FROM public.ao_home_plan_cards x WHERE x.linked_task_id=t.id)
   OR EXISTS (SELECT 1 FROM public.owner_reviews x WHERE x.onboarding_task_id=t.id)
   OR EXISTS (SELECT 1 FROM public.breezeway_outbound_tasks x WHERE x.onboarding_task_id=t.id)
   OR EXISTS (SELECT 1 FROM public.onboarding_task_breezeway_links x WHERE x.task_id=t.id)
   OR EXISTS (SELECT 1 FROM public.owner_request_messages x WHERE x.task_id=t.id)
   OR EXISTS (SELECT 1 FROM public.onboarding_tasks c WHERE c.parent_task_id=t.id OR t.id = ANY(c.depends_on)))
UNION ALL SELECT 'already applied', count(*)::text FROM public.audit_log WHERE action='cost_seg_removal.apply';
