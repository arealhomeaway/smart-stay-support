DROP POLICY IF EXISTS "Owners read their Opportunities" ON public.work_items;
CREATE POLICY "Owners read their Opportunities" ON public.work_items FOR SELECT TO authenticated
USING (kind = 'opportunity' AND status <> 'draft' AND status <> 'archived' AND public.owner_owns_program(program_id));