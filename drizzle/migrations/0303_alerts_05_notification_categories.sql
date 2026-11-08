-- Alerts and approvals, part 6: notification preferences (Emily, Nov 7, 2026).
-- Undo: 05_undo_notification_categories.sql. No BEGIN/COMMIT.
--
-- Two new categories next to the existing ones (Approvals and decisions already exists):
-- Notes and mentions, and Team Queue. Email and in app start on for everyone, and a person with no
-- saved settings has every category on (the app reads a missing row or column as on).

ALTER TABLE public.user_notification_preferences
  ADD COLUMN email_notes_mentions boolean NOT NULL DEFAULT true,
  ADD COLUMN inapp_notes_mentions boolean NOT NULL DEFAULT true,
  ADD COLUMN email_team_queue boolean NOT NULL DEFAULT true,
  ADD COLUMN inapp_team_queue boolean NOT NULL DEFAULT true;
