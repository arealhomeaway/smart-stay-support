-- A narrow read boundary; owners still have no SELECT grant/policy on internal Work Orders.
-- Eligibility and metadata use one statement snapshot. Completed program history remains readable.
CREATE OR REPLACE FUNCTION public.read_owner_ticket_authority(
  _program_id uuid, _property_ids uuid[], _preview boolean DEFAULT false
) RETURNS TABLE (
  id uuid, ticket_id uuid, property_id uuid, phase text, quote_amount numeric,
  approved_amount numeric, approval_id uuid, approval_status text,
  contractual_exception boolean, emergency_reason text,
  receipt_id uuid, receipt_status text, receipt_amount numeric, receipt_decided_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT w.id, w.ticket_id, w.property_id, w.phase, w.quote_amount,
    w.approved_amount, w.approval_id, w.approval_status, w.contractual_exception,
    CASE WHEN length(trim(w.emergency_reason)) > 0 THEN 'Emergency basis recorded' ELSE NULL END,
    a.id, a.status, a.amount, a.decided_at
  FROM public.owner_programs p
  JOIN public.property_owners o ON o.id = p.owner_record_id AND o.active
  JOIN public.owner_program_properties e ON e.program_id = p.id AND e.inclusion_status = 'included'
  JOIN public.properties h ON h.id = e.property_id AND h.owner_record_id = o.id AND h.is_demo = p.is_demo
  JOIN public.tickets t ON t.property_id = h.id AND t.is_demo = p.is_demo
  JOIN public.work_orders w ON w.ticket_id = t.id AND w.property_id = h.id AND w.is_demo = p.is_demo
  LEFT JOIN public.approvals a ON a.id = w.approval_id AND a.entity_type = 'work_order'
    AND a.entity_id = w.id AND a.property_id = h.id AND a.approver_role = 'owner' AND a.is_demo = p.is_demo
  WHERE p.id = _program_id AND p.archived_at IS NULL
    AND h.id = ANY(_property_ids) AND cardinality(_property_ids) BETWEEN 1 AND 100
    AND auth.uid() IS NOT NULL
    AND ((_preview IS TRUE AND public.has_role(auth.uid(), 'admin'))
      OR (_preview IS FALSE AND p.owner_user_id = auth.uid() AND p.is_demo = false));
$$;
REVOKE ALL ON FUNCTION public.read_owner_ticket_authority(uuid, uuid[], boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.read_owner_ticket_authority(uuid, uuid[], boolean) TO authenticated;
