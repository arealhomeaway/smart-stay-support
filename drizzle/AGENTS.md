# STR cleaner safeguard (database rules)
- Nightly cron `str-cleaner-time-nightly`: 07:00 UTC primary; 07:30/08:00/08:30 resume unfinished runs, no-ops once complete. Why: resumable, no duplicates.
- Safeguard state only in `private.cleaner_safeguard_state`/`_eval`; UI/RPCs never recompute. Why: one authoritative rule.
- Dispatch = Resolve check-before-assign (`cleaner_record_dispatch`); Breezeway-native assignments evaluated/alerted, never undone. Why: Breezeway writes allowlisted.
- Overrides single-clean, append-only (`cleaner_safeguard_overrides`), `private.is_director` only. Why: permanent audit.
- Re-evaluation via deferred trigger on `cleaner_exposure_ledger`; alert only on escalation/new inversion. Why: no duplicate alerts.
- `cleaner_workers` = person directory; other sources write append-only `property_work_records`; `property_person_activity` consolidates. Cleaner ledger is the only safeguard input. Why: extensible.
