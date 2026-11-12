-- Nov 12 build, Part A1: the kind of each onboarding Task. Additive. NOT APPLIED by Lovable.
-- Plan steps and Tasks gain task_kind (default do_it) and kind_settings (the step's email template,
-- trade, fields, where it happens, fallback). A Task copies its step's kind when created.
-- Existing Tasks: work_order by title, send_to_owner when the step needs the owner's approval or a
-- business decision, otherwise do_it. No other kind is guessed. Repeats change nothing.

ALTER TABLE public.onboarding_template_tasks
  ADD COLUMN IF NOT EXISTS task_kind text NOT NULL DEFAULT 'do_it',
  ADD COLUMN IF NOT EXISTS kind_settings jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.onboarding_tasks
  ADD COLUMN IF NOT EXISTS task_kind text NOT NULL DEFAULT 'do_it',
  ADD COLUMN IF NOT EXISTS kind_settings jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_template_tasks_task_kind_check') THEN
    ALTER TABLE public.onboarding_template_tasks ADD CONSTRAINT onboarding_template_tasks_task_kind_check
      CHECK (task_kind IN ('do_it','fill_in','upload_files','work_order','send_to_owner','outside_resolve','email','vendor_request','approval'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_tasks_task_kind_check') THEN
    ALTER TABLE public.onboarding_tasks ADD CONSTRAINT onboarding_tasks_task_kind_check
      CHECK (task_kind IN ('do_it','fill_in','upload_files','work_order','send_to_owner','outside_resolve','email','vendor_request','approval'));
  END IF;
END $$;

-- Backfill existing Tasks by the approved rule only. User triggers are paused for this one
-- statement so no clock, updated time, release or notice changes; one audit row records it.
ALTER TABLE public.onboarding_tasks DISABLE TRIGGER USER;
WITH changed AS (
  UPDATE public.onboarding_tasks SET task_kind = CASE
      WHEN title ~* '^\s*(draft\s+)?work order\s*:' THEN 'work_order'
      WHEN coalesce(requires_owner_approval, false) OR owner_dependency = 'business_decision' THEN 'send_to_owner'
      ELSE 'do_it' END
   WHERE task_kind = 'do_it'
     AND (title ~* '^\s*(draft\s+)?work order\s*:' OR coalesce(requires_owner_approval, false) OR owner_dependency = 'business_decision')
  RETURNING task_kind)
INSERT INTO public.audit_log(actor_id, action, entity_type, entity_label, after_value)
SELECT NULL, 'onboarding_task_kinds_backfilled', 'onboarding_task', 'Task kinds',
       jsonb_build_object('work_order', count(*) FILTER (WHERE task_kind = 'work_order'),
                          'send_to_owner', count(*) FILTER (WHERE task_kind = 'send_to_owner'))
  FROM changed;
ALTER TABLE public.onboarding_tasks ENABLE TRIGGER USER;

-- A new Task copies its step's kind and settings; a Task with no step uses the same rule as the backfill.
CREATE OR REPLACE FUNCTION private.onboarding_task_kind_from_step()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, private AS $$
DECLARE s record;
BEGIN
  IF NEW.task_kind IS DISTINCT FROM 'do_it' OR NEW.kind_settings IS DISTINCT FROM '{}'::jsonb THEN RETURN NEW; END IF;
  IF NEW.template_task_id IS NOT NULL THEN
    SELECT task_kind, kind_settings INTO s FROM public.onboarding_template_tasks WHERE id = NEW.template_task_id;
    IF FOUND THEN
      NEW.task_kind := s.task_kind; NEW.kind_settings := s.kind_settings;
      RETURN NEW;
    END IF;
  END IF;
  NEW.task_kind := CASE
    WHEN NEW.title ~* '^\s*(draft\s+)?work order\s*:' THEN 'work_order'
    WHEN coalesce(NEW.requires_owner_approval, false) OR NEW.owner_dependency = 'business_decision' THEN 'send_to_owner'
    ELSE 'do_it' END;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.onboarding_task_kind_from_step() FROM PUBLIC;

DROP TRIGGER IF EXISTS onboarding_task_kind_from_step ON public.onboarding_tasks;
CREATE TRIGGER onboarding_task_kind_from_step BEFORE INSERT ON public.onboarding_tasks
  FOR EACH ROW EXECUTE FUNCTION private.onboarding_task_kind_from_step();
