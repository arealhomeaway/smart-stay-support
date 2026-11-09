-- Practice run for 01_record_work.sql. Ends in ROLLBACK: nothing is kept.
-- Run: psql -v ON_ERROR_STOP=1 -f practice_cancel.sql (from this folder)
-- Real home: 1012 Wasatch Ct. Real Property Coordinator (Property Operations day role).
\set ON_ERROR_STOP 1
BEGIN;
\i 01_record_work.sql

CREATE TEMP TABLE rw_before AS
SELECT (SELECT count(*) FROM public.tickets) tickets,
       (SELECT count(*) FROM public.property_activity_log) activity,
       (SELECT count(*) FROM public.staff_notifications) alerts,
       (SELECT count(*) FROM public.escalations) escalations;
GRANT SELECT ON rw_before TO authenticated;

SELECT set_config('request.jwt.claims', '{"sub":"1a4b8de5-0824-4066-8691-8e6bb912f964","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;

\echo '--- who will do it (preview), Immediate maintenance and no problem type'
SELECT * FROM public.record_work_route_preview((SELECT id FROM public.work_types WHERE name = 'Immediate maintenance'));
SELECT * FROM public.record_work_route_preview(NULL);

\echo '--- Create ticket: The refrigerator is not cold. (Repair Yes -> maintenance)'
INSERT INTO public.tickets (is_demo, record_type, title, description, property_id, work_type_id, entry_kind,
  maintenance_category, category, guest_impact, occupancy_status, suggested_priority, priority, source_channel,
  reported_at, response_due_at, action_due_at, acknowledged_at, due_at, created_by, record_owner, accountable_owner, status)
SELECT false, 'active_task', 'PRACTICE The refrigerator is not cold.', 'PRACTICE The refrigerator is not cold.',
  'cc77a4df-0fa2-466d-bd6d-8c4217e84b03', wt.id, 'maintenance', 'appliance', wt.category, 'none', 'vacant', 'p2', 'p2',
  'guest_message', now(), now() + interval '30 minutes', now() + interval '60 minutes', now(), now() + interval '60 minutes',
  auth.uid(), auth.uid(), auth.uid(), 'open'
FROM public.work_types wt WHERE wt.name = 'Immediate maintenance';

SELECT t.ref, t.entry_kind, t.priority, (t.assigned_to IS NOT NULL) has_owner,
       (SELECT string_agg(fr.code, ',') FROM public.functional_roles fr WHERE fr.current_seat_holder = t.assigned_to) owner_roles,
       t.assignment_source, t.assignment_note
FROM public.tickets t WHERE t.title = 'PRACTICE The refrigerator is not cold.';

\echo '--- Create ticket with no problem type (Not sure yet): a supervisor sorts it'
INSERT INTO public.tickets (is_demo, record_type, title, description, property_id, work_type_id, entry_kind, category,
  guest_impact, occupancy_status, suggested_priority, priority, source_channel, reported_at, response_due_at, action_due_at,
  acknowledged_at, due_at, created_by, record_owner, accountable_owner, status)
VALUES (false, 'active_task', 'PRACTICE Something odd at the home.', 'PRACTICE Something odd at the home.',
  'cc77a4df-0fa2-466d-bd6d-8c4217e84b03', NULL, 'ops', 'other', 'none', 'vacant', 'p3', 'p3', 'guest_message', now(),
  now() + interval '4 hours', now() + interval '8 hours', now(), now() + interval '8 hours', auth.uid(), auth.uid(), auth.uid(), 'open');
SELECT t.entry_kind, (SELECT string_agg(fr.code, ',') FROM public.functional_roles fr WHERE fr.current_seat_holder = t.assigned_to) owner_roles, t.assignment_note
FROM public.tickets t WHERE t.title = 'PRACTICE Something odd at the home.';

\echo '--- One touch: saved to home history only'
CREATE TEMP TABLE rw_mid AS SELECT (SELECT count(*) FROM public.tickets) tickets, (SELECT count(*) FROM public.staff_notifications) alerts;
INSERT INTO public.property_activity_log (property_id, category, what_happened, outcome, logged_by, is_demo, problem_type_id, one_touch)
SELECT 'cc77a4df-0fa2-466d-bd6d-8c4217e84b03', 'property_condition', 'PRACTICE The refrigerator is not cold.', 'Nothing more to do.', auth.uid(), false, wt.id, true
FROM public.work_types wt WHERE wt.name = 'Immediate maintenance';
SELECT (SELECT count(*) FROM public.tickets) - m.tickets new_tickets, (SELECT count(*) FROM public.staff_notifications) - m.alerts new_alerts FROM rw_mid m;

\echo '--- Repeat count after ticket + one touch (expect 2, not flagged), then third time (expect 3, flagged)'
SELECT * FROM public.home_problem_repeat('cc77a4df-0fa2-466d-bd6d-8c4217e84b03', (SELECT id FROM public.work_types WHERE name = 'Immediate maintenance'));
INSERT INTO public.property_activity_log (property_id, category, what_happened, outcome, logged_by, is_demo, problem_type_id, one_touch)
SELECT 'cc77a4df-0fa2-466d-bd6d-8c4217e84b03', 'property_condition', 'PRACTICE The fridge is warm again.', 'Nothing more to do.', auth.uid(), false, wt.id, true
FROM public.work_types wt WHERE wt.name = 'Immediate maintenance';
SELECT * FROM public.home_problem_repeat('cc77a4df-0fa2-466d-bd6d-8c4217e84b03', (SELECT id FROM public.work_types WHERE name = 'Immediate maintenance'));
SELECT problem_type, times, window_days FROM public.home_repeat_flags('cc77a4df-0fa2-466d-bd6d-8c4217e84b03', NULL);
SELECT count(*) weekly_list_rows_for_home FROM public.home_repeat_flags(NULL, now() - interval '7 days') WHERE property_id = 'cc77a4df-0fa2-466d-bd6d-8c4217e84b03';

\echo '--- Escalate now: creator escalates, Supervisor alerted once, twice is safe'
SELECT public.record_work_escalate((SELECT id FROM public.tickets WHERE title = 'PRACTICE The refrigerator is not cold.')) IS NOT NULL escalated;
SELECT public.record_work_escalate((SELECT id FROM public.tickets WHERE title = 'PRACTICE The refrigerator is not cold.')) IS NOT NULL escalated_again;
RESET ROLE;
SELECT t.escalation_level, (t.escalated_at IS NOT NULL) escalated_at_set,
  (SELECT count(*) FROM public.escalations e WHERE e.ticket_id = t.id AND e.status = 'open') open_escalations,
  (SELECT count(*) FROM public.staff_notifications n WHERE n.entity_id = t.id AND n.kind = 'ticket_escalated') supervisor_alerts,
  (SELECT bool_and(n.user_id = fr.current_seat_holder) FROM public.staff_notifications n, public.functional_roles fr
     WHERE n.entity_id = t.id AND n.kind = 'ticket_escalated' AND fr.code = 'ops_supervisor') alert_went_to_supervisor,
  (SELECT string_agg(DISTINCT n.email_status, ',') FROM public.staff_notifications n WHERE n.entity_id = t.id AND n.kind = 'ticket_escalated') email_status,
  (SELECT count(*) FROM public.ticket_activity a WHERE a.ticket_id = t.id AND a.event_type = 'escalated') history_lines
FROM public.tickets t WHERE t.title = 'PRACTICE The refrigerator is not cold.';

\echo '--- Someone else cannot escalate it from here'
SELECT set_config('request.jwt.claims', '{"sub":"29380b2b-a59f-4de4-8588-7bcfebfc2d36","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
  PERFORM public.record_work_escalate((SELECT id FROM public.tickets WHERE title = 'PRACTICE The refrigerator is not cold.'));
  RAISE NOTICE 'NOT REFUSED';
EXCEPTION WHEN raise_exception THEN RAISE NOTICE 'refused: %', SQLERRM; END $$;
RESET ROLE;

ROLLBACK;

\echo '--- after rollback: nothing kept'
SELECT (SELECT count(*) FROM public.tickets WHERE title LIKE 'PRACTICE %') practice_tickets,
       (SELECT count(*) FROM public.property_activity_log WHERE what_happened LIKE 'PRACTICE %') practice_history,
       (SELECT count(*) FROM pg_proc WHERE proname IN ('record_work_escalate','home_problem_repeat')) new_functions,
       (SELECT count(*) FROM public.app_settings WHERE key = 'record_work_repeat') setting_rows;
