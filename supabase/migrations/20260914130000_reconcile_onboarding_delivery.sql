-- Unapplied. Preserve every human reconciliation before releasing an uncertain claim.
ALTER TABLE public.approvals ADD COLUMN onboarding_delivery_history jsonb NOT NULL DEFAULT '[]';
ALTER TABLE public.financial_requests ADD COLUMN onboarding_delivery_history jsonb NOT NULL DEFAULT '[]';
CREATE FUNCTION public.reconcile_onboarding_delivery(_kind text,_record_id uuid,_attempt_id uuid,_delivered boolean,_note text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE target_table text; row_data jsonb; attempt jsonb; history jsonb; sent_field text; affected integer;
BEGIN
 IF _delivered IS NULL THEN RAISE EXCEPTION 'Choose a verified delivery outcome.'; END IF;
 IF auth.uid() IS NULL OR NOT public.is_onboarding_staff(auth.uid()) THEN RAISE EXCEPTION 'Only onboarding staff can reconcile delivery.'; END IF;
 IF length(trim(coalesce(_note,''))) < 10 THEN RAISE EXCEPTION 'Record how delivery was verified, including the mailbox evidence.'; END IF;
 target_table := CASE _kind WHEN 'approval' THEN 'approvals' WHEN 'accounting' THEN 'financial_requests' END;
 IF target_table IS NULL THEN RAISE EXCEPTION 'Unsupported delivery record.'; END IF;
 sent_field := CASE _kind WHEN 'approval' THEN 'owner_email_sent_at' ELSE 'accounting_sent_at' END;
 EXECUTE format('SELECT to_jsonb(r) FROM public.%I r WHERE id=$1 FOR UPDATE',target_table) INTO row_data USING _record_id;
 IF row_data IS NULL THEN RAISE EXCEPTION 'That delivery record is not available.'; END IF;
 attempt := row_data->'onboarding_delivery_attempt';
 IF attempt->>'id' IS DISTINCT FROM _attempt_id::text OR coalesce(attempt->>'state','sending') NOT IN ('uncertain','sent_unrecorded') THEN
  RAISE EXCEPTION 'The attempt changed or is still running. Refresh before reconciling.';
 END IF;
 IF row_data->>sent_field IS NOT NULL THEN RAISE EXCEPTION 'Delivery is already recorded.'; END IF;
 IF NOT _delivered AND attempt->>'state'='sent_unrecorded' THEN RAISE EXCEPTION 'The provider accepted this email. Record its delivery instead of retrying.'; END IF;
 IF _kind='accounting' AND row_data->>'status' <> 'invoiced' THEN RAISE EXCEPTION 'The accounting request changed. Review its status.'; END IF;
 history := coalesce(row_data->'onboarding_delivery_history','[]'::jsonb) || jsonb_build_array(attempt || jsonb_build_object('delivered',_delivered,'reconciledBy',auth.uid(),'reconciledAt',now(),'verification',trim(_note)));
 EXECUTE format('UPDATE public.%I SET onboarding_delivery_history=$1,onboarding_delivery_attempt=$2 WHERE id=$3',target_table)
 USING history,CASE WHEN _delivered THEN attempt || jsonb_build_object('state','confirmed_sent') ELSE NULL END,_record_id;
 GET DIAGNOSTICS affected = ROW_COUNT;
 IF affected <> 1 THEN RAISE EXCEPTION 'Delivery reconciliation could not be recorded.'; END IF;
 IF _delivered AND _kind='approval' THEN
  UPDATE public.approvals SET owner_email_to=attempt->>'recipient',owner_email_sent_at=(attempt->>'attemptedAt')::timestamptz,external_reference='email:' || (attempt->>'recipient') WHERE id=_record_id;
 ELSIF _delivered THEN
  UPDATE public.financial_requests SET accounting_recipient=attempt->>'recipient',accounting_sent_at=(attempt->>'attemptedAt')::timestamptz,status='sent_to_accounting',updated_at=now() WHERE id=_record_id;
 END IF;
 IF _delivered AND NOT FOUND THEN RAISE EXCEPTION 'The delivery receipt could not be recorded.'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.reconcile_onboarding_delivery(text,uuid,uuid,boolean,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reconcile_onboarding_delivery(text,uuid,uuid,boolean,text) TO authenticated;
