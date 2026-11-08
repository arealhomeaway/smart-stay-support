-- Data change: close the 7 stale legacy routine rows (2 Checkout, 3 Cleaning
-- Review, 2 Guest Review, all live, created Sep 4 to Nov 3 2026, never worked).
-- Staged only. Undo: 03_undo_close_legacy_rows.sql
-- Stops without changing anything unless all 7 rows are still open and unchanged.
DO $$
DECLARE _open int;
BEGIN
  SELECT count(*) INTO _open FROM public.routine_controls
  WHERE id IN ('a5e4548a-410d-44e2-be4f-765b6aadc744', '9afa4f19-2046-4520-b914-f62a2c3bc36d',
               '42303dca-1b7f-4830-9e08-e0d6058a85ad', '2aa3270e-0d88-447b-9098-e97beef7abb2',
               '864cc2ea-699b-468b-9ee2-8df30fb6111b', '79cc07e5-ad37-4ca5-8f17-fb3813375c29',
               '04bea9f5-c65e-4843-a287-f3580e651744')
    AND is_demo = false AND status IN ('due', 'in_progress') AND notes IS NULL;
  IF _open <> 7 THEN
    RAISE EXCEPTION 'Expected 7 open legacy rows, found %. Nothing changed.', _open;
  END IF;

  UPDATE public.routine_controls
  SET status = 'cancelled', notes = 'Closed: legacy test row'
  WHERE id IN ('a5e4548a-410d-44e2-be4f-765b6aadc744', '9afa4f19-2046-4520-b914-f62a2c3bc36d',
               '42303dca-1b7f-4830-9e08-e0d6058a85ad', '2aa3270e-0d88-447b-9098-e97beef7abb2',
               '864cc2ea-699b-468b-9ee2-8df30fb6111b', '79cc07e5-ad37-4ca5-8f17-fb3813375c29',
               '04bea9f5-c65e-4843-a287-f3580e651744');
END $$;
