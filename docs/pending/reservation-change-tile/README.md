# Reservation change tile, Nov 5

Build/test only. Nothing here was applied, published, archived or emailed.

## Intake

- New Guest tile: Change to a reservation. Helper: Early check-in, late checkout, extend or change dates, double booking.
- Booking checklist now maps to reservation_change only. guest_needs_now maps to Other guest complaint only. New booking/inquiry and Availability Finder/Leads remain unchanged.
- The booking checklist previously inherited **Current or past guest request** through guest_needs_now. The new tile keeps that existing work type (6352ad30-360b-47f8-8ee2-a634037f3f40), not New booking request or OwnerRez booking blocks. Its verified catalog row supplies GE Day, P2, 3-minute response and 5-minute action. No seats or clocks were invented or changed.
- All category flags remain untouched. Booking guidance still requires its flag enabled and an approved template; existing ticket pins remain unchanged.

## Separate approval required to run

Verify `sha256sum -c docs/pending/reservation-change-tile/SHA256SUMS` from project root.
These are caller-authenticated **data actions**, not DDL migrations. Never run them during this build or impersonate a user inside the scripts.

1. Confirm live publish_ticket_checklist signature and permission; cleaning version 1 ID a998f212-8b1c-4905-984b-482c2815cd82, body MD5 a54db86e7ac93640746fe90e7464d563. `01_publish_cleaning_v2.sql` copies the live body and changes only the repeat step and its 60-day setting via the existing publishing action. Version 1 and all ticket pins remain intact. No feature flags change.
2. Confirm playbook editing migration was applied. The prior application attempt was rejected because the byte-for-byte file contains BEGIN/COMMIT; it remains unapplied. `02_archive_test_1.sql` requires change_playbook_state and guards the verified exact empty active ordinary row afe1a826-eaec-4719-b779-8381ecfcc718 (MD5 f60bef8e2fbc6321d37efa20b9b9f43e), zero steps. It only calls the audited archive action.

## Undo

- Cleaning undo republishes original content as version 3 through publish_ticket_checklist. It does not rewrite or delete v1/v2 or existing ticket history.
- Archive undo requires separate approval to restore an empty placeholder. No canonical unarchive action exists. The staged compensating undo creates a draft from the archived version and approves the new version through save_playbook_draft/change_playbook_state. It cannot restore the original row identity/status, erase archive history or reverse downstream matching history. No direct-update fallback exists.
- Code undo: remove reservation_change from the shared situations list and map booking back to guest_needs_now. This reintroduces the previous booking/complaint ambiguity; do not do it without review.

## Validation

The 60-day review is manual, not an automatic cleaner-history lookup or alert. The browser-safe window predicate tests exact boundaries and cleaner identity, and the template revision helper prepares the same setting without altering published content or original seed. No historical complaints are reclassified.