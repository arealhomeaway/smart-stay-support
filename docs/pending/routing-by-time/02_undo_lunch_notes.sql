-- Undo for 02_lunch_notes.sql: puts back the four saved lunch notes exactly as they were.
-- Data tool, not a migration. No BEGIN/COMMIT.

UPDATE public.functional_roles
SET lunch_coverage = 'On-duty Property Operations or Evening Guest Experience role covers new P1 and time-sensitive P2 work'
WHERE code = 'ge_day';
UPDATE public.functional_roles
SET lunch_coverage = 'On-duty daytime or Evening/Weekend Property Operations role covers new P1 and time-sensitive P2 work'
WHERE code = 'ge_evening';
UPDATE public.functional_roles
SET lunch_coverage = 'On-duty Guest Experience or Evening/Weekend Property Operations role covers new P1 and time-sensitive P2 work'
WHERE code = 'po_day';
UPDATE public.functional_roles
SET lunch_coverage = 'On-duty Guest Experience or Weekday Day Property Operations role covers new P1 and time-sensitive P2 work'
WHERE code = 'po_evening';
