ALTER TABLE public.gatekeeper_requirements
  ADD COLUMN IF NOT EXISTS expiry_required boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS evidence_required boolean NOT NULL DEFAULT false;

UPDATE public.gatekeeper_requirements SET expiry_required = true WHERE code IN ('insurance','licenses');
UPDATE public.gatekeeper_requirements SET evidence_required = true
  WHERE code IN ('insurance','licenses','w9','vendor_agreement','conduct_agreement','written_pricing');

ALTER TABLE public.vendor_gatekeeper_results
  ADD COLUMN IF NOT EXISTS document_id uuid REFERENCES public.vendor_documents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS evidence_reference text,
  ADD COLUMN IF NOT EXISTS exception_reason text;

UPDATE public.vendor_gatekeeper_results SET exception_reason = note
  WHERE result IN ('not_applicable','equivalent_verified') AND exception_reason IS NULL;

CREATE OR REPLACE FUNCTION private.vendor_gate_result_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE g public.gatekeeper_requirements;
BEGIN
  IF NEW.result NOT IN ('not_verified','verified_meets','verified_does_not_meet','not_applicable','equivalent_verified') THEN
    RAISE EXCEPTION 'Unknown gate result %', NEW.result;
  END IF;
  SELECT * INTO g FROM public.gatekeeper_requirements WHERE id = NEW.requirement_id;

  IF NEW.document_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.vendor_documents d WHERE d.id = NEW.document_id AND d.org_id = NEW.org_id) THEN
    RAISE EXCEPTION 'The supporting document must belong to this vendor.';
  END IF;

  IF NEW.result = 'not_applicable' THEN
    IF NOT g.allows_not_applicable THEN
      RAISE EXCEPTION '"%" is a mandatory gate. Not Applicable is not permitted.', g.label;
    END IF;
    IF length(btrim(coalesce(NEW.exception_reason,''))) < 10 THEN
      RAISE EXCEPTION 'Not Applicable needs a written reason (at least 10 characters).';
    END IF;
  ELSIF NEW.result = 'equivalent_verified' THEN
    IF NOT g.allows_equivalent THEN
      RAISE EXCEPTION '"%" does not permit Equivalent Verified.', g.label;
    END IF;
    IF length(btrim(coalesce(NEW.exception_reason,''))) < 10 THEN
      RAISE EXCEPTION 'Equivalent Verified needs documentation of the equivalent (at least 10 characters).';
    END IF;
  ELSE
    NEW.exception_reason := NULL;
  END IF;

  IF NEW.result IN ('verified_meets','equivalent_verified') THEN
    IF g.expiry_required AND NEW.expires_on IS NULL THEN
      RAISE EXCEPTION '"%" needs an expiration date.', g.label;
    END IF;
    IF NEW.expires_on IS NOT NULL AND NEW.expires_on < current_date
       AND (TG_OP = 'INSERT' OR NEW.expires_on IS DISTINCT FROM OLD.expires_on OR NEW.result IS DISTINCT FROM OLD.result) THEN
      RAISE EXCEPTION 'That expiration date has already passed. An expired record cannot be recorded as Passed.';
    END IF;
    IF g.evidence_required AND NEW.document_id IS NULL AND length(btrim(coalesce(NEW.evidence_reference,''))) < 3 THEN
      RAISE EXCEPTION '"%" needs a supporting document or reference.', g.label;
    END IF;
  END IF;

  -- Who verified and when is stamped by the database, never typed in.
  IF NEW.result = 'not_verified' THEN
    NEW.verified_by := NULL; NEW.verified_at := NULL;
  ELSIF TG_OP = 'INSERT' OR NEW.result IS DISTINCT FROM OLD.result
     OR NEW.expires_on IS DISTINCT FROM OLD.expires_on
     OR NEW.document_id IS DISTINCT FROM OLD.document_id
     OR NEW.evidence_reference IS DISTINCT FROM OLD.evidence_reference
     OR NEW.exception_reason IS DISTINCT FROM OLD.exception_reason THEN
    NEW.verified_by := coalesce(auth.uid(), NEW.verified_by);
    NEW.verified_at := now();
  END IF;
  RETURN NEW;
END $$;

-- One authoritative pass rule. Expired insurance/license automatically stops passing.
CREATE OR REPLACE FUNCTION private.vendor_gate_passes(_result text, _expires date, _na boolean, _eq boolean, _expiry_required boolean)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    WHEN _result = 'not_applicable' THEN _na
    WHEN _result IN ('verified_meets','equivalent_verified') THEN
      (_result = 'verified_meets' OR _eq)
      AND NOT (_expiry_required AND _expires IS NULL)
      AND (_expires IS NULL OR _expires >= current_date)
    ELSE false END
$$;

CREATE OR REPLACE FUNCTION private.vendor_gates_clear(_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT EXISTS (
    SELECT 1 FROM public.gatekeeper_requirements g
    LEFT JOIN public.vendor_gatekeeper_results r ON r.requirement_id = g.id AND r.org_id = _org
    WHERE g.active AND g.requirement_level = 'blocking'
      AND (r.id IS NULL OR NOT private.vendor_gate_passes(r.result, r.expires_on, g.allows_not_applicable, g.allows_equivalent, g.expiry_required)))
$$;

-- Approved/Gold vendors can only be used while every gate currently passes.
CREATE OR REPLACE FUNCTION public.vendor_dispatch_eligible(_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.vendor_orgs o
    WHERE o.id = _org AND o.is_active
      AND o.status IN ('pilot','approved','gold','corrective_action')
      AND (o.status NOT IN ('approved','gold') OR (private.vendor_gates_clear(o.id) AND NOT coalesce(o.critical_failure,false)))
  )
$$;
REVOKE ALL ON FUNCTION public.vendor_dispatch_eligible(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_dispatch_eligible(uuid) TO authenticated, service_role;