-- UNDO for 01_standard_plan_role_wording.sql. Refuses if any home started on Standard version 5.
-- Restores the 9 working steps' title/detail from version 4 (unchanged) and removes version 5.
DO $do$ DECLARE v5 uuid; BEGIN
  SELECT id INTO v5 FROM public.onboarding_template_versions WHERE template_id = '84f3a777-44a8-430a-af7e-8f18dc9a7dae' AND version = 5;
  IF v5 IS NULL THEN RAISE EXCEPTION 'Version 5 is not there; nothing to undo'; END IF;
  IF EXISTS (SELECT 1 FROM public.onboarding_projects WHERE template_version_id = v5) THEN
    RAISE EXCEPTION 'A home already started on Standard version 5; undo refused'; END IF;
  IF EXISTS (SELECT 1 FROM public.onboarding_template_versions WHERE template_id = '84f3a777-44a8-430a-af7e-8f18dc9a7dae' AND version > 5) THEN
    RAISE EXCEPTION 'A later version exists; undo refused'; END IF;
END $do$;
UPDATE public.onboarding_template_tasks t SET title = s->>'title', detail = s->>'detail'
FROM public.onboarding_template_versions v, jsonb_array_elements(v.snapshot->'steps') s
WHERE v.template_id = '84f3a777-44a8-430a-af7e-8f18dc9a7dae' AND v.version = 4 AND t.id = (s->>'id')::uuid AND t.id IN ('08e85522-4f53-4236-833d-05da550b2f8f','8e7ce79a-2a0d-4f26-a9fa-ef1398f6ffc0','7460f7e9-39ad-40ba-9319-d6ac31d22e35','ec1afa4b-bf49-4d4b-91cf-2f5546fcfa49','5d5be939-b373-4693-bf33-926f8f7658c4','bce1eecb-465f-4e3b-91b0-0a041dd0744e','02dff9fa-3046-42e2-beb2-f9de1f9871d6','999d1fd7-4ccf-4f4a-a30b-d5dd775e3830','7eaec0bc-7b00-45a2-9725-0799a5c9da54');
ALTER TABLE public.onboarding_template_versions DISABLE TRIGGER block_template_version_mutation;
DELETE FROM public.onboarding_template_versions WHERE template_id = '84f3a777-44a8-430a-af7e-8f18dc9a7dae' AND version = 5;
ALTER TABLE public.onboarding_template_versions ENABLE TRIGGER block_template_version_mutation;
DO $do$ BEGIN
  IF (SELECT coalesce(jsonb_agg(to_jsonb(t) - 'created_at' - 'updated_at' ORDER BY t.sort_order),'[]'::jsonb) FROM public.onboarding_template_tasks t WHERE t.template_id = '84f3a777-44a8-430a-af7e-8f18dc9a7dae' AND t.is_active)
     IS DISTINCT FROM (SELECT snapshot->'steps' FROM public.onboarding_template_versions WHERE template_id = '84f3a777-44a8-430a-af7e-8f18dc9a7dae' AND version = 4) THEN
    RAISE EXCEPTION 'Working steps do not match version 4 after undo; nothing undone'; END IF;
END $do$;
