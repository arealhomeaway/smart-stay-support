-- Undo portal-card-edit: stop new edits. The change records and the files column stay (nothing is deleted).
REVOKE EXECUTE ON FUNCTION public.ao_edit_card_answer(uuid, jsonb, jsonb) FROM authenticated;
DROP FUNCTION IF EXISTS public.ao_edit_card_answer(uuid, jsonb, jsonb);
COMMENT ON TABLE public.ao_contribution_changes IS 'DEPRECATED: portal-card-edit undone; kept as history.';
INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'portal_card_edit_undone', 'function',
  'Homeowner portal: edit a completed plan card', 'Undo of portal-card-edit.');
