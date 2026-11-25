# One card save and My history

Authorized in the Nov 25 request: “Approved: apply any database changes this needs.”

The additive receipt table links one combined save to canonical answers and hour entries. The save calls existing owner authorization, answer and time actions in one transaction. The history projection uses existing owner membership and staff read access. No existing entry, answer, review status, schedule or automation is removed or rewritten.

The existing recent-repeat guard remains for old callers; a new, transaction-local receipt allows deliberate duplicate entries, while replaying the same save key returns the original receipt.

Preflight: before apply, 203 real hour entries; fingerprint `93b93f41039726754c82c2df75c93402`; real answer fingerprint `1a454f07ba540451817365e0a84a5426`; logging definition `d674b5bcefb72308a8c955a61328f9d6`.

Practice: nine isolated checks using captured table columns and canonical saves. Identity and notification helpers are modeled; not a full live schema clone. Results are retained. Undo restores the captured logging function and disables the new calls without deleting receipts, answers or hours.

Owner removal is not applied: H9 requires archive-only; clarification was requested. Owner saving tests need an existing authorized demo homeowner because newly minted test emails do not pass the existing demo-account gate. No gate is loosened.
