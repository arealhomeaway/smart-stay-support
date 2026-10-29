CREATE OR REPLACE FUNCTION public.release_owner_program_activities(_program_id uuid, _expected_version uuid, _preview boolean DEFAULT true, _expected_count integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p public.owner_programs; missing int; prepared int; total int; opened int;
 homes text[]; seeded jsonb; added int:=0; nid uuid;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.is_onboarding_director(auth.uid())) THEN
  RAISE EXCEPTION 'Only an Admin or Onboarding Director can release activities.';
 END IF;
 -- Retain canonical identity, demo, lifecycle, version and locking checks.
 p:=private.owner_lifecycle_program(_program_id,_expected_version,true);
 IF coalesce(private.is_synthetic_account(),false) AND NOT p.is_demo THEN
  RAISE EXCEPTION 'Test accounts can only release demo activities.';
 END IF;
 IF p.status NOT IN ('draft','active','target_reached') THEN
  RAISE EXCEPTION 'This program must be draft or active before releasing activities.';
 END IF;
 IF p.owner_user_id IS NULL THEN RAISE EXCEPTION 'Link the homeowner login before releasing activities.'; END IF;
 PERFORM 1 FROM owner_program_properties WHERE program_id=p.id ORDER BY property_id FOR SHARE;
 PERFORM 1 FROM owner_task_templates WHERE active ORDER BY id FOR SHARE;
 SELECT array_agg(public.format_property_label(to_jsonb(h))->>'primary' ORDER BY h.name) INTO homes
 FROM owner_program_properties e JOIN properties h ON h.id=e.property_id
 WHERE e.program_id=p.id AND e.inclusion_status='included';
 IF coalesce(cardinality(homes),0)=0 THEN RAISE EXCEPTION 'Include a home before releasing activities.'; END IF;
 IF p.status='draft' AND NOT EXISTS(
  SELECT 1 FROM owner_program_properties WHERE program_id=p.id AND inclusion_status='included'
   AND archived_at IS NULL AND closing_date IS NOT NULL
 ) THEN RAISE EXCEPTION 'Record a closing date before activating this program.'; END IF;
 -- Same template/property identity as change_owner_program(seed_roadmap).
 SELECT count(*)::int INTO missing FROM owner_task_templates t
 CROSS JOIN LATERAL (
  SELECT e.property_id FROM owner_program_properties e
   WHERE t.phase='onboarding' AND e.program_id=p.id AND e.inclusion_status='included'
  UNION ALL SELECT NULL::uuid WHERE t.phase='ongoing'
 ) target
 WHERE t.active AND t.phase IN ('onboarding','ongoing') AND NOT EXISTS(
   SELECT 1 FROM owner_reviews r WHERE r.program_id=p.id AND r.template_id=t.id
   AND r.property_id IS NOT DISTINCT FROM target.property_id
 );
 SELECT count(*)::int INTO prepared FROM owner_reviews
 WHERE program_id=p.id AND status='prepared' AND template_id IS NOT NULL;
 total:=missing+prepared;
 IF _preview THEN RETURN jsonb_build_object('programId',p.id,'count',total,'missing',missing,
  'prepared',prepared,'homes',to_jsonb(homes),'reportVersion',p.report_version); END IF;
 IF _expected_count IS NULL OR _expected_count<>total THEN
  RAISE EXCEPTION 'The activities changed. Review the current count before releasing.';
 END IF;
 IF total=0 THEN RETURN jsonb_build_object('programId',p.id,'added',0,'opened',0,'summaryId',NULL); END IF;
 IF p.status='draft' THEN
  PERFORM public.activate_owner_program(p.id,p.report_version,NULL);
  SELECT * INTO p FROM owner_programs WHERE id=p.id;
 END IF;
 PERFORM public.owner_release_batch_begin();
 seeded:=public.change_owner_program(p.id,p.report_version,'seed_roadmap',_phase=>'onboarding');
 added:=coalesce((seeded->>'added')::int,0);
 SELECT * INTO p FROM owner_programs WHERE id=p.id;
 seeded:=public.change_owner_program(p.id,p.report_version,'seed_roadmap',_phase=>'ongoing');
 added:=added+coalesce((seeded->>'added')::int,0);
 UPDATE owner_reviews SET status='awaiting_owner'
 WHERE program_id=p.id AND status='prepared' AND template_id IS NOT NULL;
 GET DIAGNOSTICS opened=ROW_COUNT;
 IF opened<>total THEN RAISE EXCEPTION 'The release count changed. Nothing was released; review again.'; END IF;
 nid:=public.owner_release_summary(p.id,opened,NULL);
 IF NOT p.is_demo AND nid IS NULL THEN RAISE EXCEPTION 'The summary could not be queued. Nothing was released.'; END IF;
 RETURN jsonb_build_object('programId',p.id,'added',added,'opened',opened,'summaryId',nid);
END $function$
;