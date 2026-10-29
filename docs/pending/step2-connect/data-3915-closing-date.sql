-- PENDING DATA SCRIPT. Do not run until approved. Emily confirmed the closing date is 2026-09-23.
-- Home: 3915 W 104th St. S. (9de75678-9e34-4219-a186-ed0da15f0092)
-- Rows and fields this changes:
--   properties 9de75678-...0092: planned_closing_on 2026-09-24 -> 2026-09-23; actual_closing_on 2026-09-24 -> 2026-09-23
--   onboarding_projects 94338f4a-4a97-4268-869a-79ed103bbc8b: planned_closing_on 2026-09-24 -> 2026-09-23
--   audit_log: 2 new history rows (actor Emily Jimenez 98bd6696-4018-4965-b645-0471c5ae3925)
-- Unchanged on purpose: owner_program_properties f4b651b8-... already 2026-09-23 (confirmed);
--   owner_programs 6cc0d779-... started_on 2026-09-22 (earliest home, Fitzgerald) stays.
-- Side effects checked: 0 open Tasks are scheduled from planned closing on this home, so no due dates move.
-- The guard each statement checks makes a second run change nothing.
UPDATE public.properties
   SET planned_closing_on = DATE '2026-09-23', actual_closing_on = DATE '2026-09-23'
 WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092'
   AND planned_closing_on = DATE '2026-09-24' AND actual_closing_on = DATE '2026-09-24';

UPDATE public.onboarding_projects
   SET planned_closing_on = DATE '2026-09-23'
 WHERE id = '94338f4a-4a97-4268-869a-79ed103bbc8b' AND planned_closing_on = DATE '2026-09-24';

INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, reason, before_value, after_value)
SELECT '98bd6696-4018-4965-b645-0471c5ae3925', 'actual_closing_corrected', 'property',
       '9de75678-9e34-4219-a186-ed0da15f0092', '3915 W 104th St. S.',
       'Corrected to the confirmed closing date (Emily Jimenez)',
       jsonb_build_object('planned_closing_on', '2026-09-24', 'actual_closing_on', '2026-09-24'),
       jsonb_build_object('planned_closing_on', '2026-09-23', 'actual_closing_on', '2026-09-23')
 WHERE NOT EXISTS (SELECT 1 FROM public.audit_log WHERE entity_id = '9de75678-9e34-4219-a186-ed0da15f0092'
   AND reason = 'Corrected to the confirmed closing date (Emily Jimenez)' AND entity_type = 'property');

INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, reason, before_value, after_value)
SELECT '98bd6696-4018-4965-b645-0471c5ae3925', 'planned_closing_corrected', 'onboarding_project',
       '94338f4a-4a97-4268-869a-79ed103bbc8b', '3915 W 104th St. S.',
       'Corrected to the confirmed closing date (Emily Jimenez)',
       jsonb_build_object('planned_closing_on', '2026-09-24'),
       jsonb_build_object('planned_closing_on', '2026-09-23')
 WHERE NOT EXISTS (SELECT 1 FROM public.audit_log WHERE entity_id = '94338f4a-4a97-4268-869a-79ed103bbc8b'
   AND reason = 'Corrected to the confirmed closing date (Emily Jimenez)');
