# Retire the legacy Checkout routine (Nov 6 2026)
Approved by Emily. Departure Review replaces the Checkout routine.
- `01_retire_checkout_routine.sql`: refuses any new Checkout routine row (database trigger). Nothing is deleted.
  The screen also stops offering "Run a checkout". Undo: `01_undo_retire_checkout_routine.sql`.
- Closing open Checkout routines: only when a Departure Review exists or is due for the same stay.
  On Nov 6 no real Departure Review existed for either open routine, so none were closed:
  - 16216 Whistle Crk Blvd, created Nov 3 (04bea9f5-c65e-4843-a287-f3580e651744), status due
  - Redstone Hideaway (7351), created Oct 1 (79cc07e5-ad37-4ca5-8f17-fb3813375c29), status due
