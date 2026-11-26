# Status

Applied as 0388_owner_history_duplicates and 0389_owner_history_duplicates_guard. Both applied files byte-match `apply.sql` and `finish.sql`. No publish.

Eleven isolated practice checks passed with the captured immutable-work guard active. The guard still refuses changes to work content; only archive metadata is mutable through the owner-only action. Safe undo was practised and retains every entry.

Demo homeowner verification:
- Desktop: the existing later 15-minute copy was archived. The original had no Remove duplicate button and stayed visible. Totals changed from 12.0 / 88.0 / 108.0 to 11.8 / 88.3 / 108.3.
- Phone: two new matching 20-minute entries were added through Add work. Only the later copy had Remove duplicate. Confirmation archived it; one original remained. The button measured 44 px, with no page errors or horizontal overflow.
- Reloaded desktop and phone: both showed 12.1 hours, 87.9 to pass 100 and 107.9 to reach 120, with only the originals and no dialog left open.
- Live readback: both archived demo copies retain their original date, minutes and description, plus actor, time and reason. Two audit events name the retained original IDs.

Real owner work was untouched: 203 real entries, fingerprint `1df7ed5e54acc116b04faae6f73a7ea2`, zero archived real entries.

Verification: 66 owner-card/hours tests passed, then 33 focused archive and participation-reader tests passed after their mocks were updated to assert the new archive filter. Fresh type check passed; preview build log shows OK. The full suite was not run.

## Existing files changed

- `OwnerWorkHistory.tsx`: duplicate prompt now offers Keep both and, on later copies only, Remove duplicate with confirmation and plain failure wording.
- `owner-work-history.ts`: shared matching now identifies the earliest original and later removable copies.
- `owner-work-history.functions.ts`: authenticated archive call added.
- Owner participation, program list, analytics, homeowner summary and review readers: archived entries leave current lists and totals.
- Aggregate pagination and time-review tests: mocks now assert the archive filter instead of failing on it.
- `roadmap.md` and prior owner-card-history status: removal marked complete.

New files: duplicate rule tests, isolated practice, this staged package and migrations 0388/0389. Generated types and migration journal were updated by the migration tool only.
