-- property-guidebook-link (Emily, Nov 25, change 3 answer 4). One Guidebook link per home.
-- Operations (Admin, Manager, Tech app roles) edit it on the property page; the arrival check shows it.
ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS guidebook_url text
  CHECK (guidebook_url IS NULL OR (guidebook_url ~* '^https?://' AND length(guidebook_url) <= 2000));
COMMENT ON COLUMN public.properties.guidebook_url IS 'Guest guidebook link, shown on the arrival check step d. Changed only through set_property_guidebook_link.';

CREATE OR REPLACE FUNCTION public.set_property_guidebook_link(_property_id uuid, _url text)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _me uuid := auth.uid(); _old text; _new text := nullif(trim(coalesce(_url, '')), '');
BEGIN
  IF _me IS NULL OR NOT (public.has_role(_me, 'admin') OR public.has_role(_me, 'manager') OR public.has_role(_me, 'tech')) THEN
    RAISE EXCEPTION 'Only Operations can change this.';
  END IF;
  IF _new IS NOT NULL AND _new !~* '^https?://' THEN RAISE EXCEPTION 'Paste a full link starting with https://'; END IF;
  SELECT guidebook_url INTO _old FROM public.properties WHERE id = _property_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'That home could not be found.'; END IF;
  IF _old IS NOT DISTINCT FROM _new THEN RETURN _new; END IF;
  UPDATE public.properties SET guidebook_url = _new WHERE id = _property_id;
  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, before_value, after_value)
  VALUES (_me, 'property.guidebook_link', 'property', _property_id, 'Guidebook link',
    jsonb_build_object('guidebook_url', _old), jsonb_build_object('guidebook_url', _new));
  RETURN _new;
END $$;
REVOKE ALL ON FUNCTION public.set_property_guidebook_link(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_property_guidebook_link(uuid, text) TO authenticated;
