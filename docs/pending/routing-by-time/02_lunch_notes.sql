-- Routing by time, part 2: lunch notes say cover takes all new work. Staged only.
-- Undo: 02_undo_lunch_notes.sql
-- Data change (four rows), applied with the data tool, not as a migration. No BEGIN/COMMIT.
-- Only the saved lunch note text changes, for the four coordinator roles that have a lunch hour.

UPDATE public.functional_roles
SET lunch_coverage = 'During this lunch hour, another Guest Experience coordinator on shift takes all new work; if none is on shift, a Property Operations coordinator on shift does.'
WHERE code = 'ge_day';
UPDATE public.functional_roles
SET lunch_coverage = 'During this lunch hour, another Guest Experience coordinator on shift takes all new work; if none is on shift, a Property Operations coordinator on shift does.'
WHERE code = 'ge_evening';
UPDATE public.functional_roles
SET lunch_coverage = 'During this lunch hour, another Property Operations coordinator on shift takes all new work; if none is on shift, a Guest Experience coordinator on shift does.'
WHERE code = 'po_day';
UPDATE public.functional_roles
SET lunch_coverage = 'During this lunch hour, another Property Operations coordinator on shift takes all new work; if none is on shift, a Guest Experience coordinator on shift does.'
WHERE code = 'po_evening';
