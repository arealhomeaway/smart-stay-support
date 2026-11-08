-- Undo for 05_notification_categories.sql. No BEGIN/COMMIT.
ALTER TABLE public.user_notification_preferences
  DROP COLUMN email_notes_mentions,
  DROP COLUMN inapp_notes_mentions,
  DROP COLUMN email_team_queue,
  DROP COLUMN inapp_team_queue;
