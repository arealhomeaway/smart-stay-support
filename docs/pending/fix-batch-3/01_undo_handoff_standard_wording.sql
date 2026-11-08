-- Undo for fix batch 3, part 1. DATA CHANGE ONLY (data tool). Puts back the exact live text and
-- the live updated_at captured on Nov 8, 2026 (2026-10-27 23:33:03.478207+00). Only rows that
-- still carry the batch 3 wording are touched. History is add only (the
-- handoff_standard_history_permanent trigger refuses deletes), so the undo adds one more
-- "edited" line per requirement instead of removing the earlier one.
WITH changed AS (
  UPDATE public.handoff_requirements r SET
    notes = CASE
      WHEN old.code = 'GST-01' AND old.notes = 'No longer required.' THEN 'Proposed removal'
      WHEN old.notes = '' THEN 'Proposed. Micah and Kati have not signed off.'
      ELSE old.notes END,
    name = CASE
      WHEN old.code = 'SYS-01' AND old.name = 'Systems setup confirmed by the Director of Onboarding'
        THEN 'Systems setup confirmed by Kati'
      ELSE old.name END,
    done_when = CASE
      WHEN old.code = 'SYS-01' AND old.done_when = 'The Director of Onboarding confirms every platform is complete and accurate, with no missing or placeholder data.'
        THEN 'Kati confirms every platform is complete and accurate, with no missing or placeholder data.'
      WHEN old.code = 'LIN-02' AND old.done_when = 'Guest and backup supply minimums meet approved per-occupancy standard; each toilet has a usable plunger under the ARHA standard.'
        THEN 'Guest and backup supply minimums meet approved per-occupancy standard; each toilet has a usable plunger under proposed ARHA standard.'
      ELSE old.done_when END,
    proof_needed = CASE
      WHEN old.code = 'SYS-01' AND old.proof_needed = 'Director of Onboarding approval with date; PID % Complete at 100%.'
        THEN 'Kati''s sign-off with date; PID % Complete at 100%.'
      ELSE old.proof_needed END,
    updated_at = '2026-10-27 23:33:03.478207+00'::timestamptz
  FROM public.handoff_requirements old
  WHERE old.id = r.id
    AND (
      (old.status = 'proposed' AND old.notes = '')
      OR (old.code = 'GST-01' AND old.notes = 'No longer required.')
    )
  RETURNING r.id, to_jsonb(old) AS old_value, to_jsonb(r) AS new_value
)
INSERT INTO public.handoff_standard_history (requirement_id, actor_id, actor_name, old_value, new_value, action)
SELECT id, '00000000-0000-0000-0000-000000000000'::uuid, 'Wording update undone', old_value, new_value, 'edited'
FROM changed;
