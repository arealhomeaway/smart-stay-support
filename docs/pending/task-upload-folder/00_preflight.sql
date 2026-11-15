-- Preflight for task-upload-folder. Changes nothing.
-- Stops unless the live upload step is still exactly the version captured on Nov 15.
DO $$
BEGIN
  IF to_regprocedure('public.begin_attachment_upload(uuid, jsonb)') IS NULL THEN
    RAISE EXCEPTION 'Preflight: begin_attachment_upload is not there.';
  END IF;
  IF md5(pg_get_functiondef('public.begin_attachment_upload(uuid, jsonb)'::regprocedure)) <> '1ca86db5ae5256afeb618e336161bda2' THEN
    RAISE EXCEPTION 'Preflight: the live upload step changed since Nov 15 (or this fix is already in). Nothing changed.';
  END IF;
END $$;
