-- Undo for 01_imported_tickets_switch.sql: removes only the switch row it added.
-- With the row gone the app treats the switch as off, the same as before it was added.
DELETE FROM public.feature_flags WHERE key = 'imported_tickets_page';
