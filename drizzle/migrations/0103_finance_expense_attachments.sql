CREATE OR REPLACE FUNCTION private.attachment_context(_type text, _id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE h public.properties; t public.tickets; task public.onboarding_tasks; e public.expenses; pid uuid; demo boolean; closed boolean:=false;
BEGIN
 IF _type='property' THEN pid:=_id;
 ELSIF _type='ticket' THEN SELECT * INTO t FROM public.tickets WHERE id=_id FOR SHARE NOWAIT; IF NOT FOUND THEN RAISE EXCEPTION 'Record not found'; END IF; pid:=t.property_id;demo:=t.is_demo;closed:=t.status='closed' OR t.archived_at IS NOT NULL;
 ELSIF _type='onboarding_task' THEN SELECT * INTO task FROM public.onboarding_tasks WHERE id=_id FOR SHARE NOWAIT; IF NOT FOUND THEN RAISE EXCEPTION 'Record not found'; END IF;pid:=task.property_id;demo:=task.is_demo;closed:=task.status='complete' OR task.archived_at IS NOT NULL;
 ELSIF _type='expense' THEN SELECT * INTO e FROM public.expenses WHERE id=_id FOR SHARE NOWAIT; IF NOT FOUND THEN RAISE EXCEPTION 'Record not found'; END IF; pid:=e.property_id; demo:=e.is_demo;
 ELSE RAISE EXCEPTION 'Unsupported attachment record'; END IF;
 IF pid IS NOT NULL THEN
  SELECT * INTO h FROM public.properties WHERE id=pid FOR SHARE NOWAIT;
  IF NOT FOUND OR h.archived_at IS NOT NULL OR (demo IS NOT NULL AND demo<>h.is_demo) THEN RAISE EXCEPTION 'Property context changed'; END IF;
  demo:=h.is_demo;
 END IF;
 RETURN jsonb_build_object('propertyId',pid,'isDemo',coalesce(demo,false),'closed',closed);
END $function$;

-- Finance files are internal-only: uploaded by internal staff, never owner-shared.
CREATE OR REPLACE FUNCTION private.guard_expense_document() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.entity_type = 'expense' OR (TG_OP = 'UPDATE' AND OLD.entity_type = 'expense') THEN
    IF NEW.visibility <> 'internal' OR NEW.requested_from IS NOT NULL OR NEW.owner_recipient_id IS NOT NULL THEN
      RAISE EXCEPTION 'Finance files stay internal and cannot be shared with homeowners';
    END IF;
    IF TG_OP = 'INSERT' AND NOT public.is_internal_staff(NEW.uploaded_by) THEN
      RAISE EXCEPTION 'Only internal staff can attach Finance files';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER documents_expense_guard BEFORE INSERT OR UPDATE ON public.documents
  FOR EACH ROW EXECUTE FUNCTION private.guard_expense_document();