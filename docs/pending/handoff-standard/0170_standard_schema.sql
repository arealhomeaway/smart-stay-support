-- PENDING ONLY. No live application authorized.
CREATE TABLE public.handoff_requirements(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),code text UNIQUE NOT NULL,name text NOT NULL,category text NOT NULL,tier text NOT NULL CHECK(tier IN('essential','micah','nonessential')),done_when text NOT NULL DEFAULT '',proof_needed text NOT NULL DEFAULT '',status text NOT NULL DEFAULT 'proposed' CHECK(status IN('proposed','adopted','retired')),notes text NOT NULL DEFAULT '',sort_order integer NOT NULL DEFAULT 0,template_step_ids uuid[] NOT NULL DEFAULT '{}',updated_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT ON public.handoff_requirements TO authenticated; GRANT ALL ON public.handoff_requirements TO service_role;
ALTER TABLE public.handoff_requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff reads handoff standard" ON public.handoff_requirements FOR SELECT TO authenticated USING(public.is_staff(auth.uid()) OR public.is_onboarding_staff(auth.uid()));
CREATE TABLE public.handoff_standard_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),requirement_id uuid REFERENCES public.handoff_requirements(id),actor_id uuid NOT NULL,actor_name text NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),old_value jsonb,new_value jsonb,action text NOT NULL);
GRANT SELECT ON public.handoff_standard_history TO authenticated; GRANT ALL ON public.handoff_standard_history TO service_role;
ALTER TABLE public.handoff_standard_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff reads standard history" ON public.handoff_standard_history FOR SELECT TO authenticated USING(public.is_staff(auth.uid()) OR public.is_onboarding_staff(auth.uid()));
CREATE TABLE public.handoff_link_suggestions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),requirement_id uuid NOT NULL REFERENCES public.handoff_requirements(id),template_step_id uuid NOT NULL REFERENCES public.onboarding_template_tasks(id),confidence text NOT NULL,confirmed_at timestamptz,confirmed_by uuid,UNIQUE(requirement_id,template_step_id));
GRANT SELECT ON public.handoff_link_suggestions TO authenticated; GRANT ALL ON public.handoff_link_suggestions TO service_role;
ALTER TABLE public.handoff_link_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff reads link suggestions" ON public.handoff_link_suggestions FOR SELECT TO authenticated USING(public.is_staff(auth.uid()) OR public.is_onboarding_staff(auth.uid()));
CREATE TABLE public.home_handoff_decisions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),property_id uuid NOT NULL REFERENCES public.properties(id),requirement_id uuid NOT NULL REFERENCES public.handoff_requirements(id),state text NOT NULL CHECK(state IN('done','not_applicable','open')),reason text NOT NULL CHECK(length(trim(reason))>0),actor_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),is_demo boolean NOT NULL DEFAULT false);
GRANT SELECT ON public.home_handoff_decisions TO authenticated; GRANT ALL ON public.home_handoff_decisions TO service_role;
ALTER TABLE public.home_handoff_decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff reads home decisions" ON public.home_handoff_decisions FOR SELECT TO authenticated USING((public.is_staff(auth.uid()) OR public.is_onboarding_staff(auth.uid())) AND (NOT coalesce(private.is_synthetic_account(),false) OR is_demo));
CREATE TABLE public.handoff_carryovers(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES public.onboarding_projects(id),property_id uuid NOT NULL REFERENCES public.properties(id),item_key text NOT NULL,requirement_id uuid REFERENCES public.handoff_requirements(id),task_ids uuid[] NOT NULL DEFAULT '{}',ticket_id uuid REFERENCES public.tickets(id),title text NOT NULL,category text NOT NULL,owner_role text NOT NULL,due_on date NOT NULL,note text NOT NULL DEFAULT '',accepted_at timestamptz,accepted_by uuid,is_demo boolean NOT NULL DEFAULT false,UNIQUE(project_id,item_key));
GRANT SELECT ON public.handoff_carryovers TO authenticated; GRANT ALL ON public.handoff_carryovers TO service_role;
ALTER TABLE public.handoff_carryovers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff reads carry-over" ON public.handoff_carryovers FOR SELECT TO authenticated USING((public.is_staff(auth.uid()) OR public.is_onboarding_staff(auth.uid())) AND (NOT coalesce(private.is_synthetic_account(),false) OR is_demo));
CREATE TABLE public.handoff_step_history(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),project_id uuid NOT NULL REFERENCES public.onboarding_projects(id),actor_id uuid NOT NULL,step text NOT NULL,items jsonb NOT NULL,booking_block boolean NOT NULL DEFAULT false,booking_block_at timestamptz,created_at timestamptz NOT NULL DEFAULT now(),is_demo boolean NOT NULL DEFAULT false);
GRANT SELECT ON public.handoff_step_history TO authenticated; GRANT ALL ON public.handoff_step_history TO service_role;
ALTER TABLE public.handoff_step_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff reads handoff history" ON public.handoff_step_history FOR SELECT TO authenticated USING((public.is_staff(auth.uid()) OR public.is_onboarding_staff(auth.uid())) AND (NOT coalesce(private.is_synthetic_account(),false) OR is_demo));

CREATE FUNCTION public.can_edit_handoff_standard() RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
 SELECT auth.uid() IS NOT NULL AND (public.has_role(auth.uid(),'admin') OR auth.uid()=public.seat_holder('onboarding_director') OR auth.uid()=public.seat_holder('director_ops') OR auth.uid()=public.seat_holder('director_onboarding') OR auth.uid()=public.seat_holder('operations_director'))
$$;
REVOKE ALL ON FUNCTION public.can_edit_handoff_standard() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.can_edit_handoff_standard() TO authenticated,service_role;
CREATE FUNCTION public.save_handoff_requirement(_value jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _id uuid; old public.handoff_requirements; newrow public.handoff_requirements; _name text; _steps uuid[];
BEGIN
 IF NOT coalesce(public.can_edit_handoff_standard(),false) THEN RAISE EXCEPTION 'Only an Admin or either Director can edit the handoff standard.'; END IF;
 IF length(trim(_value->>'name'))<2 OR length(trim(_value->>'code'))<1 OR length(trim(_value->>'category'))<1 THEN RAISE EXCEPTION 'Name, code and category are required.'; END IF;
 _id:=coalesce((_value->>'id')::uuid,gen_random_uuid());
 SELECT * INTO old FROM public.handoff_requirements WHERE id=_id FOR UPDATE;
 SELECT coalesce(array_agg(value::uuid),'{}'::uuid[]) INTO _steps FROM jsonb_array_elements_text(_value->'template_step_ids');
 IF EXISTS(SELECT 1 FROM unnest(_steps) s WHERE NOT EXISTS(SELECT 1 FROM public.onboarding_template_tasks tt JOIN public.onboarding_templates tpl ON tpl.id=tt.template_id WHERE tt.id=s AND tt.is_active AND NOT tpl.is_archived)) THEN RAISE EXCEPTION 'Choose steps from active templates.'; END IF;
 INSERT INTO public.handoff_requirements(id,code,name,category,tier,done_when,proof_needed,status,notes,sort_order,template_step_ids) VALUES(_id,trim(_value->>'code'),trim(_value->>'name'),trim(_value->>'category'),_value->>'tier',coalesce(_value->>'done_when',''),coalesce(_value->>'proof_needed',''),_value->>'status',coalesce(_value->>'notes',''),(_value->>'sort_order')::int,_steps)
 ON CONFLICT(id) DO UPDATE SET code=excluded.code,name=excluded.name,category=excluded.category,tier=excluded.tier,done_when=excluded.done_when,proof_needed=excluded.proof_needed,status=excluded.status,notes=excluded.notes,sort_order=excluded.sort_order,template_step_ids=excluded.template_step_ids,updated_at=now() RETURNING * INTO newrow;
 SELECT coalesce(full_name,'ARHA staff') INTO _name FROM public.profiles WHERE id=auth.uid();
 INSERT INTO public.handoff_standard_history(requirement_id,actor_id,actor_name,old_value,new_value,action) VALUES(_id,auth.uid(),coalesce(_name,'ARHA staff'),CASE WHEN old.id IS NULL THEN NULL ELSE to_jsonb(old) END,to_jsonb(newrow),CASE WHEN old.id IS NULL THEN 'added' WHEN newrow.status='retired' THEN 'retired' ELSE 'edited' END);
 RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.save_handoff_requirement(jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.save_handoff_requirement(jsonb) TO authenticated,service_role;
CREATE FUNCTION public.confirm_handoff_suggestion(_id uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE s public.handoff_link_suggestions;r public.handoff_requirements;v jsonb;
BEGIN
 IF NOT coalesce(public.can_edit_handoff_standard(),false) THEN RAISE EXCEPTION 'Only an Admin or either Director can confirm a link.'; END IF;
 SELECT * INTO s FROM public.handoff_link_suggestions WHERE id=_id FOR UPDATE;
 IF s.id IS NULL THEN RAISE EXCEPTION 'Suggestion not found.'; END IF;
 IF s.confirmed_at IS NOT NULL THEN RETURN; END IF;
 SELECT * INTO r FROM public.handoff_requirements WHERE id=s.requirement_id FOR UPDATE;
 v:=to_jsonb(r);v:=jsonb_set(v,'template_step_ids',to_jsonb(ARRAY(SELECT DISTINCT x FROM unnest(r.template_step_ids||s.template_step_id) x)));
 PERFORM public.save_handoff_requirement(v);
 UPDATE public.handoff_link_suggestions SET confirmed_at=now(),confirmed_by=auth.uid() WHERE id=s.id;
END $$;
REVOKE ALL ON FUNCTION public.confirm_handoff_suggestion(uuid) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.confirm_handoff_suggestion(uuid) TO authenticated,service_role;
CREATE FUNCTION public.read_handoff_standard() RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
 IF NOT coalesce(public.is_staff(auth.uid()) OR public.is_onboarding_staff(auth.uid()),false) THEN RAISE EXCEPTION 'Only Onboarding and Operations can read this standard.'; END IF;
 RETURN jsonb_build_object('available',true,'canEdit',public.can_edit_handoff_standard(),'requirements',coalesce((SELECT jsonb_agg(r ORDER BY r.category,r.sort_order,r.code) FROM public.handoff_requirements r),'[]'),'steps',coalesce((SELECT jsonb_agg(x) FROM (SELECT tt.id,tt.title,t.name template_name FROM public.onboarding_template_tasks tt JOIN public.onboarding_templates t ON t.id=tt.template_id WHERE tt.is_active AND NOT t.is_archived ORDER BY t.name,tt.sort_order)x),'[]'),'suggestions',coalesce((SELECT jsonb_agg(s) FROM public.handoff_link_suggestions s WHERE confirmed_at IS NULL),'[]'),'history',coalesce((SELECT jsonb_agg(h ORDER BY h.created_at DESC) FROM public.handoff_standard_history h),'[]'));
END $$;
REVOKE ALL ON FUNCTION public.read_handoff_standard() FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.read_handoff_standard() TO authenticated,service_role;

CREATE FUNCTION public.preserve_handoff_history() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN RAISE EXCEPTION 'Handoff history is permanent. Record a new decision instead.';END $$;
REVOKE ALL ON FUNCTION public.preserve_handoff_history() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER handoff_standard_history_permanent BEFORE UPDATE OR DELETE ON public.handoff_standard_history FOR EACH ROW EXECUTE FUNCTION public.preserve_handoff_history();
CREATE TRIGGER home_handoff_decisions_permanent BEFORE UPDATE OR DELETE ON public.home_handoff_decisions FOR EACH ROW EXECUTE FUNCTION public.preserve_handoff_history();
CREATE TRIGGER handoff_step_history_permanent BEFORE UPDATE OR DELETE ON public.handoff_step_history FOR EACH ROW EXECUTE FUNCTION public.preserve_handoff_history();
