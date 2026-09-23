CREATE OR REPLACE FUNCTION public.guard_owner_enrollment_activation()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE ids uuid[]; locked_id uuid; program public.owner_programs; home public.properties; joining boolean;
BEGIN
 IF TG_OP='INSERT' THEN ids:=ARRAY[NEW.program_id];
 ELSIF TG_OP='DELETE' THEN ids:=ARRAY[OLD.program_id];
 ELSE ids:=ARRAY[OLD.program_id,NEW.program_id]; END IF;
 FOR locked_id IN SELECT DISTINCT id FROM unnest(ids) id WHERE id IS NOT NULL ORDER BY id LOOP
  PERFORM 1 FROM public.owner_programs WHERE id=locked_id FOR UPDATE NOWAIT;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF NEW.inclusion_status IS DISTINCT FROM 'included' OR NEW.archived_at IS NOT NULL THEN RETURN NEW; END IF;
 SELECT * INTO program FROM public.owner_programs WHERE id=NEW.program_id;
 IF NOT FOUND OR program.archived_at IS NOT NULL OR program.status IN ('closed','completed','complete') THEN
  RAISE EXCEPTION 'This program is no longer open for enrollment changes.';
 END IF;
 SELECT * INTO home FROM public.properties WHERE id=NEW.property_id FOR SHARE NOWAIT;
 IF NOT FOUND OR home.archived_at IS NOT NULL OR home.owner_record_id IS DISTINCT FROM program.owner_record_id
  OR program.owner_record_id IS NULL OR home.is_demo IS DISTINCT FROM program.is_demo OR NEW.is_demo IS DISTINCT FROM program.is_demo THEN
  RAISE EXCEPTION 'Enrollment requires a current Property with the same canonical Owner and demo mode as its program.';
 END IF;
 PERFORM 1 FROM public.property_owners WHERE id=program.owner_record_id AND active FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'Enrollment requires an active canonical Owner.'; END IF;
 joining:=TG_OP='INSERT';
 IF TG_OP='UPDATE' THEN
  joining:=OLD.program_id IS DISTINCT FROM NEW.program_id OR OLD.property_id IS DISTINCT FROM NEW.property_id
   OR OLD.inclusion_status IS DISTINCT FROM 'included' OR OLD.archived_at IS NOT NULL;
 END IF;
 IF joining AND program.started_on IS NOT NULL THEN
  IF auth.uid() IS NULL OR NOT coalesce(public.has_role(auth.uid(),'admin'),false) THEN
   RAISE EXCEPTION 'Adding a property to a program already underway needs administrator approval.';
  END IF;
  -- V2: enrollment is its own fact; a confirmed future closing is allowed. Participation for
  -- that property starts on its closing date (enforced where time is logged).
  IF NOT coalesce(NEW.closing_confirmed,false) OR NEW.closing_date IS NULL THEN
   RAISE EXCEPTION 'Confirm the property''s closing date before adding it to an active program.';
  END IF;
 END IF;
 RETURN NEW;
EXCEPTION WHEN lock_not_available THEN
 RAISE EXCEPTION 'This program or Property is being updated. Refresh and try the enrollment change again.';
END $function$;