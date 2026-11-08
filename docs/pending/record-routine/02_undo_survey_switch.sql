-- Undo for 02_survey_switch.sql. Removes the switch row only while it is still off.
DELETE FROM public.feature_flags WHERE key = 'survey_review_check' AND enabled = false;
