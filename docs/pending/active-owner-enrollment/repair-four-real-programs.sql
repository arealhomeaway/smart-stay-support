-- APPROVAL ONLY — DO NOT RUN until Emily approves the exact manifest and notifications.
-- Run as the approving Admin/Onboarding Director's authenticated session, not an anonymous service role.
-- Requires 0160 applied first. No closing-date/account/hour/welcome changes. Defaults to ROLLBACK for review.
BEGIN;
DO $$
DECLARE id uuid; p public.owner_programs; r jsonb; opened int;
BEGIN
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.is_onboarding_director(auth.uid())) THEN RAISE EXCEPTION 'An approving Admin or Onboarding Director is required.'; END IF;
 FOREACH id IN ARRAY ARRAY[
  '579cb6ae-c5a5-4aa3-aac2-64eedd2faafe'::uuid,
  '6cc0d779-9d06-472f-95c1-0a14dfe3b398'::uuid,
  '814b9c32-0910-499b-b4ac-2c7fc026569b'::uuid,
  '2d05252c-dd0d-4473-adf8-b979fc5b5216'::uuid] LOOP
  SELECT * INTO p FROM owner_programs WHERE owner_programs.id=id AND NOT is_demo AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The approved program is missing or changed.'; END IF;
  IF p.id='579cb6ae-c5a5-4aa3-aac2-64eedd2faafe' AND p.status='draft' THEN
   IF NOT EXISTS(SELECT 1 FROM owner_program_properties e JOIN properties h ON h.id=e.property_id
    WHERE e.program_id=p.id AND e.inclusion_status='included' AND e.archived_at IS NULL AND e.closing_confirmed
    AND e.closing_date=h.actual_closing_on AND e.closing_date IS NOT NULL) THEN
    RAISE EXCEPTION 'Linder closing must still be confirmed and consistent.';
   END IF;
   PERFORM public.activate_owner_program(p.id,p.report_version,NULL);
  END IF;
  SELECT * INTO p FROM owner_programs WHERE owner_programs.id=id;
  IF p.status NOT IN ('active','target_reached') THEN RAISE EXCEPTION 'Program is no longer active; review before repair.'; END IF;
  r:=public.change_owner_program(p.id,p.report_version,'seed_roadmap',_phase=>'onboarding');
  SELECT * INTO p FROM owner_programs WHERE owner_programs.id=id;
  r:=public.change_owner_program(p.id,p.report_version,'seed_roadmap',_phase=>'ongoing');
  -- Open only prepared template Opportunities. Completed/manual records and internal Tasks untouched.
  -- Batch release (needs 0160): no per-Opportunity alerts; exactly one summary per program.
  PERFORM public.owner_release_batch_begin();
  UPDATE owner_reviews SET status='awaiting_owner' WHERE program_id=p.id AND status='prepared' AND template_id IS NOT NULL;
  GET DIAGNOSTICS opened = ROW_COUNT;
  PERFORM public.owner_release_summary(p.id, opened, NULL);
 END LOOP;
END $$;
ROLLBACK;
-- WARNING: ROLLBACK is not a safe live notification dry run: network-trigger effects may escape transaction rollback.
-- Use only an isolated test database first. Replace ROLLBACK with COMMIT only after explicit release approval.
