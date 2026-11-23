-- Undo for onboarding-task-views. One transaction. Copies every My Tasks row and every column choice
-- that names a new column into one audit line first, then puts saved_views and the columns action back
-- exactly as they were before apply.
DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'my_tasks_views') THEN
    RAISE EXCEPTION 'onboarding-task-views: not applied';
  END IF;
END $guard$;

INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, before_value)
SELECT NULL, 'onboarding_task_views.undo', 'function', NULL, 'My Tasks saved views and Onboarding Home columns',
  jsonb_build_object(
    'my_tasks_rows', coalesce((SELECT jsonb_agg(to_jsonb(v)) FROM public.saved_views v WHERE v.page = 'onboarding_my_tasks' OR v.kind = 'prefs'), '[]'::jsonb),
    'home_columns', coalesce((SELECT jsonb_agg(jsonb_build_object('id', v.id, 'user_id', v.user_id, 'columns', v.columns))
                                FROM public.saved_views v WHERE v.page = 'onboarding_home' AND v.kind = 'columns'), '[]'::jsonb));

-- Column choices go back to the old form: only the optional columns, in their saved order.
UPDATE public.saved_views v
   SET columns = coalesce((SELECT array_agg(c ORDER BY o) FROM unnest(v.columns) WITH ORDINALITY AS x(c, o)
                            WHERE c IN ('possession', 'owner', 'market', 'scope', 'utility', 'hoa', 'committed', 'breezeway')), '{}'),
       updated_at = now()
 WHERE v.page = 'onboarding_home' AND v.kind = 'columns'
   AND EXISTS (SELECT 1 FROM unnest(v.columns) c WHERE c IN ('home', 'status', 'dates', 'team', 'schedule', 'stager'));
DELETE FROM public.saved_views WHERE page = 'onboarding_my_tasks' OR kind = 'prefs';

DROP FUNCTION public.save_my_tasks_prefs(jsonb);
DROP FUNCTION public.archive_my_tasks_view(uuid);
DROP FUNCTION public.save_my_tasks_view(text, jsonb);
DROP FUNCTION public.my_tasks_views();
DROP INDEX public.saved_views_one_prefs;
ALTER TABLE public.saved_views DROP CONSTRAINT saved_views_kind_check;
ALTER TABLE public.saved_views ADD CONSTRAINT saved_views_kind_check CHECK ((kind = ANY (ARRAY['view'::text, 'columns'::text])));
ALTER TABLE public.saved_views DROP CONSTRAINT saved_views_page_check;
ALTER TABLE public.saved_views ADD CONSTRAINT saved_views_page_check CHECK ((page = 'onboarding_home'::text));

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
             WHERE c NOT IN ('possession', 'owner', 'market', 'scope', 'utility', 'hoa', 'committed', 'breezeway')) THEN
    RAISE EXCEPTION 'Unknown column.';
  END IF;
  INSERT INTO public.saved_views(user_id, page, kind, columns) VALUES (me, 'onboarding_home', 'columns', coalesce(_columns, '{}'))
  ON CONFLICT (user_id, page) WHERE kind = 'columns' DO UPDATE SET columns = EXCLUDED.columns, updated_at = now();
  RETURN jsonb_build_object('ok', true);
END $function$;
