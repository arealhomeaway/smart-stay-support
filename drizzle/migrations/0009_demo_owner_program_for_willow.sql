-- Re-create the Active Owner demo program on the surviving Willow demo home.
-- Enrollment happens before the program has a start date (the rules allow a
-- home to join only while a program has not begun), then it is started.
INSERT INTO public.owner_programs
  (property_id, owner_record_id, owner_name, owner_email, status, target_hours, is_demo, notes)
SELECT p.id, p.owner_record_id,
       'Dana Willow (demo homeowner)',
       'demo.owner@example.invalid',
       'pending',
       100,
       true,
       'Demo Active Owner program for the Willow demo home.'
FROM public.properties p
WHERE p.id = 'a0000000-0000-4000-8000-00000000a001'::uuid
  AND p.owner_record_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.owner_programs op WHERE op.is_demo AND op.property_id = p.id
  );

INSERT INTO public.owner_program_properties (program_id, property_id, is_demo, closing_confirmed, closing_date)
SELECT p.id, p.property_id, true, true, CURRENT_DATE - 45
FROM public.owner_programs p
WHERE p.is_demo AND p.property_id = 'a0000000-0000-4000-8000-00000000a001'::uuid
  AND NOT EXISTS (
    SELECT 1 FROM public.owner_program_properties op
    WHERE op.program_id = p.id AND op.property_id = p.property_id
  );

UPDATE public.owner_programs
SET status = 'active', started_on = CURRENT_DATE - 30
WHERE is_demo AND property_id = 'a0000000-0000-4000-8000-00000000a001'::uuid AND status = 'pending';
