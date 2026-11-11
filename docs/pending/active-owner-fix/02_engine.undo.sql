-- Undo for 02_engine.sql. Run 04 undo first. Restores the live switch, preview and decision guard
-- exactly as captured on Nov 11 (live-capture/), removes the new triggers, functions and tables.
-- Held card emails are closed as skipped, never sent in a burst.
\i live-capture/ao_set_home_automation.sql
\i live-capture/ao_preview_home_automation.sql
\i live-capture/owner_business_decision_guard.sql
UPDATE public.owner_notifications SET email_status = 'skipped', delivery_error = 'Daily homeowner email removed.'
 WHERE email_status = 'held';
DROP TRIGGER IF EXISTS ao_hold_card_email ON public.owner_notifications;
DROP TRIGGER IF EXISTS guard_system_label ON public.property_label_assignments;
DROP TRIGGER IF EXISTS guard_system_label ON public.property_labels;
DROP TRIGGER IF EXISTS ao_enrollment_changed ON public.owner_program_properties;
DROP TRIGGER IF EXISTS ao_program_changed ON public.owner_programs;
DROP TRIGGER IF EXISTS ao_handoff_accepted ON public.onboarding_projects;
DROP TRIGGER IF EXISTS owner_item_event_sync ON public.owner_request_messages;
DROP FUNCTION IF EXISTS public.my_owner_item_needs();
DROP FUNCTION IF EXISTS public.owner_item_reply(uuid, text);
DROP FUNCTION IF EXISTS public.owner_item_thread(uuid);
DROP FUNCTION IF EXISTS public.send_task_to_owner_item(uuid, text, date);
DROP FUNCTION IF EXISTS private.owner_item_event_sync();
DROP FUNCTION IF EXISTS private.owner_item_answerer(uuid);
DROP FUNCTION IF EXISTS private.task_sent_to_owner(uuid);
DROP FUNCTION IF EXISTS private.ao_handoff_accepted();
DROP FUNCTION IF EXISTS private.ao_on_handoff(uuid, uuid);
DROP FUNCTION IF EXISTS public.ao_start_enrolled_homes(text);
DROP FUNCTION IF EXISTS public.ao_preview_enrolled_homes();
DROP FUNCTION IF EXISTS private.ao_enrolled_rows();
DROP FUNCTION IF EXISTS private.ao_enrollment_changed();
DROP FUNCTION IF EXISTS private.ao_start_on_enrollment(uuid, uuid);
DROP FUNCTION IF EXISTS private.guard_system_label();
DROP FUNCTION IF EXISTS private.ao_label_sync(uuid, uuid);
DROP FUNCTION IF EXISTS public.ao_owner_email_run(timestamptz);
DROP FUNCTION IF EXISTS private.ao_owner_email_now(uuid, text, text, text);
DROP FUNCTION IF EXISTS private.ao_plan_ready_notice(uuid, uuid[], integer);
DROP FUNCTION IF EXISTS public.set_owner_digest_time(text);
DROP FUNCTION IF EXISTS private.ao_digest_time();
DROP FUNCTION IF EXISTS private.ao_hold_card_email();
DROP FUNCTION IF EXISTS private.ao_start_home_plan(uuid, uuid, uuid[]);
DROP FUNCTION IF EXISTS private.ao_add_plan_card(uuid, uuid, uuid, text, uuid, jsonb, uuid);
DROP FUNCTION IF EXISTS private.ao_plan_outcomes(uuid, uuid[]);
DROP FUNCTION IF EXISTS private.ao_home_program(uuid);
-- Sent-item records are kept as a table snapshot comment-free; drop only if no Task relies on them.
DROP TABLE IF EXISTS public.owner_item_task_sends;
DROP TABLE IF EXISTS public.ao_daily_email_items;
DROP TABLE IF EXISTS public.ao_plan_ready_notices;
DROP TABLE IF EXISTS public.ao_owner_email_days;
DROP INDEX IF EXISTS public.property_labels_system_key;
ALTER TABLE public.property_labels DROP COLUMN IF EXISTS system_key;
DELETE FROM public.app_settings WHERE key = 'owner_digest_time';
