UPDATE public.vendor_orgs SET is_active = false, status = 'suspended' WHERE status = 'inactive';
ALTER TABLE public.vendor_orgs DROP CONSTRAINT vendor_orgs_status_chk;
ALTER TABLE public.vendor_orgs ADD CONSTRAINT vendor_orgs_status_chk
  CHECK (status IN ('candidate','pilot','approved','gold','corrective_action','suspended'));
COMMENT ON COLUMN public.vendor_orgs.status IS 'Gold Standard / Qualification Status. Operational Active/Inactive lives only in is_active.';
COMMENT ON COLUMN public.vendor_orgs.is_active IS 'Operational Vendor Status (Active/Inactive). Independent of qualification status.';

CREATE OR REPLACE FUNCTION private.vendor_orgs_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); is_admin boolean; is_lead boolean; is_sup boolean; is_staff boolean;
  k text; o jsonb; n jsonb;
  system_cols text[] := ARRAY['dispatch_method','breezeway_person_id','source_system','legacy_notion_id','migration_status','legacy_fields','created_by','created_at'];
  gold_cols text[] := ARRAY['status','compliance_status','score_capacity','score_responsiveness','score_quality','score_hospitality','score_communication','score_pricing','score_references','performance_score','jobs_90d','critical_failure','last_review_on','next_review_on','program_owner','open_corrective_action','corrective_action_due','tier','trial_score'];
  skip_cols text[] := ARRAY['updated_at','qualification_score'];
BEGIN
  IF uid IS NULL THEN RETURN NEW; END IF;
  is_admin := public.has_role(uid,'admin');
  is_lead := is_admin OR private.is_director(uid);
  is_sup := is_lead OR private.is_supervisor(uid);
  is_staff := private.is_staff(uid);
  o := to_jsonb(OLD); n := to_jsonb(NEW);
  FOR k IN SELECT jsonb_object_keys(n) LOOP
    IF k = ANY(skip_cols) OR (o->k) IS NOT DISTINCT FROM (n->k) THEN CONTINUE; END IF;
    IF k = ANY(system_cols) AND NOT is_lead THEN
      RAISE EXCEPTION 'The % field is a protected system field. Only Admin or the Director of Operations can change it.', k;
    END IF;
    IF k = ANY(gold_cols) AND NOT is_sup THEN
      RAISE EXCEPTION 'Only Operations leadership can change Gold Standard or compliance fields.';
    END IF;
    IF NOT is_staff AND k NOT IN ('primary_contact_name','primary_contact_email','primary_contact_phone','website','notes') THEN
      RAISE EXCEPTION 'Vendor accounts can only update their contact details.';
    END IF;
    INSERT INTO public.vendor_field_audit(org_id, field, old_value, new_value, changed_by)
      VALUES (NEW.id, k, o->k, n->k, uid);
  END LOOP;
  IF NEW.status IN ('approved','gold') AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT private.vendor_gates_clear(NEW.id) THEN
      RAISE EXCEPTION 'A required qualification gate is not complete. A score cannot override a failed gate.';
    END IF;
    IF NEW.critical_failure THEN
      RAISE EXCEPTION 'This vendor has an open critical failure and cannot be Approved or Gold.';
    END IF;
  END IF;
  RETURN NEW;
END $$;