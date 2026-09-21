ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS guest_recovery_needed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guest_recovery_flagged_at timestamptz,
  ADD COLUMN IF NOT EXISTS guest_recovery_flagged_by uuid;

COMMENT ON COLUMN public.tickets.guest_recovery_needed IS
  'Documented on the ticket: this failure resulted in guest recovery. The recovery record itself lives in public.guest_recovery, linked by ticket_id.';

CREATE INDEX IF NOT EXISTS tickets_guest_recovery_needed_idx
  ON public.tickets (guest_recovery_needed)
  WHERE guest_recovery_needed;

CREATE INDEX IF NOT EXISTS guest_recovery_ticket_idx
  ON public.guest_recovery (ticket_id);

CREATE OR REPLACE VIEW public.guest_recovery_ledger
WITH (security_invoker = true) AS
SELECT
  gr.id                       AS recovery_id,
  gr.created_at               AS logged_at,
  gr.updated_at               AS last_updated_at,
  gr.stage,
  gr.outcome,
  gr.approval_status,
  gr.authority_level,
  gr.recovery_action,
  gr.within_airbnb_policy,
  gr.escalation_flags,
  gr.policy_version,
  gr.currency,
  gr.guest_requested_amount,
  gr.proposed_amount,
  gr.approved_amount,
  gr.delivered_amount,
  gr.delivered_on,
  gr.issued_on,
  gr.closed_at,
  gr.approved_at,
  gr.approved_by,
  gr.assigned_to,
  gr.created_by,
  gr.guest_name,
  gr.reservation_channel,
  gr.stay_arrival,
  gr.stay_departure,
  gr.is_demo,
  t.id                        AS ticket_id,
  t.title                     AS ticket_title,
  t.category                  AS ticket_category,
  t.priority                  AS ticket_priority,
  t.status                    AS ticket_status,
  t.created_at                AS ticket_created_at,
  t.guest_recovery_needed,
  p.id                        AS property_id,
  p.name                      AS property_name,
  p.city                      AS property_city,
  p.state                     AS property_state
FROM public.guest_recovery gr
JOIN public.tickets t ON t.id = gr.ticket_id
LEFT JOIN public.properties p ON p.id = gr.property_id;

COMMENT ON VIEW public.guest_recovery_ledger IS
  'Reporting surface for guest recovery: every recovery with its ticket and home, amounts proposed/approved/issued, approval authority and timing. Intended as the Finance dashboard source once the Finance workspace ships.';

GRANT SELECT ON public.guest_recovery_ledger TO authenticated;
GRANT ALL ON public.guest_recovery_ledger TO service_role;