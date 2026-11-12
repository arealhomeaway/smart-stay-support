-- Undo for docs/pending/onboarding-home/apply.sql. Removes the new functions and turns the tiles
-- switch off. The new tables and columns and every row in them stay (nothing is deleted); with the
-- functions gone nothing can write to them, and the screens fall back to their "not applied" state.
UPDATE public.feature_flags SET enabled = false WHERE key = 'onboarding_home_tiles';
DROP FUNCTION IF EXISTS public.save_onboarding_home_view(text, jsonb, text, text);
DROP FUNCTION IF EXISTS public.archive_onboarding_home_view(uuid);
DROP FUNCTION IF EXISTS public.save_onboarding_home_columns(text[]);
DROP FUNCTION IF EXISTS public.dismiss_ownerrez_listing(text, text, text);
DROP FUNCTION IF EXISTS public.set_onboarding_project_stagers(uuid, uuid[]);
DROP FUNCTION IF EXISTS public.add_upcoming_onboarding_home(uuid, text, text, text, text, text, date, text, text);
DROP FUNCTION IF EXISTS public.start_upcoming_onboarding_home(uuid);
DROP FUNCTION IF EXISTS public.mark_contract_fell_through(uuid, text);
DROP FUNCTION IF EXISTS private.onboarding_home_lead(uuid);
REVOKE SELECT ON public.saved_views, public.ownerrez_listing_cache, public.ownerrez_listing_dismissals, public.onboarding_project_stagers FROM authenticated;
