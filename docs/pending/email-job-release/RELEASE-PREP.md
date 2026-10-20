# Emily — email job release preparation

**Prepared only — NOT approved or ready to release.** No publishing, migration application, database writes, schedules, provider calls, emails, retries, accounts, seats or secrets were changed. All database calls in this preparation were read-only SELECT queries. There were therefore no database test transactions to roll back.

## Blocking limitation

The available database read tool permits SELECT only; the data-change tool permits insert/update/delete only. Schema changes require the migration tool, which applies them and is not a rollback-only test runner. The sandbox's restricted database role cannot execute these functions or schema changes. No attempt was made to bypass these restrictions. **Step 2's actual application/function-call tests and Step 3's real-database retest are Not verified.**

Two exact-file test scripts are prepared beside this report: `test-0152-rollback.sql` and `test-0153-rollback.sql`. Each has its own BEGIN, SET LOCAL lock_timeout='3s', SET LOCAL statement_timeout='30s', exact prepared migration contents, assertions and final ROLLBACK. A privileged transaction-capable runner must stop on any error and roll back/disconnect even if the batch aborts; it must not use migration tooling. Scripts insert/update only the new email_job_runs audit table, never notification/email_log rows, and contain no network/schedule calls.

## 1. Migration log restored

- Renamed `0151_resume_existing_owner_notify_schedule.sql` back to `0150_resume_existing_owner_notify_schedule.sql`; contents unchanged. Journal untouched.
- Every journal tag has a matching file; no duplicate indices or tags.
- Sole unjournaled SQL: `0150_opportunity_notifications_link_to_opportunity.sql`. Its entire current content is a comment-only placeholder. It contains no Opportunity implementation to apply, is ignored by journal execution, and does not itself block the next migration. Do not assume it recreates the deployed Opportunity change.
- Prepared 0152/0153 remain outside the migration directory and must be registered/applied through supported migration tooling only after separate approval; do not hand-edit journal/snapshots. Verify pending/applied history before release; live historical Opportunity function changes have not been reconstructed here.

## 2. Real-schema evidence, not execution results

All mapped tables exist with `id`. Every explicit 0152 reference exists: auth.users(id,email), profiles(id,email), owner_programs(id,is_demo,owner_email,owner_user_id), tickets(id,is_demo), properties(id,is_demo), onboarding_projects(id,is_demo), owner_notifications(is_demo,program_id,owner_user_id,email_status,sms_status), private schema. Mapping now also includes handoffs, whose id/is_demo/ticket_id exist. Optional context fields are read through JSON, not assumed columns.

| Requested 0152 case | Expected | Evidence / actual result |
|---|---|---|
| a. Real ARHA staff, no context | true | James Almario's canonical account is not test/demo; profile has an ARHA address. **RPC Not verified.** |
| b. Linder account, owner_program `579cb6ae-c5a5-4aa3-aac2-64eedd2faafe` | true | Program/home non-demo, real canonical contact present. **RPC Not verified.** |
| c. Real staff, demo program `d9bfe859-672e-4909-987a-cd66d3dc5301` | false | Program is_demo=true. **RPC Not verified.** |
| d. `.invalid` recipient | false | SQL rejection branch inspected; sender tests passed. **RPC Not verified.** |
| e. Real Ticket `35999360-5b73-439b-982d-6fddd80eac43` | true | Non-demo, property_id NULL (no property-context check); stronger non-demo-home fixture also exists: `4c066921-7123-4cac-9581-e4a9146490bb`. **RPC Not verified.** |
| e. Staff notification `5d8735bc-947e-4fc7-bb5a-934b8fe55c58` | true | Non-demo; work_item source `9ef93ce1-c7c2-4b35-9d34-212af9ff3e10`, program/home non-demo. **RPC Not verified.** |
| e. Owner notification `618a5ff8-9059-4fdf-8d77-4cd8d69fb232` | true | Non-demo; program `6cc0d779-9d06-472f-95c1-0a14dfe3b398` non-demo. **RPC Not verified.** |
| e. Work item `63f0d8cb-cfef-4124-83cd-cca90f9333b2` | true | Item/program/home non-demo. **RPC Not verified.** |

**0153:** live `private.dispatch_owner_notification_email()` contains the exact anchor searched by the prepared file. New audit objects currently absent. Actual file application and begin_email_job_run → record_email_job_part → finish_email_job_run execution: **Not verified**. Prepared lifecycle test calls each once and expects a finished run, one staff part, zero email counts; audit rows would roll back.

Final read-only checks confirmed `email_delivery_allowed`, `email_job_runs`, and `block_demo_owner_notification_delivery` do not exist. This is an absence check after SELECT-only inspection, **not proof of a rollback test**.

## 3. Proven defect and mapping coverage

Direct sender entity types: `owner_notification`, `staff_notification`, `owner_program`, `help_ticket`; composer immediate/scheduled contexts: `ticket`, `work_order`, `property`, `onboarding_task`. All map. No-context paths include team invites, direct Ticket email and onboarding Finance delivery; scheduled legacy contexts are dynamic and unknown types remain fail-closed.

Stored staff-source types found: approval, claim, cleaner_safeguard, handoff, onboarding_task, property, ticket, work_item, work_order. Vendor reminder functions also pass vendor, normalized to vendor_org. **Handoff was missing and would refuse real email: added `handoff → handoffs` to prepared 0152 only.** The live notify_handoff_events function passes NEW.id, not a Ticket ID. Four historical Handoff notification sources no longer have matching source records; these should still fail closed, not be exempted.

Remaining unmapped source: `cleaner_safeguard`. Its 15 stored notifications have email_status='none', NULL entity_id; deployed cleaner_alert explicitly requests no email, matching the in-app-only rule. No live email should be allowed for this context; left blocked, not mapped to an invented table. Unknown dynamic/legacy composer or staff source types remain blocked and need context review, not a permissive fallback.

Two small regression tests verify actual SQL entity mappings, including Handoff. **Full suite after fix: 1,535 passed, 0 failed, 5 existing skipped; 234 files, one fresh process each.** Mocked sender tests make no real provider calls. Latest observed automatic compiler/build result: **build OK, 2026-10-20 14:39:01 UTC**. No manual build/typecheck was run. SQL integration/provider delivery are not established by these tests.

## 4. Refreshed first-pass forecast

Read-only snapshot approximately **14:36–14:40 UTC Oct 20**, conditional on successful migrations and app release; not an execution or send authorization.

| Part | Current candidates | Expected email |
|---|---|---|
| Staff backlog | 0 pending; 78 skipped | 0 backlog |
| Ticket deadlines | 1 real new overdue work-start alert to James Almario; 18 demo new work-start alerts | At most 1 real staff email; 0 demo |
| Vendor dispatch | 0 real no-ack candidates; previous snapshot had 1 demo candidate | 0 real; 0 demo email; exact demo dedupe count Not verified |
| Claim deadlines | 0 real; 2 demo passed-deadline rows | 0 real/demo email; exact demo dedupe count Not verified |
| Vendor compliance | 0 eligible verified expiry candidates by deployed threshold function | 0 |
| Transitional vendors | 76 flagged; earliest deadline Nov 29, outside reminder windows | 0 |
| Pending owner alerts | 3 demo, 0 real | 0 real/demo email |
| Program progress | 1 real active program, 1,819 min, no open Opportunities, activity Oct 19; 2 demo active programs | No real email indicated by snapshot; exact full aggregate/candidate replay Not verified; 0 demo/test expected |
| Scheduled email | 0 due | 0 |
| Welcomes | 0 rows; stored template absent → unapproved draft | 0, wording gate unchanged |

James has an enabled canonical account and ARHA profile address; absent preferences use existing enabled defaults. Complete recipient-role eligibility at delivery time is Not verified. Vendor reminders currently request in-app only. Email provider is existing Microsoft 365/info@arealhomeaway.com; no automated SMS or Telegram provider send in this job. Urgent text flags create internal contact work. Forecast: **0 demo/test email, at most 1 staff email, no vendor/homeowner email indicated**; refresh before enabling. New alerts may arise after this snapshot.

## 5. Ordered release list — future approval required

### 1. Apply prepared 0152
Changes: service-only email_delivery_allowed record/account/domain guard, private source guard and owner-notification demo/test suppression trigger; added Handoff mapping. No backfill, schedule or retained test records.

Undo: safest operational rollback is keep schedule off and retain the safety guard. If an approved correction is needed, replace the affected function/trigger through a corrective migration; do not remove demo protections to resume delivery. No destructive teardown script is prepared/authorized.

### 2. Apply prepared 0153
Changes: email_job_runs, email_log run/part attribution columns, owner_notifications run ID, guarded start/part/finish RPCs; modifies the existing owner callback only to suppress immediate callbacks for run-attributed alerts, preserving stored URL/key.

Undo: keep schedule off; preserve audit table/columns/history. A reviewed corrective migration can restore the prior callback condition if needed while retaining 0152 protections; never drop audit objects/data. Interrupted unfinished runs require staff review, not blind retry. Capture prior function definition securely at release without exposing credential-bearing contents.

### 3. Publish the exact reviewed app package
Capture and verify exact immediately prior live commit/tree/build before approval. Read-only public page currently serves **index-HTW9UaHZ.js**; exact live commit cannot be established from that asset. Repository checkpoint before final documentation edits: `961a1e27049e8b6f281a411eb0bdd2729ca50146`, tree `5a97831db4fb4ac69ed165ea13fbe211765ce787`; not a claimed final saved release version.

Every pending runtime change relative to the known `19d68858` source reference:
- `src/lib/email-safety.server.ts`: local domain/demo guard plus fail-closed database verification.
- `src/lib/email.server.ts`: shared final guard, run attribution, no retry after accepted-send audit failure.
- `src/lib/owner-progress-alerts.server.ts`: demo in-app-only alerts, run ID to avoid callback race, surfaced program/insert failures.
- `src/lib/deadline-alerts.server.ts`: demo deadlines in-app-only, remove nonexistent claims.ref read.
- `src/lib/owner-notify.server.ts`: notification context/run attribution, failure reporting.
- `src/lib/staff-notify.server.ts`: shared sender context and staff-part attribution/failure reporting.
- `src/lib/email-composer.server.ts`: scheduled send attribution and safety failure reporting.
- `src/lib/owner-welcome.server.ts`: program context, welcome-part attribution, failure reporting; unapproved template/uncertain Sending restrictions retained.
- `src/lib/email-job.server.ts`: sequential audited start/parts/finish; stop on error/audit failure, unfinished-run guard.
- `src/routes/api/public/hooks/owner-notify.ts`: existing stored server-only token authentication and audited job invocation.
- **Oct 16 `fa469650` Opportunity-link page fix:** `src/components/onboarding/PropertyOpportunitiesPanel.tsx`, `src/lib/onboarding-work-views.ts`, `src/routes/_authenticated/onboarding.$propertyId.tsx` open/expand/scroll the exact owner-facing Opportunity (`opp`), not its internal Task; existing Task links retained. Current live presence Not verified; include in reviewed package.

Non-runtime tracked release contents: six test files (email-job, email-safety, email-safety-migration, email-sender-boundary, owner-progress-demo, onboarding-work-views); lib AGENTS.md; roadmap; existing .lovable/plan.md; prepared SQL, reports, fingerprints and rollback test scripts; schedule SQL; 0150 comment-only Opportunity placeholder and restored schedule note; existing 0150 snapshot/journal entry. Metadata changes since 19d68858 predate this prep; journal was not edited here. No new onboarding hour notification work, hours/eligibility/account changes or welcome wording approval.

Undo: disable schedule first; restore the exact immediately prior approved live app version only if compatible with retained guards/audit. Older shared senders may not call the new guard; therefore an old app rollback is **not proven safe for all email paths** and must not be used to bypass protection. A reviewed safety-preserving rollback package is still required; no rollback was executed.

### 4. Recreate schedule only under separate explicit approval
Prepared exact command is `recreate-schedule.sql`: deliver-owner-alerts, */5 * * * *, stable existing hook, stored private.cleaner_cron_token lookup, 120000-ms network wait. It refuses an existing matching endpoint job, including inactive ones; inspect and reuse rather than duplicating. No key value copied and command never run.

Timing choice: Wait up to 120 seconds rather than responding before the work completes, so the scheduler receives the audited result. This reduces the prior five-second timeout but cannot guarantee completion; unfinished runs stop later runs until reviewed.

Undo: disable/unschedule only this job, preserving audit history, and stop on error/unexpected recipients. First two runs and delivery acceptance remain Not verified and require separate authorization.

## Stop / outstanding verification

Release remains blocked on actual rollback-only real-schema tests of both files and the corrected Handoff behavior; production/provider checks; exact prior/final live-version mapping; full current program-progress replay; compatible safety-preserving app rollback package. Schedule existence was not changed or revalidated through scheduler tooling during this prep. No notifications were inserted or modified for testing, so source-trigger runtime suppression is Not verified against the real database. Nothing was released.