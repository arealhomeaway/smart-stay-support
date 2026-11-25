# departure-review-live (staged, not applied)
Change 2, answer 1 (Emily, Nov 25). Cleaning reviews for real homes use the existing Departure Review rule.
- New Admin-only switch `set_departure_review_live(on)`; writes app_settings `departure_review_live_homes`
  with a start line (`started_at`) and who; audit row each time.
- The rule now skips a real home's clean finished before the start line, so turning it on never makes old reviews.
  Demo homes unchanged. Applying this does NOT turn it on: the setting stays empty until Admin presses Turn on.
- Screen: Integrations page, card "Cleaning reviews for real homes", button Turn on / Turn off (Admin only).
Preflight: preflight.sql. Undo: undo/01_departure_review_live.sql. Practice: not run.
Apply only on: **Approved: apply departure-review-live**
