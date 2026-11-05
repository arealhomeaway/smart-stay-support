-- STAGED ONLY. Requires the playbook editing migration and approved authenticated caller.
DO $$
DECLARE target public.playbooks;
BEGIN
  SELECT * INTO target FROM public.playbooks WHERE id='afe1a826-eaec-4719-b779-8381ecfcc718' FOR UPDATE;
  IF NOT FOUND OR target.title IS DISTINCT FROM 'TEST 1' OR target.status IS DISTINCT FROM 'active'
    OR target.checklist IS NOT NULL OR md5(to_jsonb(target)::text)<>'f60bef8e2fbc6321d37efa20b9b9f43e'
    OR EXISTS(SELECT 1 FROM public.playbook_steps WHERE playbook_id=target.id) THEN
    RAISE EXCEPTION 'TEST 1 changed. Stop and repeat the precheck.';
  END IF;
  PERFORM public.change_playbook_state(target.id,target.updated_at,'archive','Emily approved: archive empty TEST 1 placeholder.');
END $$;