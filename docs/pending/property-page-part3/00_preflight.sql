-- Property page Part 3 preflight (read only). Run first, in the same transaction as apply.sql.
DO $$
DECLARE live_stagers text; live_chk text;
BEGIN
  SELECT md5(pg_get_functiondef('public.set_onboarding_project_stagers(uuid,uuid[])'::regprocedure)) INTO live_stagers;
  IF live_stagers <> '36eab28cd079a5ea1da26b99edfce5ec' THEN
    RAISE EXCEPTION 'Changed since staging: set_onboarding_project_stagers (md5 %).', live_stagers;
  END IF;
  SELECT md5(pg_get_constraintdef(oid)) INTO live_chk FROM pg_constraint WHERE conname = 'documents_category_chk' AND conrelid = 'public.documents'::regclass;
  IF live_chk IS DISTINCT FROM '7bf1e5ee54dc31a41ade142207766690' THEN
    RAISE EXCEPTION 'Changed since staging: documents_category_chk (md5 %).', live_chk;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'onboarding_projects' AND column_name IN ('telegram_url','loa_status')) THEN
    RAISE EXCEPTION 'Telegram or LOA already exists on onboarding_projects.';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'vendor_orgs' AND column_name = 'preferred_contact') THEN
    RAISE EXCEPTION 'preferred_contact already exists on vendor_orgs.';
  END IF;
  IF to_regprocedure('public.save_home_detail_field(uuid,text,text)') IS NOT NULL OR to_regprocedure('public.move_home_file(uuid,text)') IS NOT NULL THEN
    RAISE EXCEPTION 'A function this adds already exists.';
  END IF;
END $$;
