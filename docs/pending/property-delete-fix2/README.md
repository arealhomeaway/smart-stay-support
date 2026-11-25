# Property delete fix 2 (staged only)

Found Nov 25, 2026 while deleting 5253 Trace (ac28468b). The safety check passed, but the delete stopped with "Linked records prevented deletion. Nothing was removed." The transaction rolled back, so nothing was removed.

Cause: the delete saves each record's position once. Removing a Task runs the existing `sync_onboarding_work_item` trigger, which marks its linked work item archived. That moves the work item, so the saved position no longer matches it, and the home then can't be removed because the work item still points at it. Homes with no Tasks (123 test) were not affected.

- `01_fix.sql`: replaces only `delete_onboarding_property`, re-reading the scope on every pass and counting progress by rows removed. Safety checks, authority, audit, guard, existing triggers unchanged.
- `undo.sql`: restores the function exactly as in 0372.

Apply only on `Approved: apply property-delete-fix2`.
