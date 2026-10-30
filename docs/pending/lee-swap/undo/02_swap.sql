-- Execute as Emily through the authenticated caller, before any welcome sending begins.
-- Restores original identity, membership row, profile names and invitation revocation values.
-- Audit/history stay append-only; reversal is recorded. Automatic report version/timestamps advance normally.
SELECT public.apply_lee_homeowner_correction(true);