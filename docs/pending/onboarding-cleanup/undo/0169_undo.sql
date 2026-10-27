-- Retain additive column and all append-only messages on rollback. Do not erase history.
DROP FUNCTION public.manage_owner_review_conversation(uuid,text,text,text,text,text,timestamptz);
DROP FUNCTION public.append_owner_review_message(uuid,text,text,text,text);
DROP FUNCTION public.read_owner_review_thread(uuid);
DROP FUNCTION public.read_owner_review_conversations(uuid);
DROP POLICY "Homeowner reads released activity conversations" ON public.owner_request_messages;
DROP INDEX public.owner_request_messages_review_idx;
COMMENT ON COLUMN public.owner_request_messages.review_id IS 'DEPRECATED on cleanup rollback: retained for permanent conversation history.';
-- work_item_id remains nullable to preserve any recorded review conversations.
