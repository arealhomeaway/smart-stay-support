-- PENDING — NOT APPLIED. Run BEFORE 0161 so approving the wording sends nothing old.
-- The status check today allows only queued/sending/sent/failed/held_demo, so 'skipped' is added first.
-- ('failed' is not used: it offers Retry, which would re-queue the welcome.)
-- Affects every real welcome still queued. As of Oct 26 2026 23:50 UTC: 1 row —
-- Niles Syska / Buckland, program 2d05252c-dd0d-4473-adf8-b979fc5b5216, welcome 588d6bfc-22b4-4d9a-b075-422399a9d2ea.
BEGIN;
ALTER TABLE public.owner_welcome_messages DROP CONSTRAINT IF EXISTS owner_welcome_messages_status_check;
ALTER TABLE public.owner_welcome_messages ADD CONSTRAINT owner_welcome_messages_status_check
  CHECK (status = ANY (ARRAY['queued','sending','sent','failed','held_demo','skipped']));
UPDATE public.owner_welcome_messages
   SET status = 'skipped',
       error_message = 'Owner already received setup email before the branded welcome existed'
 WHERE status = 'queued' AND is_demo = false;
-- Expect UPDATE 1; if the count differs, ROLLBACK and re-review.
COMMIT;
