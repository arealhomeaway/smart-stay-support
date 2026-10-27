-- Undo for 0167 (library videos). Uploaded files stay in the private bucket, hidden.
-- Warning: dropping the table removes the upload/replace history rows.
DROP FUNCTION IF EXISTS public.relabel_owner_library_video(uuid, text);
DROP FUNCTION IF EXISTS public.remove_owner_library_video(uuid);
DROP FUNCTION IF EXISTS public.set_owner_library_video(uuid, text, text, bigint, text);
DROP FUNCTION IF EXISTS public.can_view_owner_library_video(uuid);
DROP FUNCTION IF EXISTS public.can_edit_owner_library(uuid);
DROP TABLE IF EXISTS public.owner_library_videos;
DROP FUNCTION IF EXISTS public.block_owner_library_video_delete();
