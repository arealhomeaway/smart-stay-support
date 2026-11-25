-- Undo: put back each check's team and each ticket's role from the audit row's saved values.
SELECT set_config('resolve.arrival_check_writing', 'on', true);
WITH a AS (SELECT after_value v FROM public.audit_log WHERE action = 'arrival_checks.move_team_a' ORDER BY created_at DESC LIMIT 1)
UPDATE public.arrival_checks c SET team = x->>'old_team'
FROM a, jsonb_array_elements(a.v->'checks') x WHERE c.id = (x->>'id')::uuid;
WITH a AS (SELECT after_value v FROM public.audit_log WHERE action = 'arrival_checks.move_team_a' ORDER BY created_at DESC LIMIT 1)
UPDATE public.tickets t SET functional_role_code = x->>'old_role'
FROM a, jsonb_array_elements(a.v->'tickets') x WHERE t.id = (x->>'id')::uuid;
SELECT set_config('resolve.arrival_check_writing', '', true);
