-- Onboarding kinds 3 (Nov 12), item 2: who wrote last on each owner item, for the homeowner's
-- With ARHA and New reply groups. Homeowners cannot read owner_reviews directly, so the message
-- policy that joins owner_reviews hides these conversations from a direct read; owner_item_detail
-- (live) already returns them one item at a time. This reads many at once under the same rule:
-- program members and staff, items not archived or prepared; events and system lines ignored.
-- Additive: no policy, table or existing function changes.
CREATE OR REPLACE FUNCTION public.owner_item_last_speakers(_review_ids uuid[])
RETURNS TABLE(review_id uuid, last_speaker text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public', 'private' AS $$
  SELECT DISTINCT ON (m.review_id) m.review_id,
         CASE WHEN m.author_type = 'homeowner' THEN 'homeowner' ELSE 'staff' END
    FROM public.owner_request_messages m
    JOIN public.owner_reviews r ON r.id = m.review_id
   WHERE auth.uid() IS NOT NULL
     AND m.review_id = ANY(coalesce(_review_ids, '{}'::uuid[]))
     AND r.archived_at IS NULL AND r.status <> 'prepared'
     AND (coalesce(private.is_program_member(r.program_id, auth.uid()), false) OR coalesce(private.is_staff(auth.uid()), false))
     AND m.event IS NULL AND m.author_type <> 'system'
   ORDER BY m.review_id, m.created_at DESC, m.id DESC
$$;
REVOKE ALL ON FUNCTION public.owner_item_last_speakers(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_item_last_speakers(uuid[]) TO authenticated, service_role;
NOTIFY pgrst, 'reload schema';
