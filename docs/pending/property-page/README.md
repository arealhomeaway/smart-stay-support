# Property page: labels and Home Profile edits

Register P1, P2, A12, H10. Status: **applied** Nov 8 2026 (Central), not published.

| Step | File | Applied as | What it does |
|---|---|---|---|
| 01 | `01_property_labels.sql` | `drizzle/migrations/0309_property_labels.sql` | Label list, label assignments and append-only label history. Admin creates, renames, removes labels and adds one label to many homes. Staff who edit a property pick from the list on one home and remove one. Seeds the label `30-day firm` once on every home whose title holds `(30D FIRM)` (26 homes). Active Owner stays a program status, never a label. |
| 02 | `02_home_profile_edits.sql` | `drizzle/migrations/0310_home_profile_edits.sql` | Append-only Home Profile edit history (person and time on every saved item), photos linked to the item they belong to, `save_home_profile_card`, `add_home_profile_photo`, `remove_home_profile_photo`, `my_home_profile_access`. Codes are never written here: they keep the encrypted credential path; the history line records only that a code changed, never the code. |
| 03 | `03_strict_profile_items.sql` | `drizzle/migrations/0311_strict_profile_items.sql` | The save accepts only the exact items on the page: each item key has one stored place (column, JSON path, link source field or code). Before, any one or two level path inside a listed column could be written. `src/lib/__tests__/home-profile.test.ts` fails if the page list and this list drift. |

Undo, newest first: `03_undo_strict_profile_items.sql` (puts back the step 02 save), then `02_undo_home_profile_edits.sql`, then `01_undo_property_labels.sql`. Undo of 02 and 01 removes the new tables, so it also removes any labels and edit history saved since; take a backup first.

Each staged file was compared with its applied migration file: identical, byte for byte.

## Practice runs (cancelled, nothing kept)

1. `practice_cancel.sql` (steps 01 and 02 plus checks): firm_homes 26; Admin create, rename, add to 3 homes allowed; Property Coordinator add one, remove one allowed; coordinator create, add to many and rename refused; profile save of 5 items read back; code history line with no value; edit of an unlisted column refused; homeowner refused. Rolled back by a deliberate error.
2. `practice_cancel_03.sql` (step 03 plus checks): good save of 5 items (two JSON, one column, one link, one code line) read back; the link stored with its own source field; wrong path, wrong column, unknown item, a code item sent as a column and a fake code line all refused with "That item cannot be edited here." Rolled back.
3. Final check on the applied functions (Admin and Property Coordinator, one Operations home and one Onboarding home): Admin add 1; 2 label history lines with person and time; coordinator pick on one home, remove; coordinator create refused; coordinator save of 2 items (one value, one code line with no value); 4 audit lines; 2 edit lines. Rolled back.

Read back after all three: labels 1 (`30-day firm`), assignments 26, label history 27, profile edits 0, profile photos 0, no practice values, links or audit lines left.

## Not in these steps

- No ticket, clock, routing, alert or code value changes.
- The nightly 3 AM Central property info refresh is app code on the existing five-minute job (no new schedule).
- Checksums: `sha256.txt`.
