-- Program Owner must be an active internal staff member (never an owner or vendor).
-- Changes are already audited field-by-field by trg_vendor_orgs_guard.
CREATE OR REPLACE FUNCTION private.vendor_program_owner_eligible(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id IS NOT NULL
     AND public.is_internal_staff(_user_id)
     AND NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('owner','vendor'))
     AND EXISTS (SELECT 1 FROM auth.users u WHERE u.id = _user_id AND u.deleted_at IS NULL
                   AND (u.banned_until IS NULL OR u.banned_until <= now()))
$$;
REVOKE ALL ON FUNCTION private.vendor_program_owner_eligible(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.vendor_program_owner_eligible(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION private.vendor_program_owner_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.program_owner IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.program_owner IS DISTINCT FROM OLD.program_owner)
     AND NOT private.vendor_program_owner_eligible(NEW.program_owner) THEN
    RAISE EXCEPTION 'Program Owner must be an active internal staff member.';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_vendor_program_owner_guard BEFORE INSERT OR UPDATE OF program_owner ON public.vendor_orgs
  FOR EACH ROW EXECUTE FUNCTION private.vendor_program_owner_guard();

-- Picker source: active internal staff only.
CREATE OR REPLACE FUNCTION public.vendor_program_owner_choices()
RETURNS TABLE (id uuid, full_name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, coalesce(p.full_name, p.email) FROM public.profiles p
   WHERE private.is_staff(auth.uid()) AND private.vendor_program_owner_eligible(p.id)
   ORDER BY 2
$$;
REVOKE ALL ON FUNCTION public.vendor_program_owner_choices() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_program_owner_choices() TO authenticated, service_role;