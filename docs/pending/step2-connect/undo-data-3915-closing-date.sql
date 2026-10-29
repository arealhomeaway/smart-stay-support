-- Undo for data-3915-closing-date.sql. Restores the exact before values read on 2026-10-29.
-- audit_log blocks deletes by design, so the undo adds a reversal history row instead of removing the correction.
UPDATE public.properties
   SET planned_closing_on = DATE '2026-09-24', actual_closing_on = DATE '2026-09-24'
 WHERE id = '9de75678-9e34-4219-a186-ed0da15f0092'
   AND planned_closing_on = DATE '2026-09-23' AND actual_closing_on = DATE '2026-09-23';

UPDATE public.onboarding_projects
   SET planned_closing_on = DATE '2026-09-24'
 WHERE id = '94338f4a-4a97-4268-869a-79ed103bbc8b' AND planned_closing_on = DATE '2026-09-23';

INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, reason, before_value, after_value)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'actual_closing_corrected', 'property',
        '9de75678-9e34-4219-a186-ed0da15f0092', '3915 W 104th St. S.',
        'Reverted the closing date correction',
        jsonb_build_object('planned_closing_on', '2026-09-23', 'actual_closing_on', '2026-09-23'),
        jsonb_build_object('planned_closing_on', '2026-09-24', 'actual_closing_on', '2026-09-24'));
