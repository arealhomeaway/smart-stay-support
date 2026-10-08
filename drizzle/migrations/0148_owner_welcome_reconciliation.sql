-- Additive function only. No existing rows, statuses, or policy grants are changed.
-- Deploy before the reconciliation UI. This migration is staged, not applied.
CREATE OR REPLACE FUNCTION public.reconcile_owner_welcome(_id uuid, _outcome text, _reason text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.owner_welcome_messages; next_status text;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    coalesce(public.is_onboarding_director(auth.uid()), false)
    OR coalesce(public.has_role(auth.uid(), 'admin'), false)
    OR coalesce(public.has_role(auth.uid(), 'manager'), false)
  ) THEN RAISE EXCEPTION 'Only a supervisor or the Onboarding Director can reconcile a welcome.'; END IF;
  IF private.is_synthetic_account() THEN
    RAISE EXCEPTION 'Test accounts cannot reconcile real welcome deliveries.';
  END IF;
  IF _outcome IS NULL OR _outcome NOT IN ('delivered', 'not_delivered')
    OR length(trim(coalesce(_reason,''))) NOT BETWEEN 5 AND 1000 THEN
    RAISE EXCEPTION 'Choose an outcome and record the mailbox/provider evidence.';
  END IF;
  SELECT * INTO w FROM public.owner_welcome_messages WHERE id=_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Welcome not found.'; END IF;
  IF w.is_demo OR w.recipient ~* '@(resolve-test\.invalid|[^@]+\.(invalid|test|example))$' THEN
    RAISE EXCEPTION 'Demo and test welcomes cannot be reconciled for sending.';
  END IF;
  -- Only a completed, ambiguous attempt can be reconciled; an in-flight send cannot.
  IF w.status <> 'sending' OR coalesce(w.error_message,'') NOT LIKE 'Delivery uncertain: %' THEN
    RAISE EXCEPTION 'This welcome is not awaiting delivery reconciliation. Refresh its status.';
  END IF;
  next_status := CASE WHEN _outcome='delivered' THEN 'sent' ELSE 'failed' END;
  UPDATE public.owner_welcome_messages SET status=next_status,
    error_message=CASE WHEN _outcome='delivered' THEN NULL ELSE 'Non-delivery confirmed: ' || trim(_reason) END
    WHERE id=w.id;
  -- sent_at is intentionally unchanged: the time of reconciliation is not the time of sending.
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, reason, before_value, after_value)
    VALUES(auth.uid(), 'owner_welcome.reconciled', 'owner_welcome_message', w.id, trim(_reason),
      jsonb_build_object('status',w.status,'attempts',w.attempts,'error',w.error_message),
      jsonb_build_object('status',next_status,'outcome',_outcome));
  RETURN jsonb_build_object('status',next_status,'reconciled',true);
END $$;
REVOKE ALL ON FUNCTION public.reconcile_owner_welcome(uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconcile_owner_welcome(uuid,text,text) TO authenticated;
