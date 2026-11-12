CREATE OR REPLACE FUNCTION public.ao_card_set_status(_card_id uuid, _status text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE c public.ao_library_cards; uid uuid := auth.uid();
BEGIN
  IF NOT private.ao_is_editor(uid) THEN RAISE EXCEPTION 'Only Admin or Onboarding Director can change card status' USING ERRCODE = '42501'; END IF;
  IF _status NOT IN ('draft','released','retired') THEN RAISE EXCEPTION 'Unknown status'; END IF;
  UPDATE public.ao_library_cards SET status = _status, version = version + 1, updated_by = uid, updated_at = now(),
    retired_at = CASE WHEN _status = 'retired' THEN now() ELSE NULL END
  WHERE id = _card_id RETURNING * INTO c;
  IF NOT FOUND THEN RAISE EXCEPTION 'Card not found'; END IF;
  INSERT INTO public.ao_library_card_history(card_id, version, snapshot, changed_by) VALUES (c.id, c.version, to_jsonb(c), uid);
  RETURN c.version;
END $function$

