-- Adds the two menu switches, both off, so Admins can turn them on in
-- Admin > Workflow controls. Staged only. Undo: 01_undo_menu_switches.sql
-- Until these rows exist the app treats both switches as off.
INSERT INTO public.feature_flags(key, label, description, enabled)
VALUES
  ('work_orders_page', 'Work Orders page in the menu',
   'When on, Work Orders shows in the left menu and as a tab next to Vendors. Turn on when the vendor portal returns. Work Orders always stay reachable from the ticket.',
   false),
  ('work_map', 'Work Map tab on Properties',
   'When on, the Work Map tab shows next to Properties.',
   false)
ON CONFLICT (key) DO NOTHING;
