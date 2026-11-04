-- Undo for 02_allow_app_recovery_values.sql. Restores the captured checks.
-- Fails (and changes nothing) if any row already uses a widened value.
ALTER TABLE public.guest_recovery DROP CONSTRAINT guest_recovery_authority_level_check;
ALTER TABLE public.guest_recovery ADD CONSTRAINT guest_recovery_authority_level_check
  CHECK (authority_level IS NULL OR authority_level = ANY (ARRAY['self','supervisor','director','owner','emergency']));
ALTER TABLE public.guest_recovery DROP CONSTRAINT guest_recovery_recovery_action_check;
ALTER TABLE public.guest_recovery ADD CONSTRAINT guest_recovery_recovery_action_check
  CHECK (recovery_action IS NULL OR recovery_action = ANY (ARRAY['none','apology','mitigation','credit','partial_refund','full_refund','fee_waiver','shorten_stay','relocation']));
