-- Breezeway webhook lookup-failure recovery.
--
-- NOT APPLIED. Prepared for review — Lovable/an admin must run this against
-- the live database before the recovery code paths that depend on these
-- columns are deployed (see src/lib/breezeway-webhook-recovery.server.ts).
-- All three columns are additive and nullable-or-defaulted, so applying this
-- migration alone, with no code change, is a no-op for existing behavior.
--
-- Context: a `verify_failed` row means the authenticated re-read of a task
-- (the step that decides company/property membership) failed or found
-- nothing. Some of those failures are transient (Breezeway 5xx/429, a
-- network error) and are worth retrying later; others are permanent (the
-- task no longer exists, or a 4xx a retry cannot fix). These columns let the
-- bounded recovery pass tell the two apart and cap how many times it retries
-- any one event, instead of retrying forever or guessing from free-text.
ALTER TABLE public.breezeway_webhook_events
  ADD COLUMN IF NOT EXISTS retryable boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recovered_at timestamptz;

CREATE INDEX IF NOT EXISTS breezeway_webhook_events_retryable_idx
  ON public.breezeway_webhook_events (received_at)
  WHERE retryable = true AND recovered_at IS NULL;

-- Concurrency guard: two deliveries of the exact same task update (a genuine
-- Breezeway redelivery, or a live delivery racing a recovery retry) can both
-- read "not yet processed" before either has written its row — a classic
-- check-then-insert race. Application code already treats a losing insert
-- here as "duplicate" rather than an error (see verifyAndFinalizeTask in
-- src/lib/breezeway-webhook.server.ts); this index is what makes one of the
-- two inserts actually lose the race instead of both silently succeeding.
--
-- is_fixture is part of the key deliberately: lastProcessed() (the app-level
-- dedupe read) already scopes every duplicate/stale lookup by is_fixture, so
-- the fixture self-test (task ids in the 999_000_00x range, run on demand
-- from the admin panel) never competes with live traffic for the same task
-- id/timestamp pair. Without is_fixture here, that guarantee would only be
-- app-level and this database-level guard could still let a fixture run
-- silently suppress — or be suppressed by — a real delivery that happened to
-- land on the same (task_id, task_updated_at).
CREATE UNIQUE INDEX IF NOT EXISTS breezeway_webhook_events_processed_once
  ON public.breezeway_webhook_events (task_id, task_updated_at, is_fixture)
  WHERE outcome = 'processed';
