-- onboarding-task-views (Nov 23): My Tasks saved views and remembered choices per person, and the
-- Onboarding Home columns each person can order, show and hide (with the Stager / on-site team column).
-- One transaction. Widens two checks on saved_views, adds one index and four caller-authenticated
-- actions, and lets the existing columns action accept the new column names. Nothing else changes:
-- no Task, home, plan, notice, email or permission.
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname IN ('my_tasks_views', 'save_my_tasks_view', 'archive_my_tasks_view', 'save_my_tasks_prefs')) THEN
    RAISE EXCEPTION 'onboarding-task-views: already applied';
  END IF;
END $guard$;

-- 1. saved_views also holds My Tasks rows, and one 'prefs' row per person per page (the last choices).
ALTER TABLE public.saved_views DROP CONSTRAINT saved_views_page_check;
ALTER TABLE public.saved_views ADD CONSTRAINT saved_views_page_check
  CHECK (page = ANY (ARRAY['onboarding_home'::text, 'onboarding_my_tasks'::text]));
ALTER TABLE public.saved_views DROP CONSTRAINT saved_views_kind_check;
ALTER TABLE public.saved_views ADD CONSTRAINT saved_views_kind_check
  CHECK (kind = ANY (ARRAY['view'::text, 'columns'::text, 'prefs'::text]));
CREATE UNIQUE INDEX saved_views_one_prefs ON public.saved_views (user_id, page) WHERE kind = 'prefs';

-- 2. Read: the caller's own My Tasks views and last choices (own rows only, under the existing policy).
CREATE FUNCTION public.my_tasks_views()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'views', coalesce((SELECT jsonb_agg(jsonb_build_object('id', v.id, 'name', v.name, 'settings', v.filters) ORDER BY lower(v.name))
                         FROM public.saved_views v
                        WHERE v.user_id = auth.uid() AND v.page = 'onboarding_my_tasks' AND v.kind = 'view' AND v.archived_at IS NULL), '[]'::jsonb),
    'prefs', (SELECT p.filters FROM public.saved_views p
               WHERE p.user_id = auth.uid() AND p.page = 'onboarding_my_tasks' AND p.kind = 'prefs' LIMIT 1))
$function$;
REVOKE ALL ON FUNCTION public.my_tasks_views() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_tasks_views() TO authenticated;

-- 3. Save a named view (same name again replaces it, for that person only).
CREATE FUNCTION public.save_my_tasks_view(_name text, _settings jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid(); vid uuid; clean text := btrim(coalesce(_name, ''));
BEGIN
  IF me IS NULL OR NOT public.is_onboarding_staff(me) THEN RAISE EXCEPTION 'My Tasks views are for the onboarding team.'; END IF;
  IF clean = '' OR length(clean) > 60 THEN RAISE EXCEPTION 'Give the view a name of up to 60 characters.'; END IF;
  IF _settings IS NULL OR jsonb_typeof(_settings) <> 'object' OR octet_length(_settings::text) > 4000 THEN RAISE EXCEPTION 'That view could not be saved.'; END IF;
  UPDATE public.saved_views SET filters = _settings, view = coalesce(_settings->>'layout', 'list'), sort = _settings->>'sort', updated_at = now()
   WHERE user_id = me AND page = 'onboarding_my_tasks' AND kind = 'view' AND archived_at IS NULL AND lower(name) = lower(clean)
   RETURNING id INTO vid;
  IF vid IS NULL THEN
    INSERT INTO public.saved_views(user_id, page, kind, name, filters, view, sort)
    VALUES (me, 'onboarding_my_tasks', 'view', clean, _settings, coalesce(_settings->>'layout', 'list'), _settings->>'sort') RETURNING id INTO vid;
  END IF;
  RETURN jsonb_build_object('ok', true, 'id', vid);
END $function$;
REVOKE ALL ON FUNCTION public.save_my_tasks_view(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_my_tasks_view(text, jsonb) TO authenticated;

-- 4. Remove a view from the list (kept, never deleted).
CREATE FUNCTION public.archive_my_tasks_view(_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.saved_views SET archived_at = now(), updated_at = now()
   WHERE id = _id AND user_id = auth.uid() AND page = 'onboarding_my_tasks' AND kind = 'view' AND archived_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'That saved view was not found.'; END IF;
  RETURN jsonb_build_object('ok', true);
END $function$;
REVOKE ALL ON FUNCTION public.archive_my_tasks_view(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_my_tasks_view(uuid) TO authenticated;

-- 5. The person's last choices (filters, grouping such as Group by home, sort, List or Board).
CREATE FUNCTION public.save_my_tasks_prefs(_settings jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL OR NOT public.is_onboarding_staff(me) THEN RAISE EXCEPTION 'My Tasks views are for the onboarding team.'; END IF;
  IF _settings IS NULL OR jsonb_typeof(_settings) <> 'object' OR octet_length(_settings::text) > 4000 THEN RAISE EXCEPTION 'Those choices could not be saved.'; END IF;
  INSERT INTO public.saved_views(user_id, page, kind, filters, view, sort)
  VALUES (me, 'onboarding_my_tasks', 'prefs', _settings, coalesce(_settings->>'layout', 'list'), _settings->>'sort')
  ON CONFLICT (user_id, page) WHERE kind = 'prefs'
  DO UPDATE SET filters = EXCLUDED.filters, view = EXCLUDED.view, sort = EXCLUDED.sort, updated_at = now();
  RETURN jsonb_build_object('ok', true);
END $function$;
REVOKE ALL ON FUNCTION public.save_my_tasks_prefs(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_my_tasks_prefs(jsonb) TO authenticated;

-- 6. Onboarding Home columns: the saved list is now the shown columns in order, starting with 'home',
-- and may name the fixed columns and the new Stager / on-site team column. Same guard otherwise.
CREATE OR REPLACE FUNCTION public.save_onboarding_home_columns(_columns text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE me uuid := auth.uid();
BEGIN
  IF me IS NULL OR NOT public.is_onboarding_staff(me) THEN RAISE EXCEPTION 'Onboarding Home is for the onboarding team.'; END IF;
  IF EXISTS (SELECT 1 FROM unnest(coalesce(_columns, '{}')) c
             WHERE c NOT IN ('home', 'status', 'dates', 'team', 'schedule', 'stager',
                             'possession', 'owner', 'market', 'scope', 'utility', 'hoa', 'committed', 'breezeway')) THEN
    RAISE EXCEPTION 'Unknown column.';
  END IF;
  IF cardinality(coalesce(_columns, '{}')) > 20
     OR cardinality(coalesce(_columns, '{}')) <> (SELECT count(DISTINCT c) FROM unnest(coalesce(_columns, '{}')) c) THEN
    RAISE EXCEPTION 'Unknown column.';
  END IF;
  INSERT INTO public.saved_views(user_id, page, kind, columns) VALUES (me, 'onboarding_home', 'columns', coalesce(_columns, '{}'))
  ON CONFLICT (user_id, page) WHERE kind = 'columns' DO UPDATE SET columns = EXCLUDED.columns, updated_at = now();
  RETURN jsonb_build_object('ok', true);
END $function$;

INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
VALUES (NULL, 'onboarding_task_views.apply', 'function', NULL, 'My Tasks saved views and Onboarding Home columns',
  jsonb_build_object('table', 'saved_views', 'functions',
    jsonb_build_array('my_tasks_views', 'save_my_tasks_view', 'archive_my_tasks_view', 'save_my_tasks_prefs', 'save_onboarding_home_columns')));
