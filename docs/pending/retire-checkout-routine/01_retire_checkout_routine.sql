-- Retire the legacy Checkout routine: Departure Review replaces it (approved by Emily, Nov 6 2026).
-- Stops new Checkout routine rows only. Existing rows, their history and the kind itself stay.
DO $pre$
BEGIN
  IF to_regclass('public.routine_controls') IS NULL OR to_regclass('public.departure_reviews') IS NULL THEN
    RAISE EXCEPTION 'Retire checkout precheck failed: routine_controls or departure_reviews missing';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'routine_controls_no_new_checkout') THEN
    RAISE EXCEPTION 'Retire checkout precheck failed: trigger already exists';
  END IF;
END
$pre$;

CREATE OR REPLACE FUNCTION private.refuse_new_checkout_routine()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.kind = 'checkout' THEN
    RAISE EXCEPTION 'Checkout routines are retired. Departure Review replaces them.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.refuse_new_checkout_routine() FROM PUBLIC, anon;

CREATE TRIGGER routine_controls_no_new_checkout
  BEFORE INSERT ON public.routine_controls
  FOR EACH ROW EXECUTE FUNCTION private.refuse_new_checkout_routine();
