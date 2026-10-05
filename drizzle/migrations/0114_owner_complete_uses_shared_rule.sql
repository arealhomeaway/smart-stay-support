CREATE OR REPLACE FUNCTION public.complete_owner_opportunity(_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
BEGIN
  UPDATE work_items w SET status='complete', completed_at=now(), viewed_at=coalesce(viewed_at, now())
   WHERE w.id=_id AND w.kind='opportunity' AND w.status NOT IN ('draft','archived') AND w.retired_at IS NULL
     AND public.owner_owns_program(w.program_id);
  IF NOT FOUND THEN RAISE EXCEPTION 'This Opportunity is not available to you.'; END IF;
  PERFORM private.notify_opportunity_staff(_id, 'completed');
END $function$;