-- Nov 12 completion build, items 1 and 8. NOT APPLIED. Additive only.
-- 1. Inspection date lives on the onboarding project (Fill in Resolve and Home info read it).
ALTER TABLE public.onboarding_projects ADD COLUMN IF NOT EXISTS inspection_on date;
COMMENT ON COLUMN public.onboarding_projects.inspection_on IS 'Home inspection date, filled on Fill in Resolve Tasks and shown on Home info.';

-- 8. A follow-up Task points at the Task it came from (same home only, never itself).
ALTER TABLE public.onboarding_tasks ADD COLUMN IF NOT EXISTS follow_up_of uuid REFERENCES public.onboarding_tasks(id) ON DELETE SET NULL;
COMMENT ON COLUMN public.onboarding_tasks.follow_up_of IS 'The Task this follow-up was added from (Add a follow-up Task).';
CREATE INDEX IF NOT EXISTS onboarding_tasks_follow_up_of_idx ON public.onboarding_tasks(follow_up_of) WHERE follow_up_of IS NOT NULL;

CREATE OR REPLACE FUNCTION private.onboarding_follow_up_same_home()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.follow_up_of IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.follow_up_of IS NOT DISTINCT FROM OLD.follow_up_of THEN RETURN NEW; END IF;
  IF NEW.follow_up_of = NEW.id THEN RAISE EXCEPTION 'A Task cannot follow up on itself.'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.onboarding_tasks s WHERE s.id = NEW.follow_up_of AND s.property_id = NEW.property_id) THEN
    RAISE EXCEPTION 'A follow-up must be on the same home as its Task.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS onboarding_follow_up_same_home ON public.onboarding_tasks;
CREATE TRIGGER onboarding_follow_up_same_home BEFORE INSERT OR UPDATE OF follow_up_of ON public.onboarding_tasks
  FOR EACH ROW EXECUTE FUNCTION private.onboarding_follow_up_same_home();
