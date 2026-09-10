-- Acceptance blocker 2 (PR #7 live acceptance, HEAD 166de6e): a Ticket that
-- reaches "Verify the outcome" has no way to say the repair didn't actually
-- fix the issue — the only actions are "Guest confirmed it is fixed" and
-- "Waiting on someone?".
--
-- `repairExists`/`repairComplete` (ticketStage()) are derived from whether
-- any Work Order for the ticket has ever closed, and stay true forever once
-- that has happened once — they record that a repair was attempted, not
-- that it worked. This column is the one signal that can send a Ticket back
-- to the `repair` stage (to open a fresh Work Order) after a closed repair
-- turns out not to have fixed the problem, without disturbing that
-- derivation or the Work Order model itself.
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS repair_reported_incomplete_at timestamptz;
