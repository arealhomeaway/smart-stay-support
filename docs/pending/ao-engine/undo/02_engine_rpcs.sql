-- Undo for 02_engine_rpcs.sql. 02 replaced no live object, so undo is plain removal (no base64 restore needed).
-- Rows created by the engine (plan cards, owner_reviews, contributions, notifications) are history and are NOT removed.
DROP TRIGGER IF EXISTS ao_unlock_on_task_complete ON public.onboarding_tasks;
DROP FUNCTION IF EXISTS public.ao_process_clocks(timestamptz);
DROP FUNCTION IF EXISTS public.ao_submit_card(uuid,jsonb);
DROP FUNCTION IF EXISTS public.ao_set_home_automation(uuid,boolean,uuid[]);
DROP FUNCTION IF EXISTS public.ao_unlock_now(uuid);
DROP FUNCTION IF EXISTS public.ao_card_set_status(uuid,text);
DROP FUNCTION IF EXISTS public.ao_card_save(uuid,jsonb);
DROP FUNCTION IF EXISTS private.ao_task_completed();
DROP FUNCTION IF EXISTS private.ao_unlock(uuid,uuid);
DROP FUNCTION IF EXISTS private.ao_home_stage(uuid);
DROP FUNCTION IF EXISTS private.ao_central(date,int);
DROP FUNCTION IF EXISTS private.ao_add_business_days(date,int);
DROP FUNCTION IF EXISTS private.ao_is_editor(uuid);
