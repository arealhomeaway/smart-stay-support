CREATE OR REPLACE FUNCTION public.protect_onboarding_project_assignments()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE authority boolean; assigned_director uuid; assignments_changed boolean;
BEGIN
 IF auth.uid() IS NULL OR NOT coalesce(public.is_onboarding_staff(auth.uid()),false) THEN
  RAISE EXCEPTION 'Onboarding project changes require a signed-in Onboarding staff account.';
 END IF;
 authority:=coalesce(private.can_assign_onboarding_responsibility(auth.uid()),false);
 IF TG_OP='INSERT' THEN
  IF NOT authority THEN
   assigned_director:=private.current_onboarding_director();
   IF NEW.project_manager IS NOT NULL AND NEW.project_manager IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only Onboarding leadership can assign another project manager.';
   END IF;
   IF NEW.director IS NOT NULL AND NEW.director IS DISTINCT FROM assigned_director THEN
    RAISE EXCEPTION 'The Onboarding Director comes from the protected responsibility seat.';
   END IF;
   NEW.project_manager:=auth.uid();
   NEW.director:=assigned_director;
  END IF;
  IF NEW.started_by IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Project creation must record its signed-in actor.'; END IF;
  assignments_changed:=true;
 ELSE
  assignments_changed:=NEW.project_manager IS DISTINCT FROM OLD.project_manager OR NEW.director IS DISTINCT FROM OLD.director
   OR NEW.property_id IS DISTINCT FROM OLD.property_id;
  IF assignments_changed AND NOT authority THEN
   RAISE EXCEPTION 'Only a platform administrator or the trusted Onboarding Director can change project responsibility.';
  END IF;
  IF NEW.started_by IS DISTINCT FROM OLD.started_by OR NEW.started_at IS DISTINCT FROM OLD.started_at THEN
   RAISE EXCEPTION 'Preserve the original project creation record.';
  END IF;
 END IF;
 IF assignments_changed THEN
  IF (NEW.project_manager IS NOT NULL AND NOT private.onboarding_assignment_staff(NEW.project_manager))
   OR (NEW.director IS NOT NULL AND NOT private.onboarding_assignment_staff(NEW.director)) THEN
   RAISE EXCEPTION 'Project responsibility requires existing Onboarding or supervisory staff accounts.';
  END IF;
 END IF;
 RETURN NEW;
END $function$
