-- Escalations: a formal request for supervisory judgement, separate from assignment.
CREATE TABLE public.escalations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  escalated_by uuid NOT NULL REFERENCES auth.users(id),
  -- 'supervisor' or 'director'
  escalated_to_role text NOT NULL,
  escalated_to uuid REFERENCES auth.users(id),
  reason text NOT NULL,
  already_tried text,
  help_needed text,
  urgency text NOT NULL DEFAULT 'normal',
  status text NOT NULL DEFAULT 'open',
  outcome text,
  outcome_note text,
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT escalations_role_ck CHECK (escalated_to_role IN ('supervisor','director')),
  CONSTRAINT escalations_status_ck CHECK (status IN ('open','resolved','withdrawn')),
  CONSTRAINT escalations_outcome_ck CHECK (outcome IS NULL OR outcome IN ('guidance','takeover','reassigned')),
  CONSTRAINT escalations_urgency_ck CHECK (urgency IN ('normal','high','critical'))
);

CREATE INDEX escalations_ticket_idx ON public.escalations(ticket_id);
CREATE INDEX escalations_open_idx ON public.escalations(status, escalated_to_role);

GRANT SELECT, INSERT, UPDATE ON public.escalations TO authenticated;
GRANT ALL ON public.escalations TO service_role;

ALTER TABLE public.escalations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Internal staff read escalations"
  ON public.escalations FOR SELECT TO authenticated
  USING (public.is_internal_staff(auth.uid()));

CREATE POLICY "Internal staff raise escalations"
  ON public.escalations FOR INSERT TO authenticated
  WITH CHECK (public.is_internal_staff(auth.uid()) AND escalated_by = auth.uid());

CREATE POLICY "Raiser or supervisor updates escalations"
  ON public.escalations FOR UPDATE TO authenticated
  USING (public.is_supervisor(auth.uid()) OR escalated_by = auth.uid())
  WITH CHECK (public.is_supervisor(auth.uid()) OR escalated_by = auth.uid());

CREATE TRIGGER escalations_updated_at
  BEFORE UPDATE ON public.escalations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Final Review (formerly "closure QA") reviewer trail on the ticket itself.
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS final_review_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS final_review_at timestamptz,
  ADD COLUMN IF NOT EXISTS final_review_note text;

-- Manual homeowner email decisions recorded against the canonical approval.
ALTER TABLE public.approvals
  ADD COLUMN IF NOT EXISTS response_channel text,
  ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS responded_at timestamptz;