CREATE OR REPLACE FUNCTION public.accept_into_operations(_project_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p uuid;v jsonb;
BEGIN SELECT property_id INTO p FROM public.onboarding_projects WHERE id=_project_id;v:=public.handoff_open_items(p);IF jsonb_array_length(v)>0 THEN RAISE EXCEPTION 'Review the carry-over confirmation in the Handoff tab.';END IF;PERFORM public.perform_handoff_step(_project_id,'accepted','[]',false);END $function$
