-- lovable-cron-fallback-reviewed: Emily asked for the nightly export to cover everything and to alert on a missed night (register N10, Nov 9). The export continues every 10 minutes between 2 and 5 AM Central through the existing private backup token and the existing nightly backup address, exactly like the two existing nightly backup calls, and a database-only check at 5 AM Central alerts when no export passed. Both act only in their Central hours, so they hold through daylight saving.
-- Full nightly export (register N10; Emily, Nov 9, 2026). Additive only.
-- 1. backup_runs gains the export's own fields (kind, weekly, phase, saved progress, counts, the
--    check result). Existing rows and the existing nightly backup keep working unchanged.
-- 2. backup_file_copies: which stored file was last copied to SharePoint, with its fingerprint, so
--    a night copies only new or changed files. Written only by the server.
-- 3. backup_export_alerts: one alert per night at most.
-- 4. backup_list_files: every stored file with its size, fingerprint and the record it belongs to.
--    Reads only. Server only.
-- 5. can_view_export_check: Admin, the Operations Supervisor, the Director of Operations and the
--    Director of Onboarding read the run history (the read only Export check page).
-- 6. nightly_export_alert: in app alert (emailed by the existing 5 minute pass) to every Admin and
--    the Director of Operations. Server only. private.nightly_export_missed_check calls it at 5 AM
--    Central when no export passed that night.
-- 7. Two new scheduled jobs. The two existing nightly backup jobs are not changed.
-- Undo: 01_undo_nightly_export.sql.

ALTER TABLE public.backup_runs
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'nightly',
  ADD COLUMN IF NOT EXISTS weekly boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS phase text,
  ADD COLUMN IF NOT EXISTS progress jsonb,
  ADD COLUMN IF NOT EXISTS lease_until timestamptz,
  ADD COLUMN IF NOT EXISTS sharepoint_path text,
  ADD COLUMN IF NOT EXISTS table_count integer,
  ADD COLUMN IF NOT EXISTS total_rows bigint,
  ADD COLUMN IF NOT EXISTS files_inventoried integer,
  ADD COLUMN IF NOT EXISTS files_copied integer,
  ADD COLUMN IF NOT EXISTS bytes_copied bigint,
  ADD COLUMN IF NOT EXISTS manifest_sha256 text,
  ADD COLUMN IF NOT EXISTS verify_status text,
  ADD COLUMN IF NOT EXISTS verify_reasons text[],
  ADD COLUMN IF NOT EXISTS verify_result jsonb,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;
ALTER TABLE public.backup_runs ADD CONSTRAINT backup_runs_kind_check CHECK (kind IN ('nightly', 'test'));
ALTER TABLE public.backup_runs ADD CONSTRAINT backup_runs_phase_check
  CHECK (phase IS NULL OR phase IN ('start', 'tables', 'files', 'manifest', 'verify', 'prune', 'done'));
ALTER TABLE public.backup_runs ADD CONSTRAINT backup_runs_verify_status_check
  CHECK (verify_status IS NULL OR verify_status IN ('passed', 'failed'));
-- One export record per night (the older backup records have no phase and are not counted).
CREATE UNIQUE INDEX backup_runs_one_export_per_night ON public.backup_runs (kind, folder_name) WHERE phase IS NOT NULL;

CREATE TABLE public.backup_file_copies (
  bucket text NOT NULL,
  name text NOT NULL,
  etag text,
  size bigint NOT NULL DEFAULT 0,
  copied_at timestamptz NOT NULL DEFAULT now(),
  run_id uuid REFERENCES public.backup_runs(id) ON DELETE SET NULL,
  PRIMARY KEY (bucket, name)
);
GRANT SELECT ON public.backup_file_copies TO authenticated;
GRANT ALL ON public.backup_file_copies TO service_role;
ALTER TABLE public.backup_file_copies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read file copies" ON public.backup_file_copies
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.backup_export_alerts (
  folder_name text PRIMARY KEY,
  reason text NOT NULL CHECK (reason IN ('failed', 'missed')),
  message text,
  notified integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.backup_export_alerts TO authenticated;
GRANT ALL ON public.backup_export_alerts TO service_role;
ALTER TABLE public.backup_export_alerts ENABLE ROW LEVEL SECURITY;

-- Who may open the read only Export check page. Mirrors the export_check permission in the app.
CREATE OR REPLACE FUNCTION public.can_view_export_check(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(public.has_role(_user_id, 'admin'), false)
      OR coalesce(public.is_director(_user_id), false)
      OR coalesce(public.is_onboarding_director(_user_id), false)
      OR coalesce(public.holds_functional_role(_user_id, 'ops_supervisor'), false)
$function$;
REVOKE ALL ON FUNCTION public.can_view_export_check(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_export_check(uuid) TO authenticated, service_role;

CREATE POLICY "Export check readers read backup runs" ON public.backup_runs
  FOR SELECT TO authenticated USING (public.can_view_export_check(auth.uid()));
CREATE POLICY "Export check readers read export alerts" ON public.backup_export_alerts
  FOR SELECT TO authenticated USING (public.can_view_export_check(auth.uid()));

-- Every stored file, with the record it belongs to. Reads storage only; never changes it.
CREATE OR REPLACE FUNCTION public.backup_list_files()
 RETURNS TABLE(bucket text, name text, size bigint, etag text, mimetype text, updated_at timestamptz,
               owner_type text, owner_id text, owner_label text)
 LANGUAGE sql
 STABLE
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT o.bucket_id::text, o.name::text,
         coalesce((o.metadata->>'size')::bigint, 0),
         coalesce(o.metadata->>'eTag', o.metadata->>'etag'),
         o.metadata->>'mimetype',
         coalesce(o.updated_at, o.created_at),
         CASE WHEN d.id IS NOT NULL THEN 'documents'
              WHEN v.id IS NOT NULL THEN 'owner_library_videos'
              WHEN vd.id IS NOT NULL THEN 'vendor_documents'
              WHEN o.bucket_id IN ('avatars', 'help-feedback') THEN 'profiles'
              ELSE 'folder' END,
         coalesce(d.id::text, v.id::text, vd.id::text,
                  CASE WHEN o.bucket_id IN ('avatars', 'help-feedback') THEN split_part(o.name, '/', 1) END),
         CASE WHEN d.id IS NOT NULL THEN concat_ws(' ', d.entity_type, d.entity_id::text)
              WHEN v.id IS NOT NULL THEN 'Optional Library video'
              WHEN vd.id IS NOT NULL THEN 'Vendor document'
              WHEN o.bucket_id = 'avatars' THEN 'Profile photo'
              WHEN o.bucket_id = 'help-feedback' THEN 'Help report file'
              ELSE split_part(o.name, '/', 1) END
    FROM storage.objects o
    LEFT JOIN LATERAL (SELECT x.id, x.entity_type, x.entity_id FROM public.documents x
                        WHERE o.bucket_id = 'resolve-attachments' AND x.storage_path = o.name LIMIT 1) d ON true
    LEFT JOIN LATERAL (SELECT x.id FROM public.owner_library_videos x
                        WHERE x.storage_bucket = o.bucket_id AND x.storage_path = o.name LIMIT 1) v ON true
    LEFT JOIN LATERAL (SELECT x.id FROM public.vendor_documents x
                        WHERE o.bucket_id = 'resolve-attachments' AND x.storage_path = o.name LIMIT 1) vd ON true
   ORDER BY o.bucket_id, o.name
$function$;
REVOKE ALL ON FUNCTION public.backup_list_files() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.backup_list_files() TO service_role;

-- The one alert: every Admin and the Director of Operations, once per night, in app and by email
-- (email_status pending: the existing 5 minute pass emails it, staff only, personal settings kept).
CREATE OR REPLACE FUNCTION public.nightly_export_alert(_folder text, _reason text, _message text)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _n integer := 0;
BEGIN
  IF _reason NOT IN ('failed', 'missed') THEN RAISE EXCEPTION 'Unknown alert reason: %', _reason; END IF;
  INSERT INTO public.backup_export_alerts (folder_name, reason, message)
  VALUES (_folder, _reason, left(_message, 900))
  ON CONFLICT (folder_name) DO NOTHING;
  IF NOT FOUND THEN RETURN 0; END IF;
  INSERT INTO public.staff_notifications (user_id, kind, title, body, link_path, priority, email_status)
  SELECT r.u, 'nightly_export_failed',
         CASE WHEN _reason = 'missed' THEN 'Nightly export did not finish' ELSE 'Nightly export failed' END,
         left(_message, 900), '/export-check', 'high', 'pending'
    FROM (
      SELECT ur.user_id AS u FROM public.user_roles ur WHERE ur.role = 'admin'
      UNION SELECT fr.current_seat_holder FROM public.functional_roles fr
             WHERE fr.code = 'director_ops' AND fr.active AND fr.current_seat_holder IS NOT NULL
      UNION SELECT m.user_id FROM public.functional_role_members m WHERE m.role_code = 'director_ops'
    ) r
   WHERE r.u IS NOT NULL;
  GET DIAGNOSTICS _n = ROW_COUNT;
  UPDATE public.backup_export_alerts SET notified = _n WHERE folder_name = _folder;
  RETURN _n;
END
$function$;
REVOKE ALL ON FUNCTION public.nightly_export_alert(text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.nightly_export_alert(text, text, text) TO service_role;

-- 5 AM Central: alert when no export passed tonight. Until the full export is published, the
-- existing nightly backup finishing counts as a run, so nobody is alerted about unpublished work.
CREATE OR REPLACE FUNCTION private.nightly_export_missed_check(_now timestamptz DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _local timestamp := _now AT TIME ZONE 'America/Chicago';
  _folder text := to_char(_now AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD');
  _run record;
BEGIN
  IF extract(hour FROM _local) <> 5 THEN RETURN 0; END IF;
  IF EXISTS (
    SELECT 1 FROM public.backup_runs b
     WHERE b.kind = 'nightly' AND b.folder_name = _folder
       AND ((b.phase IS NOT NULL AND b.verify_status = 'passed') OR (b.phase IS NULL AND b.status = 'succeeded'))
  ) THEN RETURN 0; END IF;
  SELECT b.status, b.verify_status, b.error INTO _run
    FROM public.backup_runs b
   WHERE b.kind = 'nightly' AND b.folder_name = _folder AND b.phase IS NOT NULL
   ORDER BY b.started_at DESC LIMIT 1;
  RETURN public.nightly_export_alert(
    _folder,
    CASE WHEN FOUND AND (_run.verify_status = 'failed' OR _run.status = 'failed') THEN 'failed' ELSE 'missed' END,
    CASE
      WHEN NOT FOUND THEN format('No nightly export ran for %s by 5 AM Central. Open the export check.', _folder)
      WHEN _run.verify_status = 'failed' OR _run.status = 'failed'
        THEN format('The nightly export for %s failed. Open the export check for the reason.', _folder)
      ELSE format('The nightly export for %s had not finished by 5 AM Central. Open the export check.', _folder)
    END);
END
$function$;
REVOKE ALL ON FUNCTION private.nightly_export_missed_check(timestamptz) FROM PUBLIC, anon, authenticated;

DO $do$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname IN ('nightly-export-continue', 'nightly-export-missed-check');
  -- Minutes 5 to 55, so it never lands on the existing 07:00 and 08:00 UTC calls.
  PERFORM cron.schedule('nightly-export-continue', '5-55/10 7-10 * * *', $c$
    SELECT net.http_post(
      url := 'https://project--9ccd5407-8c2f-4bb6-af2b-c23477f01c08.lovable.app/api/public/hooks/nightly-backup',
      headers := jsonb_build_object('Content-Type','application/json','x-cron-secret',
        (SELECT token FROM private.backup_cron_token WHERE id = 1)),
      body := '{}'::jsonb,
      timeout_milliseconds := 300000);
  $c$);
  PERFORM cron.schedule('nightly-export-missed-check', '15 10,11 * * *', $c$ SELECT private.nightly_export_missed_check(); $c$);
END $do$;
