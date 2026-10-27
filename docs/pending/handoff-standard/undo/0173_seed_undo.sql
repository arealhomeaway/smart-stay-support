-- Preserve edited standards and history. Retire only unchanged seed rows.
UPDATE public.handoff_requirements SET status='retired',notes=notes||' Seed retired on rollback.' WHERE notes='Proposed. Micah and Kati have not signed off.' AND status='proposed';
