CREATE OR REPLACE FUNCTION public.accept_into_operations(_project_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p uuid;v jsonb;
BEGIN SELECT property_id INTO p FROM public.onboarding_projects WHERE id=_project_id;v:=public.handoff_open_items(p);IF jsonb_array_length(v)>0 THEN RAISE EXCEPTION 'Review the carry-over confirmation in the Handoff tab.';END IF;PERFORM public.perform_handoff_step(_project_id,'accepted','[]',false);END $function$
;

CREATE OR REPLACE FUNCTION public.mark_ready_for_operations(_project_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p uuid;v jsonb;
BEGIN SELECT property_id INTO p FROM public.onboarding_projects WHERE id=_project_id;v:=public.handoff_open_items(p);IF jsonb_array_length(v)>0 THEN RAISE EXCEPTION 'Review the carry-over confirmation in the Handoff tab.';END IF;PERFORM public.perform_handoff_step(_project_id,'ready','[]',false);END $function$
;

CREATE OR REPLACE FUNCTION public.rerun_departure_review_trigger(_wo_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_internal_staff(auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  RETURN public.create_departure_review_from_clean(_wo_id);
END $function$
;

ALTER FUNCTION accept_into_operations(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION accept_into_operations(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION accept_into_operations(uuid) TO service_role;
ALTER FUNCTION mark_ready_for_operations(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION mark_ready_for_operations(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_ready_for_operations(uuid) TO service_role;
ALTER FUNCTION rerun_departure_review_trigger(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION rerun_departure_review_trigger(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION rerun_departure_review_trigger(uuid) TO service_role;
