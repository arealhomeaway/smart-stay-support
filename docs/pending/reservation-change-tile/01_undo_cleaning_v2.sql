-- STAGED ONLY. Non-destructive undo republishes original v1 content as v3.
-- Original v1/v2 rows and existing ticket pins/history remain unchanged.
DO $$
DECLARE original public.playbooks; current_version public.playbooks; new_id uuid;
BEGIN
  SELECT * INTO original FROM public.playbooks WHERE id='a998f212-8b1c-4905-984b-482c2815cd82';
  SELECT * INTO current_version FROM public.playbooks WHERE checklist_category='cleaning' AND status='approved' FOR UPDATE;
  IF original.version<>1 OR md5(original.checklist::text)<>'a54db86e7ac93640746fe90e7464d563'
    OR current_version.version<>2 OR current_version.supersedes_id IS DISTINCT FROM original.id
    OR current_version.review_note IS DISTINCT FROM 'Emily approved: same-cleaner repeat complaints within 60 days.' THEN
    RAISE EXCEPTION 'Cleaning lineage changed. Stop and obtain a new undo review.';
  END IF;
  new_id := public.publish_ticket_checklist('cleaning',original.title,original.checklist,original.sop_url,
    'Undo reservation-change-tile cleaning revision by republishing original content.');
  RAISE NOTICE 'Published original content as cleaning version 3: %', new_id;
END $$;