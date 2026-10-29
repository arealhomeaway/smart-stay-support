# Enrollment ambiguity fix, October 29, 2026

- Applied through the migration tool as `drizzle/migrations/0182_enrollment_ambiguous_program_alias_fix.sql`.
- Only change: rename the SQL query alias `p` to `existing_program` in the existing-login guard. The PL/pgSQL row variable `p` and all behavior remain unchanged.
- Failure: `public.active_owner_enrollment_step(uuid,text,jsonb,uuid)`, body line 33 (full definition line 38), at `f.id=p.owner_user_id`. Reproduced using the exact live-before definition in isolated PostgreSQL.
- Present in migration 0160, applied October 27 at 00:18:15 UTC. Not introduced by today's security or after-handoff changes.
- `undo.sql` minus its final semicolon equals the decoded `live-definition.base64`, 10,400 bytes. SHA256: `f03a4ad1e65399557548d2f95f3d973bcf204c8a1a75e85fff29ce99f2e35070`.
- Live fixed definition SHA256: `45f4e397755e286559debdc0f68d5ed446ae8ad4b57b18959819895e3c17ede0`.
- ACL before and after: `{postgres=X/postgres,authenticated=X/postgres,service_role=X/postgres}`. Search path remains `public`.
- Isolated tests reproduce the original failure before checkpoint/account creation and run all fixed checkpoint branches for new/existing owners, interrupted Retry, repeated Retry and different-login refusal. Canonical downstream collaborators are fixture test doubles, not a full copy of live triggers or email delivery.
- Full suite: 1,756 passed, 5 skipped, 0 failed. Automatic validation reported build OK.
- Fern: one property, one active onboarding project, 177 open onboarding Tasks and their 177 internal work-item mirrors. Canonical Owner Rachel Ramsey. No program/link/login/owner review/owner notification/welcome/email/enrollment run.
- No persisted enrollment runs or enrollment audit/error records since October 26. Failed prepare rolls back before the run insert, so additional failed attempts cannot be counted from these records.
- Post-change counts and checksums match for properties, projects, Tasks, Owners, programs, links, work items, reviews, enrollment runs, owner notifications, welcomes and email log. Account count remained 32, but the account checksum changed because an existing unrelated account's `updated_at` changed concurrently. No account calls or writes were made by this investigation; full account byte equality is not verified.
- Retry is safe while the original Add property window and its successful intake receipt remain open. Closing/reopening loses that in-memory receipt. No Fern retry was performed, no sign-in, no release call, no email send, no publish.
- Rollback: apply the exact `undo.sql` through the migration tool and verify the original SHA256 and ACL above.