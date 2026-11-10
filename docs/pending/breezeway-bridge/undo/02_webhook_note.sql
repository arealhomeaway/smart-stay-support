-- Undo of 02_webhook_note.sql: the exact note before Build 10.
UPDATE public.breezeway_webhook_subscriptions
   SET note = 'Fitzgerald pilot. Company-wide delivery; only company 3641 / home 1473933 retained.'
 WHERE note = 'Company-wide task updates. Kept for verified Resolve homes only; feeds the work order copy and the Breezeway bridge. Read only toward Breezeway.';
