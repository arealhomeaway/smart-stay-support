-- ao-module-sync preflight (read only). Every row must say ok = true before apply.
SELECT 'not applied yet' AS check_name, NOT EXISTS (SELECT 1 FROM public.audit_log WHERE action = 'ao_module_sync.apply') AS ok
UNION ALL SELECT '3400 N Fern Avenue: Active Owner label, module off, live program with a login',
  EXISTS (SELECT 1 FROM public.onboarding_projects op JOIN public.properties h ON h.id = op.property_id
   WHERE op.id = 'b36734a1-af43-49f6-a732-01ba91c98df5' AND h.id = 'e0fc2763-1186-4b5a-9866-2bd9ff86f55d'
     AND op.owner_type = 'Active Owner' AND NOT ('active_owner' = ANY(op.modules)) AND NOT h.is_demo AND h.archived_at IS NULL
     AND EXISTS (SELECT 1 FROM public.owner_program_properties l JOIN public.owner_programs p ON p.id = l.program_id
       WHERE l.property_id = h.id AND l.inclusion_status = 'included' AND p.archived_at IS NULL AND p.status = 'active' AND p.owner_user_id IS NOT NULL))
UNION ALL SELECT '624 Daniel Court: Active Owner label, module off, live program with a login',
  EXISTS (SELECT 1 FROM public.onboarding_projects op JOIN public.properties h ON h.id = op.property_id
   WHERE op.id = 'e57c1c02-2600-4547-a3a9-cffa541ce4fc' AND h.id = '2ac3120b-cec9-4735-b4b6-c130bdab63fd'
     AND op.owner_type = 'Active Owner' AND NOT ('active_owner' = ANY(op.modules)) AND NOT h.is_demo AND h.archived_at IS NULL
     AND EXISTS (SELECT 1 FROM public.owner_program_properties l JOIN public.owner_programs p ON p.id = l.program_id
       WHERE l.property_id = h.id AND l.inclusion_status = 'included' AND p.archived_at IS NULL AND p.status = 'active' AND p.owner_user_id IS NOT NULL))
UNION ALL SELECT 'each home has exactly one onboarding project',
  (SELECT count(*) FROM public.onboarding_projects WHERE property_id IN ('e0fc2763-1186-4b5a-9866-2bd9ff86f55d','2ac3120b-cec9-4735-b4b6-c130bdab63fd')) = 2
UNION ALL SELECT 'no other live home has the label without the module (nothing else to touch)',
  (SELECT count(*) FROM public.onboarding_projects op JOIN public.properties h ON h.id = op.property_id
   WHERE op.owner_type = 'Active Owner' AND NOT ('active_owner' = ANY(op.modules)) AND NOT h.is_demo AND h.archived_at IS NULL) = 2;
