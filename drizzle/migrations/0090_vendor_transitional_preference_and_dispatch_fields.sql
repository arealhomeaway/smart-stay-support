CREATE OR REPLACE FUNCTION private.vendor_transitional_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _pref text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.transitional_review THEN
      _pref := lower(coalesce(NEW.legacy_fields->>'Notion: preference',''));
      IF NEW.source_system IS DISTINCT FROM 'notion'
         OR coalesce(NEW.legacy_fields->>'Notion: vendor status','') NOT IN ('Active','Last Resort')
         OR _pref LIKE '%do not use%' OR _pref LIKE '%no longer using%'
         OR _pref ~ 'home\s*owner''?s vendor' THEN
        RAISE EXCEPTION 'Transitional Review is only for existing ARHA vendors migrated from Notion as Active or Last Resort, not marked Do Not Use, No Longer Using or Home Owner''s Vendor.';
      END IF;
      NEW.transitional_started_on := current_date;
      NEW.transitional_deadline := current_date + 60;
      NEW.transitional_outcome := NULL;
      NEW.transitional_ended_at := NULL;
    ELSE
      NEW.transitional_started_on := NULL; NEW.transitional_deadline := NULL;
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.transitional_started_on IS DISTINCT FROM OLD.transitional_started_on
     OR NEW.transitional_deadline IS DISTINCT FROM OLD.transitional_deadline THEN
    IF _uid IS NOT NULL THEN RAISE EXCEPTION 'The Transitional Review deadline cannot be changed.'; END IF;
  END IF;
  IF NEW.transitional_review AND NOT OLD.transitional_review THEN
    RAISE EXCEPTION 'Transitional Review cannot be granted again after it has ended.';
  END IF;
  IF NOT NEW.transitional_review AND OLD.transitional_review THEN
    IF _uid IS NOT NULL AND NOT private.is_supervisor(_uid) THEN
      RAISE EXCEPTION 'Only leadership can end Transitional Review.';
    END IF;
    NEW.transitional_ended_at := coalesce(NEW.transitional_ended_at, now());
    NEW.transitional_outcome := coalesce(NEW.transitional_outcome, 'ended_by_leadership');
  END IF;
  RETURN NEW;
END $$;

-- Imported ≠ dispatchable: routine selection also needs a market/category and a way to reach the vendor.
CREATE OR REPLACE FUNCTION public.vendor_dispatch_eligible(_org uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_orgs o
    WHERE o.id = _org AND o.is_active
      AND o.status <> 'suspended'
      AND (
        (o.status IN ('pilot','approved','gold','corrective_action')
          AND (o.status NOT IN ('approved','gold') OR (private.vendor_gates_clear(o.id) AND NOT coalesce(o.critical_failure,false))))
        OR (o.transitional_review AND o.transitional_deadline >= current_date AND NOT coalesce(o.critical_failure,false))
      )
      AND (nullif(trim(coalesce(o.primary_contact_phone,'')),'') IS NOT NULL OR nullif(trim(coalesce(o.primary_contact_email,'')),'') IS NOT NULL)
      AND EXISTS (SELECT 1 FROM public.vendor_market_coverage c WHERE c.org_id = o.id)
      AND NOT EXISTS (
        SELECT 1 FROM public.vendor_gatekeeper_results g
        JOIN public.gatekeeper_requirements q ON q.id = g.requirement_id AND q.active AND q.expiry_required
        WHERE g.org_id = o.id AND g.expires_on IS NOT NULL AND g.expires_on < current_date)
  )
$$;