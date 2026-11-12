-- Property page Part 1 (approved by the Admin and the Director of Onboarding, Nov 12).
-- Additive only. Staged, NOT applied. Undo: apply.undo.sql.

-- 1.1 (4): how the owner likes to be reached, and their Telegram, on the owner person record.
ALTER TABLE public.property_owners
  ADD COLUMN preferred_method text,
  ADD COLUMN telegram text;
ALTER TABLE public.property_owners
  ADD CONSTRAINT property_owners_preferred_method_check
    CHECK (preferred_method IS NULL OR preferred_method IN ('text', 'call', 'email', 'telegram')),
  ADD CONSTRAINT property_owners_telegram_check
    CHECK (telegram IS NULL OR length(telegram) BETWEEN 1 AND 80);
COMMENT ON COLUMN public.property_owners.preferred_method IS 'Preferred contact method: text, call, email or telegram. Highlighted on the home page owner row.';
COMMENT ON COLUMN public.property_owners.telegram IS 'Telegram username or t.me link; shown as a Telegram button only when set.';

-- 1.7: one-off Tasks added on a home's page are told apart from plan Tasks.
-- Set by the database on insert (never by the caller): no template step, not a follow-up or carry over,
-- and a signed-in creator. Existing rows are not backfilled (older imports cannot be told apart).
ALTER TABLE public.onboarding_tasks ADD COLUMN is_one_off boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.onboarding_tasks.is_one_off IS 'A Task added to this home only (Add task), never from the plan template. Set by onboarding_tasks_mark_one_off.';

CREATE FUNCTION private.mark_onboarding_one_off() RETURNS trigger
LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.is_one_off := NEW.template_task_id IS NULL AND NEW.follow_up_of IS NULL
      AND NEW.carryover_of IS NULL AND NEW.created_by IS NOT NULL;
  ELSE
    NEW.is_one_off := OLD.is_one_off;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.mark_onboarding_one_off() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER onboarding_tasks_mark_one_off
  BEFORE INSERT OR UPDATE OF is_one_off ON public.onboarding_tasks
  FOR EACH ROW EXECUTE FUNCTION private.mark_onboarding_one_off();

-- 1.4: which stage each Notion Status means, seeded exactly as approved; Admin edits it
-- (app_settings: staff read, Admin write). Contract Fell Through has no stage.
INSERT INTO public.app_settings (key, value)
VALUES ('onboarding_status_stage_map', '{
  "Upcoming Property": 1,
  "Waiting on New House Assessment": 1,
  "Waiting for Design": 2,
  "Waiting for Closing": 2,
  "Waiting for Access to Home": 3,
  "Starting Onboard Process": 3,
  "Repairs": 3,
  "Waiting for Deliveries": 3,
  "Staging/Furniture Setup": 4,
  "Waiting for Handoff": 5,
  "Property Handed Off": 6,
  "Contract Fell Through": null
}'::jsonb)
ON CONFLICT (key) DO NOTHING;
