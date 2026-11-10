-- Build 10, item 7: the webhook note says what the subscription is for today.
-- Text only on the one existing subscription row; delivery, secret and host are unchanged.
-- Undo: undo/02_webhook_note.sql.
UPDATE public.breezeway_webhook_subscriptions
   SET note = 'Company-wide task updates. Kept for verified Resolve homes only; feeds the work order copy and the Breezeway bridge. Read only toward Breezeway.'
 WHERE note = 'Fitzgerald pilot. Company-wide delivery; only company 3641 / home 1473933 retained.';
