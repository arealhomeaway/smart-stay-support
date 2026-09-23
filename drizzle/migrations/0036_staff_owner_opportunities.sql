DROP POLICY IF EXISTS "Owners read their Opportunities" ON public.work_items;
CREATE POLICY "Owners read their Opportunities" ON public.work_items FOR SELECT TO authenticated
USING (kind = 'opportunity' AND status <> 'draft' AND EXISTS (SELECT 1 FROM owner_programs p WHERE p.id = work_items.program_id AND p.owner_user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.save_owner_opportunity(
  _id uuid, _property_id uuid, _title text, _content jsonb, _linked_task_id uuid, _send boolean)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _program uuid; _demo boolean; _new uuid;
BEGIN
  IF NOT (is_onboarding_staff(auth.uid()) OR is_staff(auth.uid())) THEN
    RAISE EXCEPTION 'Only ARHA staff can create Opportunities.';
  END IF;
  SELECT x.program_id, p.is_demo INTO _program, _demo
    FROM owner_program_properties x JOIN owner_programs pr ON pr.id = x.program_id
    JOIN properties p ON p.id = x.property_id
   WHERE x.property_id = _property_id AND x.inclusion_status = 'included' AND x.archived_at IS NULL
     AND pr.archived_at IS NULL AND pr.status NOT IN ('closed','completed','complete')
   LIMIT 1;
  IF _program IS NULL THEN RAISE EXCEPTION 'This home is not enrolled in an Active Owner program.'; END IF;
  IF _linked_task_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM work_items WHERE id = _linked_task_id AND kind = 'task' AND property_id = _property_id) THEN
    RAISE EXCEPTION 'The related work must belong to this home.';
  END IF;
  IF _id IS NULL THEN
    _new := gen_random_uuid();
    INSERT INTO work_items (id, department, kind, property_id, source_table, source_id, linked_task_id, program_id,
      title, owner_content, status, functional_role, required, blocks_handoff, is_demo)
    VALUES (_new, 'onboarding', 'opportunity', _property_id, 'staff_opportunity', _new, _linked_task_id, _program,
      _title, _content, CASE WHEN _send THEN 'open' ELSE 'draft' END, 'owner', false, false, coalesce(_demo,false));
    RETURN _new;
  END IF;
  UPDATE work_items SET title = _title, owner_content = _content, linked_task_id = _linked_task_id,
    status = CASE WHEN _send AND status = 'draft' THEN 'open' ELSE status END
   WHERE id = _id AND kind = 'opportunity' AND property_id = _property_id AND status <> 'complete';
  IF NOT FOUND THEN RAISE EXCEPTION 'This Opportunity can no longer be edited.'; END IF;
  RETURN _id;
END $$;
REVOKE ALL ON FUNCTION public.save_owner_opportunity(uuid,uuid,text,jsonb,uuid,boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_owner_opportunity(uuid,uuid,text,jsonb,uuid,boolean) TO authenticated;