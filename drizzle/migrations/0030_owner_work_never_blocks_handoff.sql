CREATE OR REPLACE FUNCTION public.owner_work_never_blocks_handoff()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  -- V2 rule: homeowner decisions and Active Owner work never block handoff.
  IF coalesce(NEW.requires_owner_approval,false)
     OR coalesce(NEW.tags,'{}'::text[]) @> ARRAY['active_owner'] THEN
    NEW.blocks_handoff := false;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS owner_work_never_blocks_handoff ON public.onboarding_tasks;
CREATE TRIGGER owner_work_never_blocks_handoff BEFORE INSERT OR UPDATE ON public.onboarding_tasks
FOR EACH ROW EXECUTE FUNCTION public.owner_work_never_blocks_handoff();

DROP TRIGGER IF EXISTS owner_work_never_blocks_handoff ON public.onboarding_template_tasks;
CREATE TRIGGER owner_work_never_blocks_handoff BEFORE INSERT OR UPDATE ON public.onboarding_template_tasks
FOR EACH ROW EXECUTE FUNCTION public.owner_work_never_blocks_handoff();

UPDATE public.onboarding_tasks SET blocks_handoff=false
 WHERE blocks_handoff AND (coalesce(requires_owner_approval,false) OR coalesce(tags,'{}'::text[]) @> ARRAY['active_owner']);
UPDATE public.onboarding_template_tasks SET blocks_handoff=false
 WHERE blocks_handoff AND (coalesce(requires_owner_approval,false) OR coalesce(tags,'{}'::text[]) @> ARRAY['active_owner']);