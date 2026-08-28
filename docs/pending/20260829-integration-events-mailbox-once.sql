-- PENDING APPROVAL — NOT APPLIED.
-- Deliberately kept out of supabase/migrations/ so nothing applies it by
-- accident. Move it there only after Emily approves the change.
--
-- What it does: makes "this email has been dealt with" a fact the database
-- enforces, so two intake passes running at the same moment cannot both open
-- a ticket for the same message. The losing pass gets a 23505 conflict, which
-- the intake code already handles by standing down (see claimMessage in
-- src/lib/mailbox.server.ts and the concurrency tests in
-- src/lib/__tests__/mailbox-intake.test.ts).
--
-- Additive and reversible: it creates an index, touches no rows, changes no
-- permissions, and can be dropped without data loss. Verified beforehand that
-- the table holds zero duplicate mailbox rows, so it will not fail to build.

CREATE UNIQUE INDEX IF NOT EXISTS integration_events_mailbox_once
  ON public.integration_events (system, operation, external_id)
  WHERE operation = 'mailbox_message';

-- Rollback:
-- DROP INDEX IF EXISTS public.integration_events_mailbox_once;
