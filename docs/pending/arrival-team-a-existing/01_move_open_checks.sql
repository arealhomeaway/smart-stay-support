-- arrival-team-a-existing (Emily, Nov 25, change 3 answer 5). Moves the open arrival checks that already exist
-- to Team A the same way new ones go (arrival_check_team_a): the check's team and its ticket's role.
-- Only open checks; complete and cancelled checks and closed tickets keep their history. No owner, clock or status change.
SELECT set_config('resolve.arrival_check_writing', 'on', true);
CREATE TEMP TABLE _moved ON COMMIT DROP AS
  SELECT id, team AS old_team, ticket_id FROM public.arrival_checks WHERE status = 'open' AND team IS DISTINCT FROM 'guest_experience';
CREATE TEMP TABLE _moved_tickets ON COMMIT DROP AS
  SELECT t.id, t.functional_role_code AS old_role FROM public.tickets t
  WHERE t.id IN (SELECT ticket_id FROM public.arrival_checks WHERE status = 'open' AND ticket_id IS NOT NULL)
    AND t.status NOT IN ('resolved','closed') AND t.functional_role_code IS DISTINCT FROM 'ge_day';
UPDATE public.arrival_checks SET team = 'guest_experience' WHERE id IN (SELECT id FROM _moved);
UPDATE public.tickets SET functional_role_code = 'ge_day' WHERE id IN (SELECT id FROM _moved_tickets);
INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason, after_value)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'arrival_checks.move_team_a', 'table', 'arrival_checks',
  'Open arrival checks moved to Team A (Emily, Nov 25). Undo: docs/pending/arrival-team-a-existing/undo.',
  jsonb_build_object('checks', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'old_team', old_team)), '[]') FROM _moved),
                     'tickets', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'old_role', old_role)), '[]') FROM _moved_tickets)));
SELECT set_config('resolve.arrival_check_writing', '', true);
