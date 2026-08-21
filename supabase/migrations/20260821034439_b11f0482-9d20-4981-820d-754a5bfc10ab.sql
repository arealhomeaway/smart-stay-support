
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS last_quarterly_review_at timestamptz,
  ADD COLUMN IF NOT EXISTS quarterly_review_due_on date NOT NULL DEFAULT current_date;

INSERT INTO public.playbooks (id, category, title, summary, active)
VALUES (
  'b7a1c8e2-4f11-4a3d-9b6e-2c9f7d1a5e01',
  'cleaning',
  'Quarterly Property Review — Cleaning',
  'Completed on site by a cleaning supervisor every three months. Verifies deep-clean standards, safety devices, inventory and the slow-building issues a turn clean will never catch.',
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.playbook_steps (playbook_id, position, instruction, detail, required, photo_required) VALUES
('b7a1c8e2-4f11-4a3d-9b6e-2c9f7d1a5e01', 1, 'Confirm the review window and access', 'Home must be vacant with no same-day arrival. Confirm codes and parking before you leave for the property.', true, false),
('b7a1c8e2-4f11-4a3d-9b6e-2c9f7d1a5e01', 2, 'Test every smoke and CO alarm in the home', 'If one chirps or fails, sweep all of them — never replace a single unit and leave. Log make, location and battery date.', true, true),
('b7a1c8e2-4f11-4a3d-9b6e-2c9f7d1a5e01', 3, 'Check the water heater area for rust, moisture or scorch marks', 'Water heaters are our most common CO source. Photograph the base pan and the flue connection.', true, true),
('b7a1c8e2-4f11-4a3d-9b6e-2c9f7d1a5e01', 4, 'Run every faucet, shower and tub; check under all sinks', 'Look for slow drips, swollen cabinet bases and staining. A dry cabinet today with a water ring is still a ticket.', true, true),
('b7a1c8e2-4f11-4a3d-9b6e-2c9f7d1a5e01', 5, 'Flush every toilet twice and check the base seal', 'Rocking toilets and soft flooring at the base become subfloor damage. Report, do not wait for a guest to find it.', true, false),
('b7a1c8e2-4f11-4a3d-9b6e-2c9f7d1a5e01', 6, 'Inspect ceilings, walls and closets for stains, patches or open holes', 'Any hole opened by a past repair and left unfinished is a failed review. Photograph and open a ticket the same day.', true, true),
('b7a1c8e2-4f11-4a3d-9b6e-2c9f7d1a5e01', 7, 'Replace HVAC filters and record the size', 'Note the filter size in the step note so the next review can pre-stage the right one.', true, true),
('b7a1c8e2-4f11-4a3d-9b6e-2c9f7d1a5e01', 8, 'Run heat and cooling for ten minutes each', 'Confirm both modes reach set point and note any smell, noise or condensate pooling.', true, false),
('b7a1c8e2-4f11-4a3d-9b6e-2c9f7d1a5e01', 9, 'Deep clean behind and under the refrigerator, range and washer', 'Turn-clean blind spots. Pull appliances where safe and clean coils, vents and floor.', true, true),
('b7a1c8e2-4f11-4a3d-9b6e-2c9f7d1a5e01', 10, 'Clean the dryer vent line and lint path', 'Fire risk item. Photograph the vent exterior flap operating.', true, true),
('b7a1c8e2-4f11-4a3d-9b6e-2c9f7d1a5e01', 11, 'Run the dishwasher, washer and dryer through a short cycle', 'Confirm drainage, no leaks at the connections and no error codes.', true, false),
('b7a1c8e2-4f11-4a3d-9b6e-2c9f7d1a5e01', 12, 'Deep clean the oven, range hood and microwave interior', 'Degrease hood filters; replace them if they no longer come clean.', true, true),
('b7a1c8e2-4f11-4a3d-9b6e-2c9f7d1a5e01', 13, 'Strip and inspect every mattress and pillow protector', 'Look for stains, tears and sagging. Flag anything a guest would photograph.', true, true),
('b7a1c8e2-4f11-4a3d-9b6e-2c9f7d1a5e01', 14, 'Count and grade the linen and towel par', 'Retire greyed, thinning or stained textiles now rather than at a turn. Record shortfalls in the step note.', true, false),
('b7a1c8e2-4f11-4a3d-9b6e-2c9f7d1a5e01', 15, 'Inventory kitchen, dining and small appliances against the home standard', 'Note missing or mismatched items so restock happens before peak season.', true, false),
('b7a1c8e2-4f11-4a3d-9b6e-2c9f7d1a5e01', 16, 'Check consumables and supply closet levels', 'Paper goods, soap, laundry, coffee, batteries, light bulbs, filters.', true, false),
('b7a1c8e2-4f11-4a3d-9b6e-2c9f7d1a5e01', 17, 'Test every light and replace any burnt or mismatched bulbs', 'Match colour temperature across a room; mixed bulbs read as neglect in photos.', true, false),
('b7a1c8e2-4f11-4a3d-9b6e-2c9f7d1a5e01', 18, 'Verify wifi speed, TVs, remotes and streaming sign-ins', 'Run a speed test and note the result. Sign out of any guest streaming account left logged in.', true, true),
('b7a1c8e2-4f11-4a3d-9b6e-2c9f7d1a5e01', 19, 'Test all locks, lockboxes, door codes and window latches', 'Change any code that has been shared outside the current guest cycle. Replace low lock batteries now.', true, false),
('b7a1c8e2-4f11-4a3d-9b6e-2c9f7d1a5e01', 20, 'Walk the exterior, entry, patio and grill area', 'Look for trip hazards, loose railings, pest activity, drainage and lighting. Clean and check the grill.', true, true),
('b7a1c8e2-4f11-4a3d-9b6e-2c9f7d1a5e01', 21, 'Compare the home against its live listing photos', 'Anything that no longer matches the listing is either a repair ticket or a photography request.', true, false),
('b7a1c8e2-4f11-4a3d-9b6e-2c9f7d1a5e01', 22, 'Open a ticket for every deficiency found, with photos attached', 'One ticket per issue with the correct work type. Do not bundle unrelated findings into the review itself.', true, false),
('b7a1c8e2-4f11-4a3d-9b6e-2c9f7d1a5e01', 23, 'Supervisor sign-off and owner-facing summary', 'Confirm the full photo set is attached, list the tickets you opened, and write the warm owner update describing how their home is being cared for.', true, false)
ON CONFLICT DO NOTHING;

UPDATE public.work_types
SET playbook_id = 'b7a1c8e2-4f11-4a3d-9b6e-2c9f7d1a5e01',
    required_closure_evidence = COALESCE(required_closure_evidence, 'Completed checklist, full photo set, list of tickets opened, owner summary sent'),
    team = 'property_operations',
    active = true
WHERE name = 'Quarterly inspection review';
