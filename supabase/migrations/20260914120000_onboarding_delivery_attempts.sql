-- Unapplied: preserve an outbound attempt before crossing the email boundary.
ALTER TABLE public.approvals ADD COLUMN onboarding_delivery_attempt jsonb;
ALTER TABLE public.financial_requests ADD COLUMN onboarding_delivery_attempt jsonb;
COMMENT ON COLUMN public.approvals.onboarding_delivery_attempt IS 'Onboarding email attempt claim and outcome; uncertain attempts require reconciliation before retry.';
COMMENT ON COLUMN public.financial_requests.onboarding_delivery_attempt IS 'Accounting email attempt claim and outcome; uncertain attempts require reconciliation before retry.';
