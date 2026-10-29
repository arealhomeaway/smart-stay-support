# Operations Send to owner, Phase 1

Not applied. Do not publish or execute without separate approval.

- `operations-opportunity.sql`: replaces only the existing eight-argument `save_arha_opportunity` body, preserving its staff guard, resources and single-item notification. Adds Operations provenance, same-property Ticket mirror links for reviews, and the existing due date. No table or data changes. Adds a staff-only readiness probe so the app cannot silently send incorrectly labeled items before application.
- `undo.sql`: exact live `pg_get_functiondef` bytes captured October 29, 2026. SHA256: `71bd9e783d03e37dd36e83453b8689984c506f114165edef5fc62dde74bd2abb`. Reconfirmed against the live database after building. Replacing the same signature preserves its existing grants; the change does not alter those grants.
- `undo-readiness.sql`: drops only the new readiness probe, confirmed absent in the live database before staging.
- `live-definition.sha256`: fingerprint of the exact undo bytes.

Rollback: apply `undo.sql` then `undo-readiness.sql`; no history or sent records are erased. Recheck the current live definition before applying either forward or undo SQL if anyone has changed the function since capture.

Isolated PGlite tests exercise Operations labels, existing Onboarding behavior, same-property Ticket links, staff denial, unavailable enrollment/login, single notification and executable undo. No live rows, files, accounts or deliveries were changed.

Work Order preparation already invokes `publish_owner_approval` atomically when the canonical recipient is eligible. The window uses that existing action once, not a second publication. Ticket updates use the existing reviewed save; saving itself has no new notification producer. No time-entry action is called.