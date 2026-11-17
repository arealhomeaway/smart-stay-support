-- Undo: removes only the three-argument save. The two-argument ao_submit_card and every saved answer stay.
DROP FUNCTION IF EXISTS public.ao_submit_card(uuid, jsonb, jsonb);
INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'owner_answer_save_undone', 'function',
  'Homeowner plan cards: files save with the answer', 'Undo of docs/pending/owner-answer-save/apply.sql.');
