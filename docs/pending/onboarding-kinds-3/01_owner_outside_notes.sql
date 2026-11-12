-- Onboarding kinds 3 (Nov 12), item 3: the owner's wording on a Done outside Resolve card.
-- Additive: one new reader. owner_outside_resolve_lines (live) is left exactly as it is.
-- For each plan card, owner item and Opportunity of this program whose Task is Done outside Resolve:
-- where it happens, the document name and owner message (the Task's own setting, else its plan
-- step's), and whether that home has a live Active Owner program (not closed or archived, the same
-- rule as canSendToActiveOwner). Program members and staff only.
CREATE OR REPLACE FUNCTION public.owner_outside_resolve_notes(_program uuid)
RETURNS TABLE(source text, item_id uuid, property_id uuid, where_code text, document_name text, owner_message text, live_program boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'private' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (coalesce(private.is_program_member(_program, auth.uid()), false) OR coalesce(private.is_staff(auth.uid()), false)) THEN
    RAISE EXCEPTION 'Not available.';
  END IF;
  RETURN QUERY
  WITH items AS (
    SELECT 'plan'::text AS src, pc.id AS iid, pc.property_id AS pid, pc.linked_task_id AS tid
      FROM public.ao_home_plan_cards pc WHERE pc.program_id = _program
    UNION ALL
    SELECT 'review'::text, r.id, r.property_id, coalesce(s.task_id, r.onboarding_task_id)
      FROM public.owner_reviews r LEFT JOIN public.owner_item_task_sends s ON s.review_id = r.id
     WHERE r.program_id = _program AND r.archived_at IS NULL
    UNION ALL
    SELECT 'work'::text, w.id, w.property_id, w.source_task_id
      FROM public.work_items w WHERE w.program_id = _program
  )
  SELECT i.src, i.iid, coalesce(i.pid, t.property_id),
         nullif(btrim(coalesce(t.kind_settings->>'where', st.kind_settings->>'where', '')), ''),
         nullif(btrim(coalesce(nullif(btrim(t.kind_settings->>'documentName'), ''), st.kind_settings->>'documentName', '')), ''),
         nullif(btrim(coalesce(nullif(btrim(t.kind_settings->>'ownerMessage'), ''), st.kind_settings->>'ownerMessage', '')), ''),
         EXISTS (
           SELECT 1 FROM public.owner_programs p
            WHERE p.archived_at IS NULL AND coalesce(p.status, '') NOT IN ('closed', 'archived')
              AND (p.property_id = coalesce(i.pid, t.property_id)
                   OR EXISTS (SELECT 1 FROM public.owner_program_properties pp
                               WHERE pp.program_id = p.id AND pp.property_id = coalesce(i.pid, t.property_id) AND pp.archived_at IS NULL)))
    FROM items i
    JOIN public.onboarding_tasks t ON t.id = i.tid
    LEFT JOIN public.onboarding_template_tasks st ON st.id = t.template_task_id
   WHERE t.task_kind = 'outside_resolve' AND t.archived_at IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.owner_outside_resolve_notes(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_outside_resolve_notes(uuid) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
