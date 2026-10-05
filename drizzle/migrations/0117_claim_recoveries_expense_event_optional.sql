CREATE OR REPLACE FUNCTION private.guard_expense_recovery()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'private'
AS $function$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NOT NULL AND NOT private.is_accounting(me) AND (
     (TG_OP = 'INSERT' AND (NEW.received_amount <> 0 OR NEW.received_on IS NOT NULL))
     OR (TG_OP = 'UPDATE' AND (NEW.received_amount IS DISTINCT FROM OLD.received_amount OR NEW.received_on IS DISTINCT FROM OLD.received_on))) THEN
    RAISE EXCEPTION 'Only Finance can record money received';
  END IF;
  IF TG_OP = 'UPDATE' THEN NEW.updated_at := now(); END IF;
  -- Claim-level receipts without an expense allocation are logged on the claim timeline instead.
  IF NEW.expense_id IS NOT NULL THEN
    INSERT INTO public.expense_events(expense_id, actor_id, kind, before_value, after_value)
    VALUES (NEW.expense_id, me, 'recovery_' || lower(TG_OP), CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) END, to_jsonb(NEW));
  END IF;
  RETURN NEW;
END $function$;