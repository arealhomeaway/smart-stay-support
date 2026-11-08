-- Fix batch 4, part 3 (data, run with the data tool): the four extra triage windows are switched
-- off so nothing reads them (Emily; register S1 keeps the weekend cover rules). Nothing is deleted:
-- the rows stay with active = false and can be switched back on. The four weekend rows
-- (Saturday and Sunday, morning and evening) are kept as they are.
--   Monday evening    Guest Experience evening  5 PM to 10 PM   dcf1e26c-0e3c-443a-9f75-88c8e9336b08
--   Tuesday evening   Guest Experience evening  5 PM to 10 PM   9e00af58-38c5-401c-ba87-2beecd0ae379
--   Wednesday evening Guest Experience evening  5 PM to 10 PM   564376d6-5cdd-4a12-ad09-f0089cc38eb7
--   Tuesday morning   Property Operations day   8 AM to 1 PM    ade37145-24fd-4ca7-b760-131a8b2a53c9
UPDATE public.coverage_triage_windows SET active = false, updated_at = now()
 WHERE active AND id IN ('dcf1e26c-0e3c-443a-9f75-88c8e9336b08', '9e00af58-38c5-401c-ba87-2beecd0ae379',
                         '564376d6-5cdd-4a12-ad09-f0089cc38eb7', 'ade37145-24fd-4ca7-b760-131a8b2a53c9');
