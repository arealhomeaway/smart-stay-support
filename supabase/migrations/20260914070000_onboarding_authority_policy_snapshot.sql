-- Unapplied. Existing requests keep their recorded tier; no policy is backfilled.
ALTER TABLE public.financial_requests ADD COLUMN authority_policy jsonb;
COMMENT ON COLUMN public.financial_requests.authority_policy IS
  'Approved policy version and thresholds captured when the request was created. Null means a legacy request; its recorded authority_tier remains authoritative.';
