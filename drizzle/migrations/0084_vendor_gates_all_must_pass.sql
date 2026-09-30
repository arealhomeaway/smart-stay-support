ALTER TABLE public.gatekeeper_requirements
  ADD COLUMN allows_not_applicable boolean NOT NULL DEFAULT false,
  ADD COLUMN allows_equivalent boolean NOT NULL DEFAULT false,
  ADD COLUMN exception_rule text;

UPDATE public.gatekeeper_requirements SET requirement_level = 'blocking'
  WHERE active AND code IN ('legal_identity','primary_contacts','service_address','w9','licenses','insurance','vendor_agreement','written_pricing','conduct_agreement','references','subcontractor_process','secure_access');
UPDATE public.gatekeeper_requirements SET label = 'Primary contacts for dispatch/escalation' WHERE code = 'primary_contacts';
UPDATE public.gatekeeper_requirements SET label = 'Current insurance meeting ARHA requirements' WHERE code = 'insurance';
UPDATE public.gatekeeper_requirements SET label = 'Approved subcontractor process' WHERE code = 'subcontractor_process';
UPDATE public.gatekeeper_requirements SET label = 'Secure handling of property and access information' WHERE code = 'secure_access';
UPDATE public.gatekeeper_requirements SET allows_not_applicable = true,
  exception_rule = 'Not Applicable only when no license is legally required for the trade/jurisdiction; reason required.' WHERE code = 'licenses';
UPDATE public.gatekeeper_requirements SET allows_equivalent = true, detail = 'Two relevant references, or documented equivalent for an established specialist.',
  exception_rule = 'Equivalent Verified allowed for an established specialist; documentation required.' WHERE code = 'references';
UPDATE public.gatekeeper_requirements SET allows_not_applicable = true,
  exception_rule = 'Not Applicable = verified No subcontracting; reason required.' WHERE code = 'subcontractor_process';

-- Result states: allow equivalent_verified; exceptions validated by trigger.
CREATE OR REPLACE FUNCTION private.vendor_gate_result_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.gatekeeper_requirements;
BEGIN
  IF NEW.result NOT IN ('not_verified','verified_meets','verified_does_not_meet','not_applicable','equivalent_verified') THEN
    RAISE EXCEPTION 'Unknown gate result %', NEW.result;
  END IF;
  SELECT * INTO g FROM public.gatekeeper_requirements WHERE id = NEW.requirement_id;
  IF NEW.result = 'not_applicable' THEN
    IF NOT g.allows_not_applicable THEN
      RAISE EXCEPTION '"%" is a mandatory gate. Not Applicable is not permitted.', g.label;
    END IF;
    IF length(btrim(coalesce(NEW.note,''))) < 10 THEN
      RAISE EXCEPTION 'Not Applicable needs a written reason (at least 10 characters).';
    END IF;
  ELSIF NEW.result = 'equivalent_verified' THEN
    IF NOT g.allows_equivalent THEN
      RAISE EXCEPTION '"%" does not permit Equivalent Verified.', g.label;
    END IF;
    IF length(btrim(coalesce(NEW.note,''))) < 10 THEN
      RAISE EXCEPTION 'Equivalent Verified needs documentation of the equivalent (at least 10 characters).';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_vendor_gate_result_guard BEFORE INSERT OR UPDATE ON public.vendor_gatekeeper_results
  FOR EACH ROW EXECUTE FUNCTION private.vendor_gate_result_guard();

CREATE OR REPLACE FUNCTION private.vendor_gates_clear(_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.gatekeeper_requirements g
    LEFT JOIN public.vendor_gatekeeper_results r ON r.requirement_id = g.id AND r.org_id = _org
    WHERE g.active AND g.requirement_level = 'blocking'
      AND (r.id IS NULL
           OR NOT (
             (r.result IN ('verified_meets','equivalent_verified') AND (r.expires_on IS NULL OR r.expires_on >= current_date))
             OR (r.result = 'not_applicable' AND g.allows_not_applicable)
             OR (r.result = 'equivalent_verified' AND g.allows_equivalent AND r.expires_on IS NULL)
           )
           OR (r.result = 'equivalent_verified' AND NOT g.allows_equivalent)))
$$;