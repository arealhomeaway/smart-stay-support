# Fix batch 3: words and names (staged, NOT applied)

Approved by Emily (Nov 8, 2026). Nothing in this folder has been run against the live
database. Apply only with explicit approval, in the order below, and check `sha256.txt` first.
Both parts are data changes (wording in saved rows). No table, column, function, trigger,
permission or rule changes.

| Order | File | How to apply | Undo |
| --- | --- | --- | --- |
| 1 | `01_handoff_standard_wording.sql` | data tool, byte for byte | `01_undo_handoff_standard_wording.sql` |
| 2 | `02_owner_task_wording.sql` | data tool, byte for byte | `02_undo_owner_task_wording.sql` |

## What each part does

1. **Handoff standard.** Live today: 50 requirements, 49 with the note "Proposed. Micah and
   Kati have not signed off.", GST-01 with "Proposed removal", SYS-01 named after a person, and
   LIN-02 saying "proposed ARHA standard". After: the 49 notes are empty, GST-01 reads "No
   longer required.", SYS-01 says the Director of Onboarding, LIN-02 says "the ARHA standard".
   Codes, tiers, statuses, order and linked steps do not change. Each changed requirement gets
   one "edited" line in the handoff history (actor "Wording update"), the same way a screen
   save does. The new text matches `src/lib/handoff-standard-seed.ts` exactly, so the screen
   preview and the saved rows say the same thing. Rows are matched on their current text, so a
   requirement edited since is left alone. Expected: 50 rows changed, 50 history lines.
2. **Homeowner task templates.** Two lines: "Walk the onboarding checklist with Kati..." now
   says the Director of Onboarding, and "Evaluate the proposal..." reads "Look over the
   improvement and give business direction." Expected: 2 rows changed.

## Undo

- Part 1 undo puts back the exact live text and the live `updated_at`
  (2026-10-27 23:33:03.478207+00), only on the 50 original requirement ids and only where the
  batch 3 text is still there. History is add only (a trigger refuses deletes), so the undo
  adds one more "edited" line per requirement instead of removing the first one.
- Part 2 undo puts back the exact live text. The existing trigger stamps `updated_at` with the
  time of the undo (live value before batch 3: 2026-10-29 22:52:32.351825+00).

## Proof

`src/lib/__tests__/fix-batch-3-sql.test.ts` runs both parts and both undos in an isolated
PostgreSQL copy: live text before, names and review notes gone after, saved text equals the
screen seed, codes/tiers/statuses/order unchanged, a second run changes nothing, undo restores
the exact text and time, a requirement added later is left alone, and checksums match.

## Not staged (needs a separate decision)

- **Protected onboarding templates.** 41 saved template Tasks (arha_full_furnishing 20,
  arha_full_plan 8, arha_onboarding_standard 5, asana_full_furnishing 5,
  asana_onboarding_processes 3) contain staff first names, and 10 contain "sample". Templates,
  versions, home plans and Tasks are protected, so they were not changed.
- **Draft playbook "Repair that needs owner approval".** Its summary says "threshold" twice.
  Playbook text is changed only through the Playbooks editor so its version history stays
  whole.
