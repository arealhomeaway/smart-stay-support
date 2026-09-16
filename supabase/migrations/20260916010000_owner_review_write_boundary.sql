-- Owners answer through the atomic response action. Table-wide UPDATE would
-- otherwise permit changing operational fields and skipping immutable receipts.
-- Depends on migration 38: its response function is SECURITY DEFINER, so owner
-- table UPDATE is no longer necessary. Keep staff management and owner SELECT.
DO $$ BEGIN
 IF NOT EXISTS (
  SELECT 1 FROM pg_proc
  WHERE oid='public.respond_owner_review(uuid,timestamptz,text,text,integer)'::regprocedure
   AND prosecdef
 ) THEN
  RAISE EXCEPTION 'Install the atomic definer response action before removing owner table writes.';
 END IF;
END $$;

DROP POLICY "Owners answer their own reviews" ON public.owner_reviews;
