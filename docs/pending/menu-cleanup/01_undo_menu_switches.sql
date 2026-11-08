-- Undo for 01_menu_switches.sql. Removes each switch row only while it is still off.
DELETE FROM public.feature_flags WHERE key IN ('work_orders_page', 'work_map') AND enabled = false;
