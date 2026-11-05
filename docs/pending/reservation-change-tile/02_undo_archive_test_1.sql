-- STAGED ONLY. Audited compensating undo creates/approves a new version.
-- No unarchive action exists. Do not restore the old row directly or erase history.
-- Obtain separate approval before reactivating this empty placeholder.
DO $$
DECLARE target public.playbooks; draft jsonb; draft_row public.playbooks;
BEGIN
  SELECT * INTO target FROM public.playbooks WHERE id='afe1a826-eaec-4719-b779-8381ecfcc718' FOR UPDATE;
  IF NOT FOUND OR target.title IS DISTINCT FROM 'TEST 1' OR target.status IS DISTINCT FROM 'retired'
    OR target.review_note IS DISTINCT FROM 'Emily approved: archive empty TEST 1 placeholder.'
    OR target.checklist IS NOT NULL OR EXISTS(SELECT 1 FROM public.playbook_steps WHERE playbook_id=target.id) THEN
    RAISE EXCEPTION 'TEST 1 lineage changed. Stop and review undo.';
  END IF;
  draft := public.save_playbook_draft(target.id,target.updated_at,jsonb_build_object(
    'title',target.title,'summary',target.summary,'category',target.category,'applies_to',to_jsonb(target.applies_to),
    'keywords',coalesce(target.matcher->'keywords','[]'::jsonb),'risk_flags',target.risk_flags,
    'immediate_actions',to_jsonb(target.immediate_actions),'escalate_if',to_jsonb(target.escalate_if),
    'required_evidence',to_jsonb(target.required_evidence),'steps','[]'::jsonb));
  SELECT * INTO draft_row FROM public.playbooks WHERE id=(draft->>'id')::uuid;
  PERFORM public.change_playbook_state(draft_row.id,draft_row.updated_at,'approve','Separately approved undo of TEST 1 archive, new version.');
END $$;