-- The export's setting (register N10; Emily, Nov 9): 30 nightly folders and 12 weekly folders kept,
-- the full copy of every stored file on Sunday nights (Central date). Data only.
-- Without this row the app uses the same values.
INSERT INTO public.app_settings (key, value)
VALUES ('nightly_export_settings', '{"daily_keep": 30, "weekly_keep": 12, "weekly_day": 0}'::jsonb)
ON CONFLICT (key) DO NOTHING;
