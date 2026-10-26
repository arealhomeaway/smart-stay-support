-- PENDING — NOT APPLIED. Stores Emily's approved welcome (Oct 26 2026) as the live template.
-- Apply ONLY after 0162 and in the release window. The moment this commits, the 5-minute job
-- (deliver-owner-alerts -> drainOwnerWelcomes) sends every real owner_welcome_messages row still 'queued',
-- and every later enrollment's welcome is sent automatically with a fresh set-password link.
-- Version 2: no template row exists yet (app uses built-in draft v1).
BEGIN;
INSERT INTO public.app_settings (key, value)
VALUES ('owner_welcome_template', $wt${"subject": "Welcome to Active Owner, {{owner_first_name}}! Let's get you set up", "body": "Hi {{owner_first_name}},\n\nWelcome to the Active Owner Program! We're so excited to have you with us, and we can't wait to get started on {{property_display_name}}.\n\nYour owner portal is where everything lives. It's where you'll see your activities, track your participation hours, and keep up with what's happening at your home.\n\nStep 1: Set your password\nClick below to create your password and sign in for the first time.\n{{set_password_link}}\nIf the link has expired, go to {{portal_sign_in_link}} and choose \"Forgot password?\" to get a new one.\n\nStep 2: Start whenever you're ready\nWe've already added your first activities to your portal. Each one explains what to do and why it matters, and you can work them anytime, in any order that fits your schedule.\n\nStep 3: Log your hours as you go\nEvery time you work on something for your home, log it in your portal. Your hours add up automatically. You can start logging right away, even before closing.\n\nOne important note: your participation and hours are yours to manage. Resolve gives you an easy place to track them, but how they apply to your situation is a question for your tax professional.\n\nIf you have any questions at all, just reply to this email. We're here to help!\n\nThank you!\nThe A Real Home Away Team", "video": null, "version": 2, "review": "approved"}$wt$::jsonb)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
SELECT value->>'review', value->>'version' FROM public.app_settings WHERE key='owner_welcome_template';
COMMIT;
