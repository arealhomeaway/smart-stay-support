SELECT (SELECT count(*) FROM public.arrival_checks WHERE status='open') open_checks,
  (SELECT count(*) FROM public.arrival_checks WHERE status='open' AND team IS DISTINCT FROM 'guest_experience') to_move,
  (SELECT count(*) FROM public.tickets t JOIN public.arrival_checks c ON c.ticket_id=t.id WHERE c.status='open' AND t.status NOT IN ('resolved','closed') AND t.functional_role_code IS DISTINCT FROM 'ge_day') tickets_to_move,
  to_regprocedure('private.arrival_check_team_a()') IS NOT NULL new_check_rule_live;
