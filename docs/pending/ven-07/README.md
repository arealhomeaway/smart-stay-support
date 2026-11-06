# VEN-07 vendor home access window
Approved by Emily, Nov 6 2026. A vendor reads a home only with an open or recently
closed (30 days) Ticket or Work Order there. Staff access unchanged.
1. `01_vendor_home_access_window.sql` (precheck inside; refuses if the policy changed).
Undo: `01_undo_vendor_home_access_window.sql`. Checksums in SHA256SUMS.
