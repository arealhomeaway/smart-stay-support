# Street address labels

Switch staff and homeowner home labels to street addresses while preserving stored names, IDs, links, permissions, import and sync behavior.

## Build
- One shared formatter provides street plus unit, City/ST, full address, and the required missing-address fallback.
- Update label displays, their address reads, navigation, homeowner screens and exports. Keep listing names and IDs searchable through one shared matching rule.
- Fix welcome address reads and report what Rachel's already-sent welcome actually rendered, without changing it.
- Stage database label helpers and existing alert/read function replacements with byte-exact live undo and hashes. Apply nothing.

## Verification
- Test formatting, searches, representative staff/homeowner/export output, and isolated database parity and label generation.
- Run the full test suite; inspect automatic typecheck/build results. Inventory intentionally retained listing-name uses and missing-address homes.
- No sign-in, publishing, live writes, migrations, syncs or email sends.

## Technical details
Keep address formatting browser-safe in src/lib. Database helpers have fixed search_path and existing authority boundaries. Address projections needed by checked homeowner readers are staged with the database changes. Historical messages and report snapshots remain untouched.