-- Adds the switch that shows Survey reviews in Record routine work. Off.
-- Staged only. Undo: 02_undo_survey_switch.sql
-- Until this row exists the panel treats the switch as off.
INSERT INTO public.feature_flags(key, label, description, enabled)
VALUES ('survey_review_check', 'Survey reviews in Record routine work',
        'When on, Survey reviews show in the Record routine work panel. Leave off until guest surveys go live.',
        false)
ON CONFLICT (key) DO NOTHING;
