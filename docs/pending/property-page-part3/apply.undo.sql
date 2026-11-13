-- Undo for Property page Part 3. Puts the captured live objects back exactly.
-- Files filed into the two new folders must be moved first, or the old check refuses them:
--   UPDATE public.documents SET category = NULL WHERE category IN ('agreement','estimate_invoice');
-- (Only with approval; that line clears the folder, the files themselves stay.)
DROP TRIGGER IF EXISTS followed_home_owner_notice ON public.owner_request_messages;
DROP TRIGGER IF EXISTS followed_home_handoff_notice ON public.onboarding_projects;
DROP TRIGGER IF EXISTS followed_home_stage_notice ON public.onboarding_project_events;
DROP FUNCTION IF EXISTS private.follow_notice_from_owner_message();
DROP FUNCTION IF EXISTS private.follow_notice_from_handoff();
DROP FUNCTION IF EXISTS private.follow_notice_from_project_event();
DROP FUNCTION IF EXISTS private.notify_home_followers(uuid, text, text, text, uuid, boolean);
DROP FUNCTION IF EXISTS public.move_home_file(uuid, text);
DROP FUNCTION IF EXISTS public.save_home_detail_field(uuid, text, text);
DROP FUNCTION IF EXISTS private.onboarding_home_team_member(uuid, uuid);
ALTER TABLE public.documents DROP CONSTRAINT documents_category_chk;
-- From live-capture/documents_category_chk.sql:
ALTER TABLE public.documents ADD CONSTRAINT documents_category_chk CHECK (((category IS NULL) OR (category = ANY (ARRAY['pma'::text, 'insurance'::text, 'ownership'::text, 'hoa'::text, 'covenants'::text, 'permit_license'::text, 'compliance'::text, 'manual'::text, 'hvac_doc'::text, 'warranty'::text, 'equipment'::text, 'access_security'::text, 'measurements'::text, 'design'::text, 'onboarding_evidence'::text, 'assessment'::text, 'operations'::text, 'maintenance'::text, 'media'::text, 'reference'::text, 'other'::text, 'design_floor_plan'::text, 'design_mood_board'::text, 'design_pick_list'::text, 'design_install'::text, 'design_staging'::text, 'design_photo'::text]))));
ALTER TABLE public.vendor_orgs DROP COLUMN IF EXISTS preferred_contact;
ALTER TABLE public.onboarding_projects DROP COLUMN IF EXISTS loa_status, DROP COLUMN IF EXISTS telegram_url;
