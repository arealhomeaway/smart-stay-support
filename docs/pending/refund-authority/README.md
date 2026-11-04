# Refund and compensation authority (pending, not applied)

Approved by Emily, Nov 4 2026. Build and test only.

## Rule
- Coordinator may approve up to and including $500.
- Over $500: Operations Supervisor. Over $1,500: Operations Director.
- Director whatever the amount when any existing Director flag applies (multi-night or full-stay, relocation, outside normal Airbnb policy, policy exception, legal, safety, insurance and the rest of the flag list).
- Every refund or compensation needs a short written reason. The $50 courtesy limit and the over-$300 reason rule are gone.

## Files
| File | What it does | Undo |
|---|---|---|
| 01_refund_authority_guard.sql | Adds `recovery_required_authority` and the BEFORE INSERT/UPDATE trigger `guard_recovery_authority_trg` on guest_recovery. Rejects a pending or approved row recorded below the required level, an unapproved Supervisor/Director case that is delivered or moved past approval, and a monetary remedy with an amount but no reason. Only re-checks when a rule field changes. No anon, PUBLIC or signed-in EXECUTE. | 01_undo_refund_authority_guard.sql |
| 02_allow_app_recovery_values.sql | Widens two live checks so the database accepts values the screens already write: authority level `pc`, and remedies `courtesy_item`, `full_night_refund`, `other`. Prechecks the captured live definitions and stops if they differ. | 02_undo_allow_app_recovery_values.sql |

Apply 02 before or with 01. Without 02, every coordinator-level save is rejected by the live check today, independent of this change.

## One source
Limits live in `src/lib/recovery-policy.ts`. The SQL repeats them as constants, and `src/lib/__tests__/refund-authority-sql.test.ts` fails if the limits, Director flags or remedy lists drift, and checks screen and database give the same level at every boundary.

## Existing rows
guest_recovery had 0 rows when this was written. The guard changes no rows and never blocks edits that leave rule fields unchanged.
