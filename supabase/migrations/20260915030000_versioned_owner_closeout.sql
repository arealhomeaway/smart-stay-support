-- Unapplied. Optimistic versioning covers every input read by the closeout report.
ALTER TABLE public.owner_programs ADD COLUMN report_version uuid NOT NULL DEFAULT gen_random_uuid();
CREATE FUNCTION public.stamp_owner_report_version() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN NEW.report_version:=gen_random_uuid(); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.stamp_owner_report_version() FROM PUBLIC,authenticated;
CREATE TRIGGER owner_program_report_version BEFORE UPDATE ON public.owner_programs FOR EACH ROW EXECUTE FUNCTION public.stamp_owner_report_version();

-- Trigger-only: owners need not gain UPDATE access to the program itself.
CREATE FUNCTION public.invalidate_owner_report_version() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE prior_row jsonb; next_row jsonb; program_ids uuid[]; program_id uuid;
BEGIN
 IF TG_OP<>'INSERT' THEN prior_row:=to_jsonb(OLD); END IF;
 IF TG_OP<>'DELETE' THEN next_row:=to_jsonb(NEW); END IF;
 IF TG_TABLE_NAME IN ('owner_program_properties','owner_reviews','owner_time_entries','owner_badges') THEN
  program_ids:=ARRAY[(prior_row->>'program_id')::uuid,(next_row->>'program_id')::uuid];
 ELSIF TG_TABLE_NAME='owner_review_properties' THEN
  SELECT array_agg(DISTINCT r.program_id) INTO program_ids FROM public.owner_reviews r WHERE r.id IN ((prior_row->>'review_id')::uuid,(next_row->>'review_id')::uuid);
 ELSIF TG_TABLE_NAME='owner_time_entry_properties' THEN
  SELECT array_agg(DISTINCT e.program_id) INTO program_ids FROM public.owner_time_entries e WHERE e.id IN ((prior_row->>'entry_id')::uuid,(next_row->>'entry_id')::uuid);
 ELSIF TG_TABLE_NAME='properties' THEN
  SELECT array_agg(DISTINCT p.program_id) INTO program_ids FROM public.owner_program_properties p WHERE p.property_id IN ((prior_row->>'id')::uuid,(next_row->>'id')::uuid);
 ELSE RAISE EXCEPTION 'Unexpected report version source'; END IF;
 FOR program_id IN SELECT DISTINCT id FROM unnest(program_ids) id WHERE id IS NOT NULL ORDER BY id LOOP
  UPDATE public.owner_programs SET report_version=gen_random_uuid() WHERE id=program_id;
 END LOOP;
 RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.invalidate_owner_report_version() FROM PUBLIC,authenticated;
CREATE TRIGGER owner_enrollment_report_version AFTER INSERT OR UPDATE OR DELETE ON public.owner_program_properties FOR EACH ROW EXECUTE FUNCTION public.invalidate_owner_report_version();
CREATE TRIGGER owner_review_report_version AFTER INSERT OR UPDATE OR DELETE ON public.owner_reviews FOR EACH ROW EXECUTE FUNCTION public.invalidate_owner_report_version();
CREATE TRIGGER owner_entry_report_version AFTER INSERT OR UPDATE OR DELETE ON public.owner_time_entries FOR EACH ROW EXECUTE FUNCTION public.invalidate_owner_report_version();
CREATE TRIGGER owner_badge_report_version AFTER INSERT OR UPDATE OR DELETE ON public.owner_badges FOR EACH ROW EXECUTE FUNCTION public.invalidate_owner_report_version();
CREATE TRIGGER owner_review_link_report_version AFTER INSERT OR UPDATE OR DELETE ON public.owner_review_properties FOR EACH ROW EXECUTE FUNCTION public.invalidate_owner_report_version();
CREATE TRIGGER owner_entry_link_report_version AFTER INSERT OR UPDATE OR DELETE ON public.owner_time_entry_properties FOR EACH ROW EXECUTE FUNCTION public.invalidate_owner_report_version();
CREATE TRIGGER owner_property_report_version AFTER UPDATE OR DELETE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.invalidate_owner_report_version();

-- The server checks the canonical checklist against an aggregate loaded AFTER
-- reading the expected version. Any committed input change invalidates that check.
CREATE FUNCTION public.complete_owner_program(_program_id uuid,_actor_id uuid,_expected_version uuid,_report jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE program public.owner_programs%ROWTYPE;
BEGIN
 IF _actor_id IS NULL OR NOT (coalesce(public.has_role(_actor_id,'admin'),false) OR coalesce(public.has_role(_actor_id,'manager'),false)) THEN RAISE EXCEPTION 'Only a supervisor can complete a program.'; END IF;
 SELECT * INTO program FROM public.owner_programs WHERE id=_program_id FOR UPDATE;
 IF NOT FOUND OR _expected_version IS NULL OR program.report_version IS DISTINCT FROM _expected_version THEN RAISE EXCEPTION 'The program or its report inputs changed. Refresh before completing it.'; END IF;
 IF program.status NOT IN ('active','target_reached') OR program.completed_at IS NOT NULL THEN RAISE EXCEPTION 'Only an active program can be completed.'; END IF;
 IF _report IS NULL OR jsonb_typeof(_report) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'A generated closeout report is required.'; END IF;
 UPDATE public.owner_programs SET status='completed',completed_at=now(),completed_by=_actor_id,completion_report=_report WHERE id=program.id;
 INSERT INTO public.owner_program_events(program_id,kind,summary,actor_id,detail)
 VALUES(program.id,'program_completed','ARHA completed the formal program closeout.',_actor_id,jsonb_build_object('reportVersion',_expected_version));
 RETURN program.id;
END $$;
REVOKE ALL ON FUNCTION public.complete_owner_program(uuid,uuid,uuid,jsonb) FROM PUBLIC,authenticated;
GRANT EXECUTE ON FUNCTION public.complete_owner_program(uuid,uuid,uuid,jsonb) TO service_role;
