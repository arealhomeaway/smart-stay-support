CREATE FUNCTION public.save_work_order_costs(
 _work_order_id uuid,_expected_updated_at timestamptz,_quote numeric,_second_quote numeric,_final_cost numeric,_scope text,_reason text
) RETURNS timestamptz LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE wo public.work_orders; amount numeric; changed_at timestamptz:=clock_timestamp();
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.is_internal_staff(auth.uid()),false) THEN RAISE EXCEPTION 'Only staff may record Work Order costs.'; END IF;
 IF length(trim(coalesce(_reason,''))) NOT BETWEEN 3 AND 2000 THEN RAISE EXCEPTION 'Explain the cost change or its supporting evidence.'; END IF;
 IF length(coalesce(_scope,''))>10000 THEN RAISE EXCEPTION 'The work scope is too long.'; END IF;
 FOREACH amount IN ARRAY ARRAY[_quote,_second_quote,_final_cost] LOOP
  IF amount IS NOT NULL AND (amount<0 OR amount>=10000000000 OR amount::text IN ('NaN','Infinity','-Infinity') OR amount<>round(amount,2)) THEN
   RAISE EXCEPTION 'Enter valid non-negative costs with at most two decimal places.';
  END IF;
 END LOOP;
 SELECT * INTO wo FROM public.work_orders WHERE id=_work_order_id FOR UPDATE;
 IF NOT FOUND OR _expected_updated_at IS NULL OR wo.updated_at IS DISTINCT FROM _expected_updated_at THEN RAISE EXCEPTION 'The Work Order changed. Review the current costs before saving.'; END IF;
 -- A recorded response must continue to describe the same quote and work scope.
 IF (wo.approval_id IS NOT NULL OR wo.supervisor_approval_id IS NOT NULL
  OR wo.approval_status IN ('pending','approved','info_requested') OR wo.supervisor_approval_status IN ('pending','approved'))
  AND (_quote IS DISTINCT FROM wo.quote_amount OR trim(coalesce(_scope,'')) IS DISTINCT FROM trim(coalesce(wo.scope,''))) THEN
  RAISE EXCEPTION 'An approval is linked to this quote and scope. A revised approval workflow is required before changing them.';
 END IF;
 UPDATE public.work_orders SET quote_amount=_quote,second_quote_amount=_second_quote,final_cost=_final_cost,
  scope=nullif(trim(coalesce(_scope,'')),''),quote_received_at=CASE WHEN _quote IS NULL THEN NULL ELSE coalesce(wo.quote_received_at,changed_at) END,
  authority_level=CASE WHEN _quote IS DISTINCT FROM wo.quote_amount THEN NULL ELSE wo.authority_level END,
  updated_at=changed_at WHERE id=wo.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'The costs could not be saved.'; END IF;
 INSERT INTO public.work_order_events(work_order_id,author_id,event_type,body,detail,is_demo)
 VALUES(wo.id,auth.uid(),'cost','Work Order costs recorded',jsonb_build_object(
  'reason',trim(_reason),'previous',jsonb_build_object('quote_amount',wo.quote_amount,'second_quote_amount',wo.second_quote_amount,'final_cost',wo.final_cost,'scope',wo.scope),
  'current',jsonb_build_object('quote_amount',_quote,'second_quote_amount',_second_quote,'final_cost',_final_cost,'scope',nullif(trim(coalesce(_scope,'')),'')),
  'approval_id',wo.approval_id,'supervisor_approval_id',wo.supervisor_approval_id,'policy_version',wo.policy_version),wo.is_demo);
 RETURN changed_at;
END $$;
REVOKE ALL ON FUNCTION public.save_work_order_costs(uuid,timestamptz,numeric,numeric,numeric,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_work_order_costs(uuid,timestamptz,numeric,numeric,numeric,text,text) TO authenticated,service_role;
