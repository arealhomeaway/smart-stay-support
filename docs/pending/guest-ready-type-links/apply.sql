-- Additive display dates only: routine due_at, completion and scorecard clocks are untouched.
ALTER TABLE public.guest_ready_standards ADD COLUMN match_review text CHECK (match_review IS NULL OR match_review = 'lawn');
ALTER TABLE public.routine_controls ADD COLUMN due_on date;
ALTER TABLE public.routine_controls ADD COLUMN guest_ready_standard_id uuid REFERENCES public.guest_ready_standards(id);
COMMENT ON COLUMN public.routine_controls.due_on IS 'Guest-ready display due date; due_at remains the original routine clock and scorecard deadline.';

-- Inherit the existing Ongoing maintenance catalog values, rather than inventing SLA/closure policy.
INSERT INTO public.work_types(name,category,bucket,default_priority,response_minutes,action_start_minutes,completion_target,clock_type,required_closure_evidence,guest_communication_required,playbook_id,active,sort_order,team,functional_role_code,backup_coverage,operating_standard,pending_approval)
SELECT names.name,w.category,w.bucket,w.default_priority,w.response_minutes,w.action_start_minutes,w.completion_target,w.clock_type,w.required_closure_evidence,w.guest_communication_required,w.playbook_id,w.active,w.sort_order,w.team,w.functional_role_code,w.backup_coverage,w.operating_standard,w.pending_approval
FROM public.work_types w CROSS JOIN (VALUES ('Minor items'),('Pest control')) names(name)
WHERE w.id='a5b90e0e-39fc-4d96-860b-d77fb5b793d7' AND NOT EXISTS (SELECT 1 FROM public.work_types x WHERE lower(x.name)=lower(names.name));
UPDATE public.guest_ready_standards SET work_type_id=(SELECT id FROM public.work_types WHERE lower(name)='minor items'),updated_at=now() WHERE id='0949c472-9d93-498c-886b-b7a010af175b';
UPDATE public.guest_ready_standards SET work_type_id=(SELECT id FROM public.work_types WHERE lower(name)='pest control'),updated_at=now() WHERE id='4b46e22f-6f65-418d-a2fd-e5f0fc99b2b3';
UPDATE public.guest_ready_standards SET match_review='lawn',updated_at=now() WHERE id='c6d61d7e-d08b-4ebd-87dd-0762a6a941dd';

CREATE FUNCTION private.lawn_guest_ready_date(_title text,_kind text,_created_at timestamptz,_event_key text)
 RETURNS TABLE(standard_id uuid,due_on date) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO public,private AS $$
DECLARE s public.guest_ready_standards; base timestamptz;
BEGIN
 IF _kind <> 'maintenance_review' OR coalesce(_title,'') !~* 'lawn|landscap|yard|mow|irrigation|sprinkler' THEN RETURN; END IF;
 SELECT * INTO s FROM public.guest_ready_standards WHERE match_review='lawn' ORDER BY sort_order LIMIT 1;
 IF s.id IS NULL THEN RETURN; END IF;
 SELECT finished_at INTO base FROM public.breezeway_work_orders WHERE 'bz_maint:'||id::text=_event_key;
 base:=coalesce(base,_created_at);
 standard_id:=s.id;
 due_on:=CASE s.rule WHEN 'days' THEN (base AT TIME ZONE 'America/Chicago')::date+coalesce(s.rule_days,7)
   WHEN 'same_day' THEN (base AT TIME ZONE 'America/Chicago')::date
   WHEN 'clean_day_4pm' THEN (base AT TIME ZONE 'America/Chicago')::date ELSE NULL END;
 RETURN NEXT;
END $$;
REVOKE ALL ON FUNCTION private.lawn_guest_ready_date(text,text,timestamptz,text) FROM PUBLIC,anon,authenticated;
CREATE FUNCTION private.routine_guest_ready_default() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public,private AS $$
DECLARE r record;
BEGIN
 SELECT * INTO r FROM private.lawn_guest_ready_date(NEW.title,NEW.kind,NEW.created_at,NEW.event_key);
 IF FOUND THEN NEW.guest_ready_standard_id:=r.standard_id; IF NEW.due_on IS NULL THEN NEW.due_on:=r.due_on; END IF; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.routine_guest_ready_default() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER routine_guest_ready_default BEFORE INSERT ON public.routine_controls FOR EACH ROW EXECUTE FUNCTION private.routine_guest_ready_default();
-- Populate only the new fields; no stored routine clock/status/owner/capture facts change.
UPDATE public.routine_controls rc SET due_on=r.due_on,guest_ready_standard_id=r.standard_id
FROM (SELECT x.id,d.* FROM public.routine_controls x CROSS JOIN LATERAL private.lawn_guest_ready_date(x.title,x.kind,x.created_at,x.event_key) d WHERE x.status IN ('due','in_progress')) r WHERE rc.id=r.id;
