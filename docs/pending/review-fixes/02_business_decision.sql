-- PENDING ONLY. No existing row changes. The three template corrections are separate.
CREATE FUNCTION public.owner_business_decision_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path TO public, pg_temp AS $function$
DECLARE approval_required boolean;
BEGIN
  approval_required:=NEW.owner_dependency='business_decision' OR coalesce(NEW.requires_owner_approval,false);
  IF TG_TABLE_NAME='onboarding_template_tasks' THEN
    -- Existing mismatches are not silently repaired by unrelated saves.
    IF NEW.owner_dependency='business_decision' AND NOT coalesce(NEW.requires_owner_approval,false) THEN
      IF TG_OP='INSERT' THEN
        RAISE EXCEPTION 'A business decision requires homeowner approval. Turn on Requires owner approval.';
      ELSIF NEW.owner_dependency IS DISTINCT FROM OLD.owner_dependency OR NEW.requires_owner_approval IS DISTINCT FROM OLD.requires_owner_approval THEN
        RAISE EXCEPTION 'A business decision requires homeowner approval. Turn on Requires owner approval.';
      END IF;
    END IF;
  ELSIF NEW.status IN ('complete','done') AND approval_required AND NEW.owner_approval_status IS DISTINCT FROM 'approved' THEN
    IF TG_OP='INSERT' THEN
      RAISE EXCEPTION 'A homeowner decision is required before this Task can be completed.';
    ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'A homeowner decision is required before this Task can be completed.';
    END IF;
  END IF;
  RETURN NEW;
END $function$;
REVOKE ALL ON FUNCTION public.owner_business_decision_guard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_business_decision_guard() TO authenticated, service_role;
CREATE TRIGGER owner_business_decision_template_guard BEFORE INSERT OR UPDATE ON public.onboarding_template_tasks
FOR EACH ROW EXECUTE FUNCTION public.owner_business_decision_guard();
CREATE TRIGGER owner_business_decision_completion_guard BEFORE INSERT OR UPDATE OF status ON public.onboarding_tasks
FOR EACH ROW EXECUTE FUNCTION public.owner_business_decision_guard();