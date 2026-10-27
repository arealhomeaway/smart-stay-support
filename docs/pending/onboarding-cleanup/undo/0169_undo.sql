-- Exact rollback of 0169. Only valid immediately after apply (no review conversations recorded yet).
-- No existing function, policy or trigger is replaced by 0169; new objects are dropped and the column change reversed.
DROP FUNCTION IF EXISTS public.manage_owner_review_conversation(uuid,text,text,text,text,text,timestamptz);
DROP FUNCTION IF EXISTS public.append_owner_review_message(uuid,text,text,text,text);
DROP FUNCTION IF EXISTS public.read_owner_review_thread(uuid);
DROP FUNCTION IF EXISTS public.read_owner_review_conversations(uuid);
DROP POLICY IF EXISTS "Homeowner reads released activity conversations" ON public.owner_request_messages;
DROP INDEX IF EXISTS public.owner_request_messages_review_idx;
ALTER TABLE public.owner_request_messages DROP COLUMN IF EXISTS review_id;
ALTER TABLE public.owner_request_messages ALTER COLUMN work_item_id SET NOT NULL;
