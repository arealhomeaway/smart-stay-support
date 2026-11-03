# Onboarding review steps (Help ticket #54)

- `01_reviews.sql` applied as `drizzle/migrations/0239_onboarding_reviews.sql` (byte-identical, sha256 b9de82e1d23dc4a465e7d939172d6d05afbce9b802223b4499141109be15e0d9). New objects only; nothing replaced, so no live captures are needed.
- `undo.sql` (sha256 433f362b8852ef237f5800dd355c68b856d3d90311228cca1daf284b6f4ed1d3) drops only those objects. Not run.
- Seed (data, 2026-11-03): "No second look needed" ON for Kati Hand (40de2f41-5596-4ec1-98d7-29e16549a25f) and Micah Sinor (452f6db5-ba38-44bf-a8bd-f4b9197a0032), with matching history rows. Onboarding Manager seat was empty, so no one else.
  Seed undo: `DELETE FROM public.staff_review_preference_history WHERE changed_by IS NULL AND user_id IN ('40de2f41-5596-4ec1-98d7-29e16549a25f','452f6db5-ba38-44bf-a8bd-f4b9197a0032'); DELETE FROM public.staff_review_preferences WHERE user_id IN ('40de2f41-5596-4ec1-98d7-29e16549a25f','452f6db5-ba38-44bf-a8bd-f4b9197a0032');`
- Fingerprints before and after apply were identical for onboarding_templates, template stages/steps/versions, onboarding_projects, onboarding_tasks, all owner_* tables, work_orders, staff_notifications and email_log. Anon-executable SECURITY DEFINER set: 69, same hash.
