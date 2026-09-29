CREATE OR REPLACE FUNCTION private.owns_owner_request(_work_item_id uuid, _actor uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT _actor IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.work_items w JOIN public.owner_programs p ON p.id=w.program_id
     WHERE w.id=_work_item_id AND w.kind='opportunity' AND w.status NOT IN ('draft','archived')
       AND p.archived_at IS NULL AND p.owner_user_id=_actor)
$$;
DROP POLICY IF EXISTS "Homeowner reads own conversations" ON public.owner_request_messages;
CREATE POLICY "Homeowner reads own conversations" ON public.owner_request_messages
  FOR SELECT TO authenticated USING (private.owns_owner_request(work_item_id, auth.uid()));