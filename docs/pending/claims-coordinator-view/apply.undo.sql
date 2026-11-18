-- Undo claims-coordinator-view. Line items and platform log rows are kept as history;
-- the app loses access. Deadlines already defaulted stay as dates with source platform_default.
DROP TRIGGER IF EXISTS claims_default_filing_deadline ON public.claims;
DROP FUNCTION IF EXISTS public.claims_default_filing_deadline();
DROP TRIGGER IF EXISTS claim_line_items_total ON public.claim_line_items;
REVOKE ALL ON public.claim_line_items FROM authenticated;
REVOKE ALL ON public.claim_platform_log FROM authenticated;
INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'claims_coordinator_view.undo', 'table', 'claims coordinator view',
  'Undo of claims-coordinator-view; line items and platform log kept read-only for service.');
