BEGIN;
-- Do not run after real SOP uploads without exporting their lineage first.
DROP TRIGGER copy_sop_playbook_link ON public.playbooks;
DROP FUNCTION private.copy_sop_playbook_link();
DROP FUNCTION public.sop_upload_context(text),public.reserve_sop_upload(text,uuid,date),public.commit_sop_upload(uuid,jsonb,jsonb),public.sop_upload_receipt(uuid),public.abort_sop_upload(uuid),public.read_sop_playbook_links();
DROP TABLE public.sop_playbooks;
DROP TABLE public.sop_versions;
COMMIT;
