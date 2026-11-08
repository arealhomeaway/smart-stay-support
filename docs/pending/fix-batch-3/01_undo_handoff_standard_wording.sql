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
    -- Only the 50 seeded requirements (ids captured live on Nov 8, 2026).
    AND old.id IN ('1e1e61e1-9556-5ab2-9d20-2fdb40503d93','0283e26e-7b4d-5a3b-b31c-add231b6e595','8ce839f0-9b9c-5ac6-87c2-60d4aec52c25','e6bc43de-17ea-5d1f-a258-450f2b0ef086','b262ecaf-940b-57d3-9ca5-a563fe3e9c44','8d90758f-9796-52b3-80f4-972c3cf95df1','a713f768-b73f-5173-a86f-11fc3ef61262','6560594d-9fa4-5d89-b004-cefb0a190de5','6b7c424a-43e5-52e7-a54d-285285dcc89f','ed4eb617-4beb-5115-8e14-e83956f29581','8c342adb-89b9-5273-b60a-6fa3b8c77c36','0fa9bebe-83c8-51a4-a5be-c3531def6c16','edbfef96-6ccc-5ebd-afe6-85ad302474fa','9d8cb333-f883-5f9b-87d4-011303bdc660','d1163e6e-e545-5b12-9e2a-96b489a7aebd','d500baac-02ec-5f52-a49e-83aceb1bfa71','2d9b25ca-72fd-5f25-a214-a341e4eaff78','bbc00e9a-afae-5fbb-83b8-6b8aaa9428e1','1b914dd1-8cb0-5e7a-a165-397d85521760','7e528419-a65f-5ca1-b614-fa2c4c7f4ce9','c24dcf2e-11f0-5551-8b1a-787bc79381a5','3a37f1d6-1554-5f33-ab3b-23ad0549b2cd','a8fa9362-8883-5726-a427-eb59342e5d0d','3b478ec8-270c-53c8-8f7a-02f8cfd75b42','84551c4d-8df3-59c6-bc11-b0330775146d','37f09ea9-740d-5165-8fc4-5b2bd23460ca','b20a1e2f-bf9f-575b-80ff-ec9df56ccd90','368616c2-cd62-5963-856b-36b65c6af79f','66e1f0fe-6e91-5002-95fc-0e5d13c368bd','5da0fc88-0f39-5097-b356-7242295ebf3d','6ba009dd-c619-58e3-b70c-6ff70509f558','8cc200fd-9272-5662-bce6-b5dd291879e8','6484b63a-c879-55c2-a81d-40c7f44061eb','b8cb1dae-45e1-5f13-a667-1988051cd55e','3cdc2894-4ff4-5258-ab2f-ac39de83f432','05c48c98-4969-5811-b132-99f221382149','32893348-2c76-5ba1-8350-0093a265c8f3','ef84f623-20aa-5f15-b3f9-96f6300ac6a8','b60ead67-d365-5c0b-abdc-d2ab9f90ca23','0a59e5b4-99a1-5054-a3d4-c4eed88764c1','8b663fc3-b3f0-5d27-bfff-c115e7c801a1','90d03210-330d-542b-82ca-3a48c37ef6dc','0d4a2d05-475d-52aa-8a9f-4a4368421980','daeeb7a6-20a9-5767-8dbc-1c48e7881e7d','dc24acd5-d36d-50e1-a5a0-700e98b513c1','d7632b9e-ad9d-586c-a0a6-70b0d74d4d0f','e0328240-d318-5705-9546-6f3d364b994c','5febbd57-e978-55f0-a031-b238d6483a44','f447026a-9bb2-5fcd-b43b-daa27db1bff6','6099e7c4-a2c9-5e52-b9cf-7c4e4586edd9')
    AND (
      (old.status = 'proposed' AND old.notes = '')
      OR (old.code = 'GST-01' AND old.notes = 'No longer required.')
    )
  RETURNING r.id, to_jsonb(old) AS old_value, to_jsonb(r) AS new_value
)
INSERT INTO public.handoff_standard_history (requirement_id, actor_id, actor_name, old_value, new_value, action)
SELECT id, '00000000-0000-0000-0000-000000000000'::uuid, 'Wording update undone', old_value, new_value, 'edited'
FROM changed;
