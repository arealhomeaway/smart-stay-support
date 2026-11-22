-- owner-closing-updates undo: removes the two actions, the guards, both records and the test inbox setting.
-- Every update row and history line is copied into one audit line first, so nothing is lost.
-- The Owner tab then shows the schedule as planned only, with Edit and Hold off.
INSERT INTO public.audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
SELECT NULL, 'owner_closing_updates.undone', 'function', NULL, 'Owner updates after closing',
  jsonb_build_object(
    'updates', coalesce((SELECT jsonb_agg(to_jsonb(u) ORDER BY u.created_at) FROM public.owner_closing_updates u), '[]'::jsonb),
    'events', coalesce((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.created_at) FROM public.owner_closing_update_events e), '[]'::jsonb),
    'test_inbox', (SELECT value FROM public.app_settings WHERE key = 'owner_update_test_inbox'));
DROP FUNCTION public.hold_owner_closing_update(uuid);
DROP FUNCTION public.edit_owner_closing_update(uuid, text, text);
DROP FUNCTION private.owner_update_editor(uuid, uuid);
DROP TRIGGER owner_closing_update_events_append_only ON public.owner_closing_update_events;
DROP FUNCTION private.block_owner_closing_update_event_change();
DROP TABLE public.owner_closing_update_events;
DROP TRIGGER owner_closing_updates_guard ON public.owner_closing_updates;
DROP FUNCTION private.guard_owner_closing_update();
DROP TABLE public.owner_closing_updates;
DELETE FROM public.app_settings WHERE key = 'owner_update_test_inbox';
