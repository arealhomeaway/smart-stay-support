# Databases hub

Register P3, C1, M1, M2, A9 to A18 (board approved Nov 8). Status: **applied** Nov 9 2026 UTC, not published.

| Step | File | Applied as | What it does |
|---|---|---|---|
| 01 | `01_databases.sql` | `drizzle/migrations/0313_databases_hub.sql` | Adds the menu switch `claims_menu` (off) that hides Guest Claims & Refunds from the left menu; the pages stay reachable by link. Adds `can_edit_claims_in_databases` (register A10: Coordinator, Operations Supervisor, Director of Operations, Admin; Finance and onboarding accounts no). Adds `databases_save_claim_or_refund`: runs as the person, so row security and the existing claim and refund guards still run; changes only Item, Status, Estimated cost, Amount sent, Amount paid back and Follow up on for a claim, and Item, Amount and Follow up on for a refund or credit; refuses a stale copy; writes one history line (`database_edit`) with the person and the time on the same claim or refund the ticket shows. |

Undo: `01_undo_databases.sql` (drops the two functions and the switch row; history lines already written stay).

The staged file and the applied migration are identical byte for byte (checked with `cmp`).

## Checks

- Isolated database test: `src/lib/__tests__/databases-sql.test.ts` (9 tests, all pass), including a stand-in claim guard that still refuses an unapproved claim being sent.
- Cancelled live check: `practice_cancel.sql` on the real home 1012 Wasatch Ct as a real Property Coordinator. Result: the claim on its ticket moved to Determining cost with Amount sent 420.00, on the same ticket, saved by the coordinator with the save time; one history line "Changed in Databases: Status, Amount sent"; a Finance account and an onboarding account were both refused ("Only Operations can change claims and refunds here."); the claim was unchanged after the refusals. Rolled back by a deliberate error.
- Read back after: tickets 0, claims 0, claim history 0, staff alerts 444 (unchanged), practice rows 0, `claims_menu` off.

## Not in this step

No change to claim or refund rules, approvals, ticket routing, clocks, SLAs or alerts. Nothing is deleted.
Checksums: `sha256.txt`.
