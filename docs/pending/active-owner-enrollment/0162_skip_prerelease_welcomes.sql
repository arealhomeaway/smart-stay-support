-- PENDING — NOT APPLIED. Run BEFORE 0161 so approving the wording sends nothing old.
-- Skips every real welcome still queued (today: 1 row, Niles Syska / Buckland, program 2d05252c…, id 588d6bfc…).
BEGIN;
UPDATE public.owner_welcome_messages
   SET status = 'skipped',
       error_message = 'Owner already received setup email before the branded welcome existed'
 WHERE status = 'queued';
-- Expect UPDATE 1 as of Oct 26 2026 23:50 UTC; if the count differs, ROLLBACK and re-review.
COMMIT;
