-- onboarding-no-proof preflight (read only). Every row must say ok = true before apply.
WITH d AS (
  SELECT p.proname, pg_get_functiondef(p.oid) def, md5(pg_get_functiondef(p.oid)) m
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname IN ('bulk_complete_onboarding_tasks','complete_onboarding_from_breezeway','create_onboarding_handoff'))
SELECT 'Mark done: proof check present once (md5 ' || m || ')' AS check,
  (length(def) - length(replace(def, $o$  IF NOT _dry_run AND char_length(_note_clean) < 5 THEN
    RAISE EXCEPTION 'Add a note that says where the proof is (at least 5 characters).';
  END IF;
$o$, ''))) > 0 AS ok FROM d WHERE proname = 'bulk_complete_onboarding_tasks'
UNION ALL SELECT 'Breezeway completion: proof check present once (md5 ' || m || ')',
  (length(def) - length(replace(def, $o$ OR (task.evidence_required AND btrim(coalesce(task.evidence_note,''))='')$o$, ''))) > 0
  FROM d WHERE proname = 'complete_onboarding_from_breezeway'
UNION ALL SELECT 'Handoff: proof check and message present once (md5 ' || m || ')',
  (length(def) - length(replace(def, $o$ OR (evidence_required AND length(trim(coalesce(evidence_note,'')))=0)$o$, ''))) > 0
  AND position('Required work, approvals, evidence or blockers prevent handoff.' in def) > 0
  FROM d WHERE proname = 'create_onboarding_handoff'
UNION ALL SELECT 'exactly one of each function', (SELECT count(*) FROM d) = 3
UNION ALL SELECT 'not applied before', NOT EXISTS (SELECT 1 FROM public.audit_log WHERE action LIKE 'onboarding_no_proof.%');
