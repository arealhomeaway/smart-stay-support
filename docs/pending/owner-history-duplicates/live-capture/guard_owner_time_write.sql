CREATE OR REPLACE FUNCTION public.guard_owner_time_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE trusted name; mutable text[]:=ARRAY['review_status','review_note','reviewed_by','reviewed_at','flagged','review_version'];
BEGIN
 SELECT pg_get_userbyid(proowner) INTO trusted FROM pg_proc WHERE oid='public.log_owner_time_entry(jsonb,uuid[])'::regprocedure;
 IF TG_TABLE_NAME='owner_time_entries' THEN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Participation evidence is immutable. Record a correction instead.'; END IF;
  IF TG_OP='UPDATE' THEN
   IF (to_jsonb(NEW)-mutable) IS DISTINCT FROM (to_jsonb(OLD)-mutable) THEN
    RAISE EXCEPTION 'Participation evidence is immutable. Record a correction instead.';
   END IF;
   IF current_user IS DISTINCT FROM trusted THEN RAISE EXCEPTION 'Review participation through its atomic review action.'; END IF;
   NEW.review_version:=gen_random_uuid();
  ELSIF current_user IS DISTINCT FROM trusted THEN
   RAISE EXCEPTION 'Record participation through its atomic logging or correction action.';
  END IF;
  RETURN NEW;
 ELSIF TG_TABLE_NAME='owner_time_entry_properties' THEN
  IF TG_OP IN ('UPDATE','DELETE') THEN RAISE EXCEPTION 'Historical participation Property links are immutable.'; END IF;
  IF current_user IS DISTINCT FROM trusted THEN RAISE EXCEPTION 'Link participation through its atomic logging or correction action.'; END IF;
  RETURN NEW;
 ELSIF TG_TABLE_NAME='owner_program_events' THEN
  IF TG_OP<>'INSERT' AND OLD.kind IN ('time_entry','time_corrected','time_entry_reviewed') THEN
   RAISE EXCEPTION 'Participation history is immutable.';
  END IF;
  IF TG_OP<>'DELETE' AND NEW.kind IN ('time_entry','time_corrected','time_entry_reviewed') THEN
   IF TG_OP<>'INSERT' OR current_user IS DISTINCT FROM trusted THEN
    RAISE EXCEPTION 'Participation history must be recorded by its atomic action.';
   END IF;
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
 END IF;
 RAISE EXCEPTION 'Unsupported participation write guard.';
END $function$;
