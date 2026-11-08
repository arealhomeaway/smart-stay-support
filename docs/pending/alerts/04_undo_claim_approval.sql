-- Undo for 04_claim_approval.sql. No BEGIN/COMMIT.
-- Claim history lines written by the approval steps stay in claim_activity.
DROP TRIGGER guard_claim_approval ON public.claims;
DROP FUNCTION private.guard_claim_approval();
DROP FUNCTION public.decide_claim_approval(uuid, text, text);
DROP FUNCTION public.request_claim_approval(uuid, numeric);
DROP FUNCTION private.claim_required_authority(numeric);
ALTER TABLE public.claims
  DROP COLUMN approval_status,
  DROP COLUMN approval_authority,
  DROP COLUMN approval_amount,
  DROP COLUMN approval_requested_by,
  DROP COLUMN approval_requested_at,
  DROP COLUMN approval_decided_by,
  DROP COLUMN approval_decided_at,
  DROP COLUMN approval_reason;
