# Address labels: pending only

Nothing here has been applied. No stored property identity, notification, email or report snapshot is rewritten.

Apply order after separate approval:
1. `01_helper.sql`: stable, fixed-search-path JSON address formatter; authenticated/service-role execution only.
2. `02_labels.sql`: 17 live functions, 18 label expressions. The additional discovered producer is `notify_onboarding_handoff_ready`.
3. `03_owner_address_projection.sql`: expose unit and ZIP in the existing authorized owner-program property projection. Access predicates unchanged.

Rollback: `undo.sql` restores the original 18 definitions before dropping the new helper. CREATE OR REPLACE retains the existing grants; original `proacl` is captured in `manifest.json`.

For every replaced function, `undo/*.sql` contains exact live definition bytes plus one trailing semicolon; `undo/*.base64` contains the original definition bytes. `manifest.json` records live SHA-256, replacement SHA-256 and exact replacement expressions. Every undo hash was compared with the live captured hash. `definitions/*.diff` records the narrow change. `files.sha256` inventories staged bytes.

Rachel's historical welcome used generic "your home" wording, not a property label. Its obsolete address-column query yielded no home context. The code now requests structured address fields and fails clearly if they cannot be loaded. Historical messages remain untouched.

Deliberate retained names: stored identity/edit fields, OwnerRez import/matching aliases and unchanged historical approval/email/report snapshots. OwnerRez picker labels and new setup receipts use the address without changing import matching. Current report producers are staged, not applied; saved report rendering remains snapshot-based.

Verification: isolated formatter parity and grants passed; every producer's changed label expression evaluated to the Fern address. Actual pending summary, note, handoff and owner-message producers were executed in isolated PostgreSQL and produced address labels without changing property identity. Welcome context/rendering, authorized homeowner readers and plan/STR export outputs were tested without delivery. All 18 live definition hashes were rechecked read-only on October 29, 2026 and still match their undo files. Rachel's welcome was confirmed sent at 18:15:04 UTC with generic home copy and no Fern/address label. Read-only inventory found 160 real non-demo/nonarchived homes, zero missing streets.

Signed-in screens, every complete producer workflow and exhaustive visible-site coverage remain not verified. The database files remain pending, so database-generated labels and owner unit/ZIP projections will not change until separately approved and applied.

Preview checklist after publishing and separately approving pending SQL:
1. Open Properties; verify street headings and city/state.
2. Search street, city, ZIP, listing alias and OwnerRez ID.
3. Open a Ticket and return to the same home.
4. Open Onboarding and My Work; verify home labels.
5. Check Handoff and Active Owner follow-up.
6. Check Finance, Work Orders, reviews and vendor coverage.
7. Check homeowner selector, activities, files and approvals.
8. Download new plan/participation/STR reports; preserve old snapshots.