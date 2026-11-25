# departure-review-live (applied Nov 25, 2026)
Change 2, answer 1 (Emily, Nov 25). Cleaning reviews for real homes use the existing Departure Review rule.
- New Admin-only switch `set_departure_review_live(on)`; writes app_settings `departure_review_live_homes`
  with a start line (`started_at`) and who; audit row each time.
- The rule now skips a real home's clean finished before the start line, so turning it on never makes old reviews.
  Demo homes unchanged. Applying this does NOT turn it on: the setting stays empty until Admin presses Turn on.
- Screen: Integrations page, card "Cleaning reviews for real homes", button Turn on / Turn off (Admin only).
Preflight: preflight.sql. Undo: undo/01_departure_review_live.sql. Practice: 20 checks passed in an isolated reduced-schema PostgreSQL fixture (practice.mjs).
Apply only on: **Approved: apply departure-review-live**

## Application and checks
- Exact approval received Nov 25, 2026. Original fingerprints passed unchanged; live previous function matches the staged undo.
- Repeated preflight: existing producer present, setter absent, real reviews 0, setting absent.
- Applied transactionally as `drizzle/migrations/0380_departure_review_live.sql`. It is identical to approved SQL except the final newline. Generated types refreshed automatically.
- Application audit `daa18fd0-312d-468b-83c4-e672a1fb41c7` recorded at 03:52:21 UTC. This application receipt was written separately after the schema transaction; the switch's own setting changes and audit remain atomic inside its function.
- Live readback: setter and Admin guard present, forward-start guard present, anonymous execute denied, authenticated execute granted with Admin checked inside; producer retains `{postgres=X/postgres,service_role=X/postgres}`.
- Integrations source read: `app_settings` key `departure_review_live_homes` has no row, value null, updated time null. No control was turned on or off; real reviews remain 0.
- Signed-in preview at `/integrations`: card `Cleaning reviews for real homes` shows `Off. Only demo homes get cleaning reviews.` and `Turn on`. Button was not pressed; no page errors. No publication.
- Practice covers Admin-only access, unchanged default, Finished/Approved/Closed, real-home start line, demo behavior, matched reservation, duplicate protection, linked review/event records, exact function undo and retained reviews. Reduced-schema fixture, not a full live database clone.
- Existing `departure-review.test.ts`: 10 passed, 0 failed. Preview build OK. Full suite not rerun; live generation intentionally not exercised because enabling the control was not authorized.
- Existing source UI and other integrations unchanged. Existing README changed only to record application; generated migration journal, snapshot and types changed through the database tool.
