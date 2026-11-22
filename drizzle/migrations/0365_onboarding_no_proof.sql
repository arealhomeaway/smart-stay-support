-- onboarding-no-proof (Nov 22, decisions O7 and O8 changed by the Admin): onboarding Tasks no longer
-- require or ask for proof. One transaction. Removes only the three proof checks below, inside the live
-- definitions, so every other rule in each function stays exactly as it is. Owners and grants are kept
-- (CREATE OR REPLACE from pg_get_functiondef). No Task, template or saved note is changed.
--  1. bulk_complete_onboarding_tasks (Mark done): no longer refuses a save without a 5 character note.
--  2. complete_onboarding_from_breezeway: no longer skips a Task that has no proof note.
--  3. create_onboarding_handoff: no longer refuses a handoff because a Task has no proof note.
DO $patch$
DECLARE
  def text;
  f_bulk regprocedure := 'public.bulk_complete_onboarding_tasks(uuid,uuid[],text,date,uuid,boolean)';
  f_bw regprocedure;
  f_ho regprocedure;
  old_bulk text := $o$  IF NOT _dry_run AND char_length(_note_clean) < 5 THEN
    RAISE EXCEPTION 'Add a note that says where the proof is (at least 5 characters).';
  END IF;
$o$;
  new_bulk text := $o$  -- Nov 22 (O7, O8 changed): no proof note is required.
$o$;
  old_bw text := $o$ OR (task.evidence_required AND btrim(coalesce(task.evidence_note,''))='')$o$;
  new_bw text := $o$ /* Nov 22 (O7, O8 changed): no proof check */$o$;
  old_ho text := $o$ OR (evidence_required AND length(trim(coalesce(evidence_note,'')))=0)$o$;
  new_ho text := $o$ /* Nov 22 (O7, O8 changed): no proof check */$o$;
  old_msg text := 'Required work, approvals, evidence or blockers prevent handoff.';
  new_msg text := 'Required work, approvals or blockers prevent handoff.';
BEGIN
  IF EXISTS (SELECT 1 FROM public.audit_log WHERE action = 'onboarding_no_proof.apply') THEN
    RAISE EXCEPTION 'onboarding-no-proof: already applied';
  END IF;
  SELECT p.oid::regprocedure INTO f_bw FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'complete_onboarding_from_breezeway';
  SELECT p.oid::regprocedure INTO f_ho FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'create_onboarding_handoff';
  IF f_bw IS NULL OR f_ho IS NULL THEN RAISE EXCEPTION 'onboarding-no-proof: a function is missing'; END IF;

  def := pg_get_functiondef(f_bulk);
  IF (length(def) - length(replace(def, old_bulk, ''))) / length(old_bulk) <> 1 THEN
    RAISE EXCEPTION 'onboarding-no-proof: Mark done proof check not found exactly once';
  END IF;
  EXECUTE replace(def, old_bulk, new_bulk);

  def := pg_get_functiondef(f_bw);
  IF (length(def) - length(replace(def, old_bw, ''))) / length(old_bw) <> 1 THEN
    RAISE EXCEPTION 'onboarding-no-proof: Breezeway completion proof check not found exactly once';
  END IF;
  EXECUTE replace(def, old_bw, new_bw);

  def := pg_get_functiondef(f_ho);
  IF (length(def) - length(replace(def, old_ho, ''))) / length(old_ho) <> 1
     OR (length(def) - length(replace(def, old_msg, ''))) / length(old_msg) <> 1 THEN
    RAISE EXCEPTION 'onboarding-no-proof: handoff proof check not found exactly once';
  END IF;
  EXECUTE replace(replace(def, old_ho, new_ho), old_msg, new_msg);

  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
  VALUES (NULL, 'onboarding_no_proof.apply', 'function', NULL, 'Onboarding Tasks need no proof (O7, O8 changed)',
    jsonb_build_object('functions', jsonb_build_array('bulk_complete_onboarding_tasks', 'complete_onboarding_from_breezeway', 'create_onboarding_handoff')));
END $patch$;