-- Keep cost and approval receipt in one statement snapshot, reusing canonical enrollment authorization.
CREATE FUNCTION public.read_owner_ticket_financial_context(_program_id uuid,_property_ids uuid[],_preview boolean DEFAULT false)
RETURNS TABLE(
 id uuid,ticket_id uuid,property_id uuid,phase text,quote_amount numeric,approved_amount numeric,
 approval_id uuid,approval_status text,contractual_exception boolean,emergency_reason text,
 receipt_id uuid,receipt_status text,receipt_amount numeric,receipt_decided_at timestamptz,final_cost numeric
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
 SELECT a.id,a.ticket_id,a.property_id,a.phase,a.quote_amount,a.approved_amount,a.approval_id,a.approval_status,
  a.contractual_exception,a.emergency_reason,a.receipt_id,a.receipt_status,a.receipt_amount,a.receipt_decided_at,w.final_cost
 FROM public.read_owner_ticket_authority(_program_id,_property_ids,_preview) a
 JOIN public.work_orders w ON w.id=a.id AND w.ticket_id=a.ticket_id AND w.property_id=a.property_id;
$$;
REVOKE ALL ON FUNCTION public.read_owner_ticket_financial_context(uuid,uuid[],boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.read_owner_ticket_financial_context(uuid,uuid[],boolean) TO authenticated;
