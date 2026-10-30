DROP FUNCTION IF EXISTS public.apply_lee_homeowner_correction(boolean);
DO $restore$
DECLARE definition text;
BEGIN
 SELECT pg_get_functiondef('public.read_owner_participation(text,uuid,boolean,uuid)'::regprocedure) INTO definition;
 IF encode(extensions.digest(definition,'sha256'),'hex') <> '37211248bb927bad53e156df7182b74ad40272d035be20fd7ce96ec82835713b' THEN RAISE EXCEPTION 'Alert reader changed. Refusing restoration.'; END IF;
 definition := replace(definition,'(n.owner_user_id IS NULL OR n.owner_user_id=p.owner_user_id OR EXISTS(SELECT 1 FROM public.program_members m WHERE m.program_id=p.id AND m.user_id=n.owner_user_id))','n.owner_user_id=p.owner_user_id');
 IF encode(extensions.digest(definition,'sha256'),'hex') <> '1f1c44d6b8ca56ad96d76a80110aafd08abd30c1ceaf2414c598d36cbbadc5eb' THEN RAISE EXCEPTION 'Restoration bytes do not equal the captured original.'; END IF;
 EXECUTE definition;
END $restore$;