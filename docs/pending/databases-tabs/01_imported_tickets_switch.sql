-- Databases, Tickets tabs (Emily, Nov 9; register P3, H9).
-- Adds one switch, off, so an Admin can bring back the old imported tickets
-- lists (the Admin "Imported tickets" tab and the Imported tickets list on
-- Integrations) in Admin > Workflow controls. Nothing is deleted.
-- Until this row exists the app already treats the switch as off.
-- Undo: 01_undo_imported_tickets_switch.sql
INSERT INTO public.feature_flags(key, label, description, enabled)
VALUES
  ('imported_tickets_page', 'Old imported tickets lists',
   'When on, the Imported tickets tab shows in Admin and the Imported tickets list shows on Integrations. Off: Databases, Tickets holds them (Older open, Closed history, Needs a home).',
   false)
ON CONFLICT (key) DO NOTHING;
