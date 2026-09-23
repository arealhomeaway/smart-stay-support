CREATE OR REPLACE FUNCTION public.owner_owns_program(_program_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM owner_programs p WHERE p.id = _program_id AND p.owner_user_id = auth.uid() AND p.archived_at IS NULL)
$$;
REVOKE ALL ON FUNCTION public.owner_owns_program(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.owner_owns_program(uuid) TO authenticated;
DROP POLICY IF EXISTS "Owners read their Opportunities" ON public.work_items;
CREATE POLICY "Owners read their Opportunities" ON public.work_items FOR SELECT TO authenticated
USING (kind = 'opportunity' AND status <> 'draft' AND public.owner_owns_program(program_id));