-- Undo for 01_scorecard_records.sql. Removes the record functions and the settings function.
-- Kept on purpose, so nothing recorded is ever lost: the scorecard_records table, its
-- add-only triggers, its read policy and the countable view. The guest_rating_channels
-- setting row is kept. The COO role row is removed only while nobody holds it.
-- Run after the undo files for 04, 03 and 02 (they use private.refuse_record_change).
-- No BEGIN/COMMIT.

DROP FUNCTION IF EXISTS public.set_guest_rating_channels(text[]);
DROP FUNCTION IF EXISTS public.record_finance_packet(date, boolean, text);
DROP FUNCTION IF EXISTS public.approve_corrective_commitment(uuid);
DROP FUNCTION IF EXISTS public.record_corrective_commitment(uuid, text, date);
DROP FUNCTION IF EXISTS public.record_coaching_conversation(uuid, text, text, text);
DROP FUNCTION IF EXISTS public.log_queue_open(text);
DROP FUNCTION IF EXISTS public.record_arrival_readiness(uuid, date, text, text);

DELETE FROM public.functional_roles
 WHERE code = 'coo' AND current_seat_holder IS NULL
   AND NOT EXISTS (SELECT 1 FROM public.functional_role_members m WHERE m.role_code = 'coo');
