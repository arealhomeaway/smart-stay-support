CREATE FUNCTION public.home_handoff_requirement_states(_property_id uuid) RETURNS TABLE(requirement_id uuid,state text,task_ids uuid[]) LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT r.id,CASE WHEN choice.state='not_applicable' THEN 'not_applicable'
 WHEN cardinality(r.template_step_ids)=0 OR EXISTS(SELECT 1 FROM unnest(r.template_step_ids) s WHERE NOT EXISTS(SELECT 1 FROM public.onboarding_tasks t WHERE t.property_id=_property_id AND t.archived_at IS NULL AND t.template_task_id=s)) THEN CASE WHEN choice.state='done' THEN 'done' ELSE 'unlinked' END
 WHEN NOT EXISTS(SELECT 1 FROM public.onboarding_tasks t WHERE t.property_id=_property_id AND t.archived_at IS NULL AND t.template_task_id=ANY(r.template_step_ids) AND t.status NOT IN('complete','done')) THEN 'done' ELSE 'open' END,
 coalesce((SELECT array_agg(t.id) FROM public.onboarding_tasks t WHERE t.property_id=_property_id AND t.archived_at IS NULL AND t.template_task_id=ANY(r.template_step_ids)),'{}'::uuid[])
 FROM public.handoff_requirements r LEFT JOIN LATERAL(SELECT d.state FROM public.home_handoff_decisions d WHERE d.property_id=_property_id AND d.requirement_id=r.id ORDER BY d.created_at DESC,d.id DESC LIMIT 1)choice ON true WHERE r.status<>'retired'
$$;
REVOKE ALL ON FUNCTION public.home_handoff_requirement_states(uuid) FROM PUBLIC,anon,authenticated; GRANT EXECUTE ON FUNCTION public.home_handoff_requirement_states(uuid) TO service_role;
CREATE FUNCTION public.read_home_handoff_standard(_property_id uuid) RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _demo boolean;
BEGIN
 IF NOT coalesce(public.is_staff(auth.uid()) OR public.is_onboarding_staff(auth.uid()),false) THEN RAISE EXCEPTION 'Only Onboarding and Operations can read handoff.'; END IF;
 SELECT is_demo INTO _demo FROM public.properties WHERE id=_property_id;
 IF _demo IS NULL OR (coalesce(private.is_synthetic_account(),false) AND NOT _demo) THEN RAISE EXCEPTION 'Home not available.'; END IF;
 RETURN jsonb_build_object('available',true,'requirements',coalesce((SELECT jsonb_agg(r ORDER BY r.category,r.sort_order) FROM public.handoff_requirements r),'[]'),'tasks',coalesce((SELECT jsonb_agg(x) FROM(SELECT t.id,t.title,t.status,t.template_task_id,t.due_on,t.assigned_seat,t.blocks_handoff,public.handoff_step_for_task(t.id) duplicate_step FROM public.onboarding_tasks t WHERE t.property_id=_property_id AND t.archived_at IS NULL)x),'[]'),'decisions',coalesce((SELECT jsonb_agg(x) FROM(SELECT DISTINCT ON(requirement_id) requirement_id,state,reason FROM public.home_handoff_decisions WHERE property_id=_property_id ORDER BY requirement_id,created_at DESC,id DESC)x),'[]'),'carryovers',coalesce((SELECT jsonb_agg(x) FROM(SELECT c.id,c.ticket_id,c.title,t.status,c.due_on FROM public.handoff_carryovers c JOIN public.tickets t ON t.id=c.ticket_id WHERE c.property_id=_property_id AND t.status NOT IN('resolved','closed') AND t.archived_at IS NULL)x),'[]'));
END $$;
REVOKE ALL ON FUNCTION public.read_home_handoff_standard(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.read_home_handoff_standard(uuid) TO authenticated,service_role;
CREATE FUNCTION public.decide_home_handoff_requirement(_property_id uuid,_requirement_id uuid,_state text,_reason text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _demo boolean;s record;
BEGIN
 IF NOT coalesce(public.is_staff(auth.uid()) OR public.is_onboarding_staff(auth.uid()),false) THEN RAISE EXCEPTION 'Only staff can record a home decision.'; END IF;
 SELECT is_demo INTO _demo FROM public.properties WHERE id=_property_id;
 IF _demo IS NULL OR (coalesce(private.is_synthetic_account(),false) AND NOT _demo) THEN RAISE EXCEPTION 'Home not available.'; END IF;
 IF _state NOT IN('done','not_applicable','open') OR length(trim(_reason))=0 THEN RAISE EXCEPTION 'A reason is required.'; END IF;
 SELECT * INTO s FROM public.home_handoff_requirement_states(_property_id) WHERE requirement_id=_requirement_id;
 IF s.requirement_id IS NULL THEN RAISE EXCEPTION 'Requirement not available.'; END IF;
 IF _state='done' AND s.state<>'unlinked' THEN RAISE EXCEPTION 'Complete the linked Tasks instead.'; END IF;
 INSERT INTO public.home_handoff_decisions(property_id,requirement_id,state,reason,actor_id,is_demo) VALUES(_property_id,_requirement_id,_state,trim(_reason),auth.uid(),_demo);
 INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,entity_label,before_value,after_value) VALUES(auth.uid(),'handoff_requirement_decision','property',_property_id,'Home requirement decision',jsonb_build_object('state',s.state),jsonb_build_object('requirement_id',_requirement_id,'state',_state,'reason',trim(_reason)));
END $$;
REVOKE ALL ON FUNCTION public.decide_home_handoff_requirement(uuid,uuid,text,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.decide_home_handoff_requirement(uuid,uuid,text,text) TO authenticated,service_role;
