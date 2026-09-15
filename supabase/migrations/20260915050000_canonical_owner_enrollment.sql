-- Unapplied. Existing unbound programs remain unresolved; never infer identity from contact text.
ALTER TABLE public.owner_programs ADD COLUMN owner_record_id uuid REFERENCES public.property_owners(id);
CREATE UNIQUE INDEX owner_program_canonical_owner_active_idx ON public.owner_programs(owner_record_id,is_demo)
 WHERE owner_record_id IS NOT NULL AND archived_at IS NULL AND status NOT IN ('closed','completed');

CREATE FUNCTION public.validate_program_canonical_owner() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE property_owner uuid;
BEGIN
 IF TG_OP='UPDATE' AND NEW.owner_record_id IS NOT DISTINCT FROM OLD.owner_record_id THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.owner_record_id IS NOT NULL THEN RAISE EXCEPTION 'A program canonical Owner cannot be replaced. Preserve its participation history.'; END IF;
 IF TG_OP='UPDATE' AND current_user NOT IN ('postgres','service_role') AND NOT coalesce(public.is_onboarding_staff(auth.uid()),false) THEN RAISE EXCEPTION 'Staff must resolve the canonical Owner link.'; END IF;
 IF NEW.owner_record_id IS NULL THEN RAISE EXCEPTION 'Link the canonical Owner before creating a program.'; END IF;
 SELECT owner_record_id INTO property_owner FROM public.properties WHERE id=NEW.property_id FOR SHARE;
 IF NOT FOUND OR property_owner IS DISTINCT FROM NEW.owner_record_id THEN RAISE EXCEPTION 'Property and program must reference the same canonical Owner.'; END IF;
 IF EXISTS(SELECT 1 FROM public.owner_program_properties e JOIN public.properties p ON p.id=e.property_id WHERE e.program_id=NEW.id AND e.inclusion_status='included' AND p.owner_record_id IS DISTINCT FROM NEW.owner_record_id) THEN RAISE EXCEPTION 'Resolve all enrolled property Owner links before binding this program.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER program_canonical_owner BEFORE INSERT OR UPDATE OF owner_record_id ON public.owner_programs FOR EACH ROW EXECUTE FUNCTION public.validate_program_canonical_owner();

CREATE FUNCTION public.validate_enrollment_canonical_owner() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE program_owner uuid; property_owner uuid;
BEGIN
 IF NEW.inclusion_status IS DISTINCT FROM 'included' THEN RETURN NEW; END IF;
 SELECT owner_record_id INTO program_owner FROM public.owner_programs WHERE id=NEW.program_id FOR UPDATE;
 SELECT owner_record_id INTO property_owner FROM public.properties WHERE id=NEW.property_id FOR SHARE;
 IF program_owner IS NULL OR property_owner IS NULL OR program_owner IS DISTINCT FROM property_owner THEN RAISE EXCEPTION 'Enrollment requires the same canonical Owner on program and Property.'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER enrollment_canonical_owner BEFORE INSERT OR UPDATE OF program_id,property_id,inclusion_status ON public.owner_program_properties FOR EACH ROW EXECUTE FUNCTION public.validate_enrollment_canonical_owner();
REVOKE ALL ON FUNCTION public.validate_program_canonical_owner(), public.validate_enrollment_canonical_owner() FROM PUBLIC,authenticated;
