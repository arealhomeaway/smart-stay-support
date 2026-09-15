-- Unapplied. Dedicated date override with durable reason and automatic-schedule protection.
CREATE FUNCTION public.override_onboarding_task_date(_task_id uuid,_actor_id uuid,_expected_updated_at timestamptz,_due_on date,_reason text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE task public.onboarding_tasks%ROWTYPE; project public.onboarding_projects%ROWTYPE; home public.properties%ROWTYPE; target_property_id uuid; capture jsonb;
BEGIN
 IF _actor_id IS NULL OR NOT coalesce(public.is_onboarding_staff(_actor_id),false) THEN RAISE EXCEPTION 'Onboarding staff access is required.'; END IF;
 IF length(trim(coalesce(_reason,'')))<3 THEN RAISE EXCEPTION 'Record why the due date is changing.'; END IF;
 SELECT t.property_id INTO target_property_id FROM public.onboarding_tasks t WHERE t.id=_task_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'That task is not available.'; END IF;
 -- Match the stage-capture lock order: project, property, then task.
 SELECT p.* INTO project FROM public.onboarding_projects p WHERE p.property_id=target_property_id AND p.status<>'cancelled' FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Start the onboarding project before overriding its dates.'; END IF;
 IF NOT coalesce(public.is_supervisor(_actor_id) OR project.project_manager=_actor_id OR project.director=_actor_id,false) THEN RAISE EXCEPTION 'Only this project lead or a supervisor can override dates.'; END IF;
 SELECT * INTO home FROM public.properties WHERE id=project.property_id FOR UPDATE;
 IF NOT FOUND OR home.handoff_accepted_at IS NOT NULL OR home.lifecycle_status IN ('handoff_requested','active_operations','offboarded') THEN RAISE EXCEPTION 'Return the handoff before changing this date.'; END IF;
 SELECT * INTO task FROM public.onboarding_tasks WHERE id=_task_id FOR UPDATE;
 IF NOT FOUND OR task.property_id IS DISTINCT FROM project.property_id OR task.archived_at IS NOT NULL OR task.status IN ('complete','carryover') THEN RAISE EXCEPTION 'That task is not available for a date change.'; END IF;
 IF _expected_updated_at IS NULL OR task.updated_at IS DISTINCT FROM _expected_updated_at THEN RAISE EXCEPTION 'This task changed. Refresh before overriding its date.'; END IF;
 SELECT new_value::jsonb INTO capture FROM public.onboarding_project_events WHERE project_id=project.id AND kind='stage_capture:' || task.stage ORDER BY (new_value::jsonb->>'revision')::integer DESC LIMIT 1;
 IF capture->>'status' IN ('complete','awaiting_review') THEN RAISE EXCEPTION 'Return or reopen the stage before overriding its date.'; END IF;
 IF task.due_on IS NOT DISTINCT FROM _due_on THEN RAISE EXCEPTION 'Choose a different due date.'; END IF;
 UPDATE public.onboarding_tasks SET due_on=_due_on,due_on_overridden=true,due_on_source='manual',updated_at=now() WHERE id=task.id;
 INSERT INTO public.onboarding_project_events(project_id,property_id,kind,summary,detail,prior_value,new_value,actor,is_demo)
 VALUES(project.id,project.property_id,'task_date_overridden','Due date changed: ' || task.title,trim(_reason),task.due_on::text,_due_on::text,_actor_id,coalesce(home.is_demo,false));
 RETURN task.id;
END $$;
REVOKE ALL ON FUNCTION public.override_onboarding_task_date(uuid,uuid,timestamptz,date,text) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.override_onboarding_task_date(uuid,uuid,timestamptz,date,text) TO service_role;
