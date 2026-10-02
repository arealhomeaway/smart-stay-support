# STR cleaner safeguard (database rules)
- Nightly cron `str-cleaner-time-nightly`: 07:00 UTC primary; 07:30/08:00/08:30 resume unfinished runs, no-ops once complete. Why: resumable, no duplicates.
- Safeguard state only in `private.cleaner_safeguard_state`/`_eval`; UI/RPCs never recompute. Why: one authoritative rule.
- Dispatch = Resolve check-before-assign (`cleaner_record_dispatch`); Breezeway-native assignments evaluated/alerted, never undone. Why: Breezeway writes allowlisted.
- Overrides single-clean, append-only (`cleaner_safeguard_overrides`), `private.is_director` only. Why: permanent audit.
- Re-evaluation via deferred trigger on `cleaner_exposure_ledger`; alert only on escalation/new inversion. Why: no duplicate alerts.
- `cleaner_workers` = person directory; other sources write append-only `property_work_records`; `property_person_activity` consolidates. Cleaner ledger is the only safeguard input. Why: extensible.
- Departure Review: created only by DB `create_departure_review_from_clean` (Finished/Approved/Closed housekeeping clean + ended reservation, unique event_key); separate `cleaning_reviews` record; rules in `src/lib/departure-review.ts`; real homes gated by app_settings `departure_review_live_homes`. Why: one trigger, no duplicates, legacy routine generator retired.
- Departure clean → reservation matching: pure rules in `src/lib/departure-matching.ts` (configurable clean types via app_settings `departure_clean_task_types`); saved states in `departure_clean_matches` (manual links never overwritten, one Matched clean per reservation) with append-only `departure_clean_match_events`; review trigger reads snapshot or Matched record and allows one review per reservation. Why: never guess a reservation, no duplicate reviews.
