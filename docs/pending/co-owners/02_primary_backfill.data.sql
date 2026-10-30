-- PENDING DATA ONLY. Apply separately after the complete access conversion is approved.
-- No new accounts, emails or notifications. Existing primary owner IDs stay unchanged.
INSERT INTO public.program_members(program_id,user_id,role,added_by)
SELECT p.id,p.owner_user_id,'primary',NULL
FROM public.owner_programs p
WHERE p.owner_user_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.program_members m
    WHERE m.program_id=p.id AND m.user_id=p.owner_user_id AND m.removed_at IS NULL);
-- Capture inserted IDs using RETURNING at execution time for an exact row-scoped undo.
-- Do not undo later memberships by re-running a broad DELETE predicate.