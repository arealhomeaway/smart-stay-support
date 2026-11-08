-- Undo for 03_close_legacy_rows.sql. Puts each row back exactly as it was:
-- six were "due" and one Guest Review was "in_progress"; all had no notes.
UPDATE public.routine_controls SET status = 'due', notes = NULL
WHERE notes = 'Closed: legacy test row' AND status = 'cancelled'
  AND id IN ('a5e4548a-410d-44e2-be4f-765b6aadc744', '9afa4f19-2046-4520-b914-f62a2c3bc36d',
             '42303dca-1b7f-4830-9e08-e0d6058a85ad', '864cc2ea-699b-468b-9ee2-8df30fb6111b',
             '79cc07e5-ad37-4ca5-8f17-fb3813375c29', '04bea9f5-c65e-4843-a287-f3580e651744');
UPDATE public.routine_controls SET status = 'in_progress', notes = NULL
WHERE notes = 'Closed: legacy test row' AND status = 'cancelled'
  AND id = '2aa3270e-0d88-447b-9098-e97beef7abb2';
