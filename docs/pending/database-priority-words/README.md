# Database priority words
Waiting for `Approved: apply database-priority-words`.
Changes four generated notification sentences from Right now to P1. Does not rewrite history or existing alerts.
The live function scan found no Today/Routine priority labels in other public/private alert or notice producers.
Apply only after exact captured-definition comparison with undo.sql; execute apply and one audit_log application entry in a transaction. Re-read definition after apply.
Undo restores the exact captured function body. Existing ACL, clocks, recipients, conditions, thresholds and deduplication stay byte-identical.
Practice executes the captured and replacement functions on identical isolated facts and compares recipients, timings and alert counts.
