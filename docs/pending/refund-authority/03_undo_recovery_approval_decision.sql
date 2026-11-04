DROP TRIGGER IF EXISTS guard_recovery_decision_trg ON public.guest_recovery;
DROP FUNCTION IF EXISTS public.guard_recovery_decision();
DROP FUNCTION IF EXISTS public.decide_recovery_approval(uuid, text, numeric, text);
