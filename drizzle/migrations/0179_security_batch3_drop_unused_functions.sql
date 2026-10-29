-- Security batch 3: retire unused functions. No CASCADE; undo in docs/pending/security-batch3/undo.sql.
DROP FUNCTION public.accept_into_operations(uuid);
DROP FUNCTION public.mark_ready_for_operations(uuid);
DROP FUNCTION public.rerun_departure_review_trigger(uuid);