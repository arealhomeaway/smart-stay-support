-- Undo fix batch 4 part 3: switches the same four triage windows back on.
UPDATE public.coverage_triage_windows SET active = true, updated_at = now()
 WHERE NOT active AND id IN ('dcf1e26c-0e3c-443a-9f75-88c8e9336b08', '9e00af58-38c5-401c-ba87-2beecd0ae379',
                             '564376d6-5cdd-4a12-ad09-f0089cc38eb7', 'ade37145-24fd-4ca7-b760-131a8b2a53c9');
