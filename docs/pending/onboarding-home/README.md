# Onboarding Home as the project database (Admin approval, Nov 12)

NOT applied. Nothing here has run against the live database. Apply only with the Admin's approval.

## Files, in order

| File | What it does |
|---|---|
| `00_preflight.sql` | Stops before anything is written if a function this change relies on is missing, the Staging vendor category is missing, the project status check no longer allows `planning` and `cancelled`, or any new table already exists. |
| `apply.sql` | Additive only. Four new tables (`saved_views`, `ownerrez_listing_cache`, `ownerrez_listing_dismissals`, `onboarding_project_stagers`), three new columns on `onboarding_projects` (`closed_reason`, `closed_at`, `closed_by`), the `onboarding_home_tiles` switch (added off), one private role helper and eight caller-checked functions. Nothing existing is changed or removed. |
| `apply.undo.sql` | Turns the tiles switch off, drops the new functions and helper, and removes read access to the new tables. Every row and column stays. |
| `02_stager_links_from_notion.sql` | Intentionally empty. Filled later with the Notion "Staging Team" to vendor links (spec 3.2). Run after `apply.sql`, only with approval. |
| `02_stager_links_from_notion.undo.sql` | Undo template for 02: marks those links removed (kept, never deleted). |

Run `00_preflight.sql` and `apply.sql` in one transaction.

## What each function allows (spec 3.3)

| Function | Who | Notes |
|---|---|---|
| `add_upcoming_onboarding_home` | Admin, Director of Onboarding | Property + project with status `planning` and Notion status `Upcoming Property`, no plan and no Tasks. The owner or DFY contact and note are kept as one internal project note. The Director seat holder is set as Director. A retry with the same request id returns the same home. |
| `start_upcoming_onboarding_home` | Admin, Director | Under contract: `planning` to `active`, Upcoming status cleared. The screen then runs the existing Start onboarding, which builds the plan. Repeat clicks change nothing. |
| `mark_contract_fell_through` | Admin, Director | Needs a reason. Only for a home with no plan. Project becomes `cancelled` with Notion status `Contract Fell Through`, reason, who and when. The address can later start a new project. |
| `dismiss_ownerrez_listing` | Admin, Director | Not an onboarding home: OwnerRez id, reason, who, when. One open dismissal per listing. |
| `set_onboarding_project_stagers` | Admin, Director | Sets the home's stagers to the given list; only vendors with the Staging category. Removed links are kept as history. Undo on screen puts the earlier list back. |
| `save_onboarding_home_view`, `archive_onboarding_home_view` | Anyone on the onboarding team | Their own views only. |
| `save_onboarding_home_columns` | Anyone on the onboarding team | Their own Columns choice. |

Every change writes `audit_log`; project changes also write `onboarding_project_events`. List assignment of PM, Designer and Utilities uses the existing `set_onboarding_project_role` (already live) behind a Director/Admin check on the server.

## Until this is applied

- Tiles stay hidden (the switch does not exist yet, so it reads as off).
- Upcoming, Contract fell through, Not an onboarding home, stager picking and saved views refuse with "This waits on a database change that is not applied yet. Nothing was saved."
- Not in Resolve yet still works: it reads OwnerRez live when the Director or Admin opens the page. The hourly pass on the existing five-minute job skips until the cache table exists.
- Columns are remembered for that person on that device.

## Practice run

`src/lib/__tests__/onboarding-home-sql.test.ts` runs `00_preflight.sql`, `apply.sql` and `apply.undo.sql` on an isolated practice database (`src/lib/__tests__/fixtures/onboarding-home-schema.sql`, live column names and checks, fake rows). 11 tests pass: who may act, Upcoming and its retry, Under contract once, Contract fell through rules, stagers only from staging vendors, dismissals, saved views and columns per person, preflight on a second run, undo.

## Checksums

See `checksums.sha256` (`sha256sum -c checksums.sha256` in this folder).
