CREATE TABLE public.functional_role_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_code text NOT NULL REFERENCES public.functional_roles(code) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role_code, user_id)
);
COMMENT ON TABLE public.functional_role_members IS 'Pool members for functional roles that hold more than one person (e.g. Onboarding Project Managers). functional_roles.current_seat_holder remains the default router for single-seat roles.';
GRANT SELECT ON public.functional_role_members TO authenticated;
GRANT ALL ON public.functional_role_members TO service_role;
ALTER TABLE public.functional_role_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read role pools" ON public.functional_role_members FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- Backfill: current seat holders become the first pool member.
INSERT INTO public.functional_role_members(role_code, user_id)
SELECT code, current_seat_holder FROM public.functional_roles
WHERE code IN ('onboarding_project_manager','utilities','design_staging') AND current_seat_holder IS NOT NULL
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_onboarding_director(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.functional_roles
    WHERE code IN ('onboarding_director','director_onboarding') AND current_seat_holder = _user_id)
$$;
GRANT EXECUTE ON FUNCTION public.is_onboarding_director(uuid) TO authenticated;