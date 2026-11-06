-- STAGED, NOT APPLIED. Marketing photos "Download all photos" (approved by Emily Nov 6, build and test only).
-- No BEGIN/COMMIT: the migration tool runs the file in one transaction.

-- Download log: one row per download (who, when, home). Only a hash of the single-use link is stored.
CREATE TABLE public.marketing_photo_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id),
  user_id uuid NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  started_at timestamptz,
  file_count integer NOT NULL DEFAULT 0,
  total_bytes bigint NOT NULL DEFAULT 0
);
CREATE INDEX marketing_photo_downloads_property_idx ON public.marketing_photo_downloads(property_id, requested_at DESC);
GRANT SELECT ON public.marketing_photo_downloads TO authenticated;
GRANT ALL ON public.marketing_photo_downloads TO service_role;
ALTER TABLE public.marketing_photo_downloads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read photo downloads" ON public.marketing_photo_downloads FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
CREATE POLICY "Owners read their own photo downloads" ON public.marketing_photo_downloads FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- One "photos aren't ready" notice per home per day.
CREATE TABLE public.marketing_photo_notices (
  property_id uuid PRIMARY KEY REFERENCES public.properties(id),
  notified_at timestamptz NOT NULL DEFAULT now(),
  notified_user uuid
);
GRANT ALL ON public.marketing_photo_notices TO service_role;
ALTER TABLE public.marketing_photo_notices ENABLE ROW LEVEL SECURITY;

-- Caller-authenticated: log a download for a home the caller owns (or any home for staff).
CREATE OR REPLACE FUNCTION public.request_marketing_photo_download(_property_id uuid, _token_hash text, _file_count integer, _total_bytes bigint)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); rid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Sign in to download photos' USING ERRCODE = '42501'; END IF;
  IF NOT (public.is_staff(uid) OR public.owner_property_access(_property_id, uid)) THEN
    RAISE EXCEPTION 'You do not have access to this home''s photos' USING ERRCODE = '42501'; END IF;
  IF length(coalesce(_token_hash, '')) <> 64 THEN RAISE EXCEPTION 'Invalid download link'; END IF;
  INSERT INTO public.marketing_photo_downloads(property_id, user_id, token_hash, expires_at, file_count, total_bytes)
  VALUES (_property_id, uid, _token_hash, now() + interval '2 minutes', greatest(_file_count, 0), greatest(_total_bytes, 0))
  RETURNING id INTO rid;
  RETURN rid;
END $$;
REVOKE ALL ON FUNCTION public.request_marketing_photo_download(uuid, text, integer, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.request_marketing_photo_download(uuid, text, integer, bigint) TO authenticated;

-- Single use: the download route claims the link once, within two minutes.
CREATE OR REPLACE FUNCTION public.claim_marketing_photo_download(_token_hash text)
RETURNS TABLE(property_id uuid, user_id uuid) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.marketing_photo_downloads d SET started_at = now()
   WHERE d.token_hash = _token_hash AND d.started_at IS NULL AND d.expires_at > now()
  RETURNING d.property_id, d.user_id;
$$;
REVOKE ALL ON FUNCTION public.claim_marketing_photo_download(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_marketing_photo_download(text) TO anon, authenticated, service_role;

-- Caller-authenticated: tell the home's project manager in Resolve that photos are missing (once a day).
CREATE OR REPLACE FUNCTION public.notify_marketing_photos_missing(_property_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); pm uuid; label text; demo boolean;
BEGIN
  IF uid IS NULL OR NOT (public.is_staff(uid) OR public.owner_property_access(_property_id, uid)) THEN
    RAISE EXCEPTION 'You do not have access to this home' USING ERRCODE = '42501'; END IF;
  IF EXISTS (SELECT 1 FROM public.marketing_photo_notices WHERE property_id = _property_id AND notified_at > now() - interval '1 day') THEN
    RETURN false; END IF;
  SELECT p.project_manager INTO pm FROM public.onboarding_projects p
   WHERE p.property_id = _property_id ORDER BY (p.status = 'active') DESC, p.created_at DESC LIMIT 1;
  IF pm IS NULL THEN RETURN false; END IF;
  SELECT coalesce(nullif(pr.address_line1, ''), pr.name), pr.is_demo INTO label, demo FROM public.properties pr WHERE pr.id = _property_id;
  INSERT INTO public.marketing_photo_notices(property_id, notified_at, notified_user) VALUES (_property_id, now(), pm)
    ON CONFLICT (property_id) DO UPDATE SET notified_at = now(), notified_user = pm;
  PERFORM public.notify_staff(pm, 'marketing_photos_missing', 'Marketing photos are not ready',
    'The homeowner for ' || coalesce(label, 'this home') || ' tried to download marketing photos, but the Marketing Photos folder is empty or missing.',
    'property', _property_id, '/property/' || _property_id::text, 'normal', uid, false, coalesce(demo, false));
  RETURN true;
END $$;
REVOKE ALL ON FUNCTION public.notify_marketing_photos_missing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_marketing_photos_missing(uuid) TO authenticated;
