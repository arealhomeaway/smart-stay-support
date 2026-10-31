-- Exact undo for 01_engine_foundation.sql. It created new objects only and replaced
-- no live function, policy or trigger, so no base64 captures are needed.
DROP TABLE public.ao_contributions;
DROP TABLE public.ao_home_plan_cards;
DROP TABLE public.ao_home_plan_settings_history;
DROP TABLE public.ao_home_plan_settings;
DROP TABLE public.ao_library_card_history;
DROP TABLE public.ao_library_cards;
DROP TABLE public.ao_business_holidays;
