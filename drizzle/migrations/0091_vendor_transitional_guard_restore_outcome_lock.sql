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
  ELSIF NEW.transitional_outcome IS DISTINCT FROM OLD.transitional_outcome AND _uid IS NOT NULL THEN
    RAISE EXCEPTION 'The Transitional Review outcome is recorded automatically.';
  END IF;
  RETURN NEW;
END $$;