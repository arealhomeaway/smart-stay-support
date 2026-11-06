-- UNDO for 01_marketing_photo_downloads.sql. Removes the download log and notices (download history is lost; export first if needed).
DROP FUNCTION IF EXISTS public.notify_marketing_photos_missing(uuid);
DROP FUNCTION IF EXISTS public.claim_marketing_photo_download(text);
DROP FUNCTION IF EXISTS public.request_marketing_photo_download(uuid, text, integer, bigint);
DROP TABLE IF EXISTS public.marketing_photo_notices;
DROP TABLE IF EXISTS public.marketing_photo_downloads;
