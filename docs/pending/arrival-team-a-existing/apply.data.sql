-- Data-only equivalent of the approved 01_move_open_checks.sql.
-- Materialized snapshots replace temporary tables; filters and audit payload stay the same.
BEGIN;
SELECT set_config('resolve.arrival_check_writing', 'on', true);
WITH moved AS MATERIALIZED (
  SELECT id, team AS old_team, ticket_id FROM public.arrival_checks
  WHERE status = 'open' AND team IS DISTINCT FROM 'guest_experience' FOR UPDATE
), moved_tickets AS MATERIALIZED (
  SELECT t.id, t.functional_role_code AS old_role FROM public.tickets t
  WHERE t.id IN (SELECT ticket_id FROM public.arrival_checks WHERE status = 'open' AND ticket_id IS NOT NULL)
    AND t.status NOT IN ('resolved','closed') AND t.functional_role_code IS DISTINCT FROM 'ge_day' FOR UPDATE
), updated_checks AS (
  UPDATE public.arrival_checks SET team = 'guest_experience' WHERE id IN (SELECT id FROM moved) RETURNING id
), updated_tickets AS (
  UPDATE public.tickets SET functional_role_code = 'ge_day' WHERE id IN (SELECT id FROM moved_tickets) RETURNING id
)
INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason, after_value)
SELECT '98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'arrival_checks.move_team_a', 'table', 'arrival_checks',
  'Open arrival checks moved to Team A (Emily, Nov 25). Undo: docs/pending/arrival-team-a-existing/undo.',
  jsonb_build_object('checks', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'old_team', old_team)), '[]') FROM moved),
                     'tickets', (SELECT coalesce(jsonb_agg(jsonb_build_object('id', id, 'old_role', old_role)), '[]') FROM moved_tickets))
WHERE (SELECT count(*) FROM updated_checks) >= 0 AND (SELECT count(*) FROM updated_tickets) >= 0;
SELECT set_config('resolve.arrival_check_writing', '', true);
COMMIT;