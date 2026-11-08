# Menu cleanup

APPLIED Nov 8, 2026 with Emily's written approval. See the note at the end.

## `01_menu_switches.sql`

Adds two switches, both off: `work_orders_page` (Work Orders in the menu and
as a tab next to Vendors) and `work_map` (Work Map tab on Properties). After it
is applied they show in Admin > Workflow controls.

The app already treats a missing switch as off, so the menu is correct before
this is applied. The file only makes the switches visible so they can be
turned on without a code change.

Undo: `01_undo_menu_switches.sql` removes each row while it is still off.

Checksums are in `sha256.txt`.

## Applied

- Nov 8, 2026: APPLIED byte-for-byte as migration 0268 (`01_menu_switches.sql`). Both switches are off. Undo if ever needed: `01_undo_menu_switches.sql`.
