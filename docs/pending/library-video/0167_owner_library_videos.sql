-- PENDING (not applied): walkthrough videos on Optional Library items.
-- Files live in the existing PRIVATE bucket `resolve-attachments` under
-- owner-library-video/<library id>/<file>. No storage policy is added: that bucket
-- has no storage.objects policies, so only the server (after checks below) can
-- create upload tickets or short-lived playback links.
-- One live video per library item; replace/remove keeps the old row (and file) hidden.

CREATE TABLE public.owner_library_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_id uuid NOT NULL REFERENCES public.owner_opportunity_library(id) ON DELETE CASCADE,
  storage_bucket text NOT NULL DEFAULT 'resolve-attachments' CHECK (storage_bucket = 'resolve-attachments'),
  storage_path text NOT NULL UNIQUE,
  mime_type text NOT NULL CHECK (mime_type IN ('video/mp4', 'video/quicktime', 'video/webm')),
  size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 262144000),
  label text NOT NULL DEFAULT 'Watch the walkthrough' CHECK (char_length(label) BETWEEN 1 AND 120),
  uploaded_by uuid NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  removed_at timestamptz,
  removed_by uuid,
  removal_reason text CHECK (removal_reason IN ('replaced', 'removed')),
  replaced_by uuid REFERENCES public.owner_library_videos(id),
  CHECK (storage_path LIKE 'owner-library-video/' || library_id::text || '/%'),
  CHECK ((removed_at IS NULL) = (removal_reason IS NULL))
);

CREATE UNIQUE INDEX owner_library_videos_one_live ON public.owner_library_videos (library_id) WHERE removed_at IS NULL;

ALTER TABLE public.owner_library_videos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.owner_library_videos FROM anon, authenticated;
GRANT SELECT ON public.owner_library_videos TO authenticated;
GRANT ALL ON public.owner_library_videos TO service_role;

-- Internal staff may read the record and its history; homeowners and vendors never read it directly.
CREATE POLICY "Internal staff read library videos" ON public.owner_library_videos
  FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));

-- History is append-only: rows are never deleted.
CREATE FUNCTION public.block_owner_library_video_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Library video history cannot be deleted'; END $$;
CREATE TRIGGER owner_library_videos_no_delete BEFORE DELETE ON public.owner_library_videos
  FOR EACH ROW WHEN (pg_trigger_depth() = 0) EXECUTE FUNCTION public.block_owner_library_video_delete();

-- Same people who edit library items today (Admin / Supervisor roles).
CREATE FUNCTION public.can_edit_owner_library(_uid uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _uid IS NOT NULL AND (public.has_role(_uid, 'admin'::app_role) OR public.has_role(_uid, 'manager'::app_role))
$$;

-- Who may watch: internal staff; or a homeowner whose program can see the item in
-- "More ways to participate" (active program + active item) or already started it.
-- Vendors and signed-out callers never.
CREATE FUNCTION public.can_view_owner_library_video(_library_id uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN NOT EXISTS (SELECT 1 FROM public.owner_opportunity_library l WHERE l.id = _library_id) THEN false
    WHEN public.is_internal_staff(auth.uid()) THEN true
    WHEN public.has_role(auth.uid(), 'vendor'::app_role) THEN false
    ELSE (
      EXISTS (SELECT 1 FROM public.owner_programs p WHERE p.owner_user_id = auth.uid() AND p.status = 'active')
      AND EXISTS (SELECT 1 FROM public.owner_opportunity_library l WHERE l.id = _library_id AND l.active)
    ) OR EXISTS (
      SELECT 1 FROM public.work_items w JOIN public.owner_programs p ON p.id = w.program_id
      WHERE w.library_template_id = _library_id AND w.kind = 'opportunity'
        AND p.owner_user_id = auth.uid() AND w.retired_at IS NULL AND w.status NOT IN ('archived', 'draft')
    )
  END
$$;

CREATE FUNCTION public.set_owner_library_video(
  _library_id uuid, _storage_path text, _mime_type text, _size_bytes bigint, _label text
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _new uuid; _old uuid;
BEGIN
  IF NOT public.can_edit_owner_library(auth.uid()) THEN RAISE EXCEPTION 'Only library editors can change the video'; END IF;
  PERFORM 1 FROM public.owner_opportunity_library WHERE id = _library_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Library item not found'; END IF;
  SELECT id INTO _old FROM public.owner_library_videos WHERE library_id = _library_id AND removed_at IS NULL;
  IF _old IS NOT NULL THEN
    UPDATE public.owner_library_videos SET removed_at = now(), removed_by = auth.uid(), removal_reason = 'replaced' WHERE id = _old;
  END IF;
  INSERT INTO public.owner_library_videos (library_id, storage_path, mime_type, size_bytes, label, uploaded_by)
  VALUES (_library_id, _storage_path, _mime_type, _size_bytes, coalesce(nullif(btrim(_label), ''), 'Watch the walkthrough'), auth.uid())
  RETURNING id INTO _new;
  IF _old IS NOT NULL THEN UPDATE public.owner_library_videos SET replaced_by = _new WHERE id = _old; END IF;
  RETURN _new;
END $$;

CREATE FUNCTION public.remove_owner_library_video(_library_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n integer;
BEGIN
  IF NOT public.can_edit_owner_library(auth.uid()) THEN RAISE EXCEPTION 'Only library editors can change the video'; END IF;
  UPDATE public.owner_library_videos SET removed_at = now(), removed_by = auth.uid(), removal_reason = 'removed'
  WHERE library_id = _library_id AND removed_at IS NULL;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $$;

CREATE FUNCTION public.relabel_owner_library_video(_library_id uuid, _label text) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _n integer;
BEGIN
  IF NOT public.can_edit_owner_library(auth.uid()) THEN RAISE EXCEPTION 'Only library editors can change the video'; END IF;
  UPDATE public.owner_library_videos SET label = coalesce(nullif(btrim(_label), ''), 'Watch the walkthrough')
  WHERE library_id = _library_id AND removed_at IS NULL;
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END $$;

REVOKE ALL ON FUNCTION public.can_edit_owner_library(uuid), public.can_view_owner_library_video(uuid),
  public.set_owner_library_video(uuid, text, text, bigint, text), public.remove_owner_library_video(uuid),
  public.relabel_owner_library_video(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_edit_owner_library(uuid), public.can_view_owner_library_video(uuid),
  public.set_owner_library_video(uuid, text, text, bigint, text), public.remove_owner_library_video(uuid),
  public.relabel_owner_library_video(uuid, text) TO authenticated, service_role;
