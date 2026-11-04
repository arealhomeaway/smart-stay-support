-- Lets the database accept values the refund screens already write.
-- Today the live checks reject authority_level 'pc' (every coordinator-level
-- save) and the remedies courtesy_item, full_night_refund and other.
-- Widening only: every value allowed today stays allowed. No row changes.
DO $chk$
BEGIN
  IF (SELECT pg_get_constraintdef(oid) FROM pg_constraint
      WHERE conrelid = 'public.guest_recovery'::regclass AND conname = 'guest_recovery_authority_level_check')
     IS DISTINCT FROM 'CHECK (((authority_level IS NULL) OR (authority_level = ANY (ARRAY[''self''::text, ''supervisor''::text, ''director''::text, ''owner''::text, ''emergency''::text]))))' THEN
    RAISE EXCEPTION 'authority_level check differs from the captured definition; stop.';
  END IF;
  IF (SELECT pg_get_constraintdef(oid) FROM pg_constraint
      WHERE conrelid = 'public.guest_recovery'::regclass AND conname = 'guest_recovery_recovery_action_check')
     IS DISTINCT FROM 'CHECK (((recovery_action IS NULL) OR (recovery_action = ANY (ARRAY[''none''::text, ''apology''::text, ''mitigation''::text, ''credit''::text, ''partial_refund''::text, ''full_refund''::text, ''fee_waiver''::text, ''shorten_stay''::text, ''relocation''::text]))))' THEN
    RAISE EXCEPTION 'recovery_action check differs from the captured definition; stop.';
  END IF;
END
$chk$;

ALTER TABLE public.guest_recovery DROP CONSTRAINT guest_recovery_authority_level_check;
ALTER TABLE public.guest_recovery ADD CONSTRAINT guest_recovery_authority_level_check
  CHECK (authority_level IS NULL OR authority_level = ANY (ARRAY['self','pc','supervisor','director','owner','emergency']));

ALTER TABLE public.guest_recovery DROP CONSTRAINT guest_recovery_recovery_action_check;
ALTER TABLE public.guest_recovery ADD CONSTRAINT guest_recovery_recovery_action_check
  CHECK (recovery_action IS NULL OR recovery_action = ANY (ARRAY['none','apology','courtesy_item','mitigation','credit','partial_refund','full_night_refund','full_refund','fee_waiver','shorten_stay','relocation','other']));
