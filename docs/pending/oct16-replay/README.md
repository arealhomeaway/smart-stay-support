# October 16 Opportunity notification replay — pending, not applied

## Evidenced function

`private.notify_opportunity_staff(uuid,text)` is the single database function identified by the October 16 notification change evidence. `replay.sql` contains its exact current live UTF-8 `pg_get_functiondef` bytes, decoded from database-provided base64 and verified against database-provided SHA256:

`69b4f310b2a5ee5f2b6af68c3c209230a9b70548b99fea5a5f476c8f9a51500a`

The source base64 and SHA are retained in `capture.json`. The live definition builds `/onboarding/<property_id>?opp=<work_item_id>`, then passes it to `private.notify_onboarding_recipients`. Replacing the live function with these identical bytes changes no definition or behavior and performs no row writes. Replay was not applied. This is pending SQL outside migration history, not an applied repair to 0150.

## Evidence and limits

- Chat message #1843, October 16 16:15 UTC: Kati's notification opened the project plan instead of the homeowner's Opportunity.
- Chat message #1844, October 16 16:21 UTC explicitly records `notify_opportunity_staff` changing from `?task=<source_task_id>` to `?opp=<work_item_id>` and the database change being applied.
- Commit `fa469650e2280d3809f31769cce98b5b5f19d188`, October 16 16:21:06 UTC, “Open Opportunity links in alerts,” contains the matching Opportunity route/parser/panel changes. Parent `2e34ec3f` adds link parsing coverage.
- Its `0150_opportunity_notifications_link_to_opportunity.sql` is comment-only, so Git alone cannot prove the missing SQL contents. The chat evidence plus live definition identifies this function; the exact October 16 historical bytes are not available.
- No evidence identified additional owner/staff builders changed on October 16. `private.notify_onboarding_recipients` is a downstream candidate, not an evidenced changed function, and was deliberately not included. No owner builder is evidenced.