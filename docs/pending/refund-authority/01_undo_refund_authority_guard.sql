-- Undo for 01_refund_authority_guard.sql. Removes only what 01 added.
DROP TRIGGER IF EXISTS guard_recovery_authority_trg ON public.guest_recovery;
DROP FUNCTION IF EXISTS public.guard_recovery_authority();
DROP FUNCTION IF EXISTS public.recovery_required_authority(text, numeric, boolean, text[]);
