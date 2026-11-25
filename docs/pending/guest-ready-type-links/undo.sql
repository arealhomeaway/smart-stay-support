-- Retain added fields and catalog rows. Disable new behavior, restore the three captured links.
DROP TRIGGER IF EXISTS routine_guest_ready_default ON public.routine_controls;
UPDATE public.guest_ready_standards SET work_type_id=NULL,match_review=NULL,updated_at='2026-11-25 03:26:59.939671+00' WHERE id IN ('0949c472-9d93-498c-886b-b7a010af175b','4b46e22f-6f65-418d-a2fd-e5f0fc99b2b3','c6d61d7e-d08b-4ebd-87dd-0762a6a941dd');
UPDATE public.work_types SET active=false WHERE lower(name) IN ('minor items','pest control');
COMMENT ON COLUMN public.routine_controls.due_on IS 'DEPRECATED by undo: retained guest-ready display date; original due_at is unchanged.';

UPDATE public.routine_controls SET due_on=NULL,guest_ready_standard_id=NULL WHERE guest_ready_standard_id='c6d61d7e-d08b-4ebd-87dd-0762a6a941dd';
