-- Fix batch 3, part 1: handoff standard wording. DATA CHANGE ONLY (run with the data tool, not
-- as a migration). Staged, NOT applied. Wording only: codes, tiers, statuses, order, linked steps
-- and every rule stay exactly as they are.
--   * 49 notes "Proposed. Micah and Kati have not signed off." become empty.
--   * GST-01 note "Proposed removal" becomes "No longer required.".
--   * SYS-01 name, done when and proof needed say the Director of Onboarding instead of a name.
--   * LIN-02 done when drops "proposed" ("under the ARHA standard").
-- Each changed requirement gets one "edited" line in handoff_standard_history, like a screen save.
-- Rows are matched on their exact current text, so a requirement someone has edited since is left alone.
WITH changed AS (
  UPDATE public.handoff_requirements r SET
    notes = CASE
      WHEN old.notes = 'Proposed. Micah and Kati have not signed off.' THEN ''
      WHEN old.code = 'GST-01' AND old.notes = 'Proposed removal' THEN 'No longer required.'
      ELSE old.notes END,
    name = CASE
      WHEN old.code = 'SYS-01' AND old.name = 'Systems setup confirmed by Kati'
        THEN 'Systems setup confirmed by the Director of Onboarding'
      ELSE old.name END,
    done_when = CASE
      WHEN old.code = 'SYS-01' AND old.done_when = 'Kati confirms every platform is complete and accurate, with no missing or placeholder data.'
        THEN 'The Director of Onboarding confirms every platform is complete and accurate, with no missing or placeholder data.'
      WHEN old.code = 'LIN-02' AND old.done_when = 'Guest and backup supply minimums meet approved per-occupancy standard; each toilet has a usable plunger under proposed ARHA standard.'
        THEN 'Guest and backup supply minimums meet approved per-occupancy standard; each toilet has a usable plunger under the ARHA standard.'
      ELSE old.done_when END,
    proof_needed = CASE
      WHEN old.code = 'SYS-01' AND old.proof_needed = 'Kati''s sign-off with date; PID % Complete at 100%.'
        THEN 'Director of Onboarding approval with date; PID % Complete at 100%.'
      ELSE old.proof_needed END,
    updated_at = now()
  FROM public.handoff_requirements old
  WHERE old.id = r.id
    AND (
      old.notes = 'Proposed. Micah and Kati have not signed off.'
      OR (old.code = 'GST-01' AND old.notes = 'Proposed removal')
    )
  RETURNING r.id, to_jsonb(old) AS old_value, to_jsonb(r) AS new_value
)
INSERT INTO public.handoff_standard_history (requirement_id, actor_id, actor_name, old_value, new_value, action)
SELECT id, '00000000-0000-0000-0000-000000000000'::uuid, 'Wording update', old_value, new_value, 'edited'
FROM changed;
