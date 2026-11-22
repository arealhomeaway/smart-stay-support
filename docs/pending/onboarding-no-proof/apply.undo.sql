-- onboarding-no-proof undo: puts the three proof checks back exactly as they were, inside the live
-- definitions (reverse of apply.sql). One transaction. One audit row.
DO $undo$
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
  SELECT p.oid::regprocedure INTO f_bw FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'complete_onboarding_from_breezeway';
  SELECT p.oid::regprocedure INTO f_ho FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'create_onboarding_handoff';

  def := pg_get_functiondef(f_bulk);
  IF (length(def) - length(replace(def, new_bulk, ''))) / length(new_bulk) <> 1 THEN
    RAISE EXCEPTION 'onboarding-no-proof undo: Mark done marker not found exactly once';
  END IF;
  EXECUTE replace(def, new_bulk, old_bulk);

  def := pg_get_functiondef(f_bw);
  IF (length(def) - length(replace(def, new_bw, ''))) / length(new_bw) <> 1 THEN
    RAISE EXCEPTION 'onboarding-no-proof undo: Breezeway completion marker not found exactly once';
  END IF;
  EXECUTE replace(def, new_bw, old_bw);

  def := pg_get_functiondef(f_ho);
  IF (length(def) - length(replace(def, new_ho, ''))) / length(new_ho) <> 1
     OR (length(def) - length(replace(def, new_msg, ''))) / length(new_msg) <> 1 THEN
    RAISE EXCEPTION 'onboarding-no-proof undo: handoff marker not found exactly once';
  END IF;
  EXECUTE replace(replace(def, new_ho, old_ho), new_msg, old_msg);

  INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
  VALUES (NULL, 'onboarding_no_proof.undone', 'function', NULL, 'Onboarding proof checks restored', '{}'::jsonb);
END $undo$;
