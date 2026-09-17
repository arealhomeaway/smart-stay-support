# PR #10 practical Lovable launch candidate

Current rollout standard: September 17, 2026. The goal is a usable Resolve candidate for Kati and Onboarding, Micah and Operations, Emily as product owner/admin, and the first Active Owner. Preserve the approved architecture, lifecycle, roles, owner privacy, canonical records and core functionality. Only demonstrated launch blockers delay rollout; do not expand hardening for theoretical scale or rare cases.

## Authorized scope and current checkpoint

Use the existing Lovable project and its shared backend. The user now authorizes a backup/export, paused external messages and scheduled jobs, approved preview-branch reconciliation, required migrations, and primary workflow testing with synthetic records. This supersedes older isolated-only restrictions in prior planning documents. Do not introduce Docker, another Supabase environment or another platform. Do not merge or publish before Emily reviews the candidate. Stop before an action that could damage existing production data or send a real external communication.

- Feature branch: `codex/onboarding-active-owner-build`.
- Last verified HEAD: `5c4ad5dbd317068363296b64946091d0540f70a3`; application-code checkpoint: `264b6c68460abaead266de3301e6c6b1a168947f`.
- Updated local evidence after the staff-email privacy fix: **881 tests / 130 files / 3318 assertions**, TypeScript, focused lint and production client/server build passed; **54 isolated PGlite migration checks** passed again. These are local results, not cloud, authentication or full-schema acceptance evidence. Receipts: `.codex-qa.local/pr10-launch-{unit-verified,typescript,build,migrations}.log`. The initial sandbox unit run encountered dependency-read EPERM; the successful authorized local run supersedes it.
- A built-in managed backup dated **2026-09-17 14:16:16 UTC** is visible. No restore action was taken. The user separately approved the full existing-project database export, local destination `C:\Users\ARHAC\AppData\Local\Resolve\Backups\PR10\2026-09-17`, and Lovable's required temporary-download-link email to the signed-in account. Fresh export has been started; completion/download still needs verification.
- Resolve was unlinked from the existing **ARHA Info Outlook Connector**; the connection was retained and its UI verified **0 linked projects**. All three database jobs are now paused: `deliver-owner-alerts` (1), `quarterly-inspection-scheduler` (2), `resolve-mailbox-sync` (4). Schedules/definitions were retained; only job 1 needed changing. `breezeway_outbound` changed from true to false; other relevant integration flags were already false. Do not use signup/reset/team-email flows or restore delivery during testing.
- Fixed the concrete staff-private approval-notification delivery flaw in `staff-notify.server.ts`: verify current internal-staff permission, roles and enabled Auth account before sending; reject external/mixed recipients; preserve skipped history and leave lookup failures pending. Four regression tests / 36 assertions pass. No migration or external delivery test was needed. Keep the connector paused until the candidate runs this fix and synthetic queues have been reviewed.
- No migration application or Lovable preview switch has been performed in this rollout. Cloud/authenticated acceptance is **NOT RUN**.
- [Draft PR #10](https://github.com/arealhomeaway/smart-stay-support/pull/10) remains the review vehicle. No merge or application publication is authorized.

## Safe execution order

| Step | Status | Completion evidence |
|---|---|---|
| Confirm backup/export scope and destination | PASS | Exact database scope, local destination and required account-notification email approved by the user. |
| Create and verify backup/export | IN PROGRESS | Managed backup from **2026-09-17 14:16:16 UTC** is visible; no restore performed. Fresh export started. Still verify completion, coverage and protected local download. |
| Pause external messages and scheduled jobs | PASS FOR TEST PATHS | Outlook project access removed; all three database jobs inactive; Breezeway outbound disabled. Original states preserved in the rollout receipt. No public signup/reset or email invitation testing. Do not automatically restore delivery. |
| Fix identified approval-notification privacy flaw | PASS LOCALLY | Narrow recipient check plus four regressions passed; all 881 unit tests, TypeScript, focused lint and production build pass. No migration or real external communication. |
| Reconcile approved preview branch | NOT RUN | Recheck remote refs; ordinary fast-forward of `lovable/onboarding-active-owner-preview` to verified feature HEAD. Preserve divergent `lovable/onboarding-active-owner-livepreview`, feature branch and `main`; stop if refs changed or fast-forward is unavailable. |
| Reconcile backend ledger and apply required migrations | NOT RUN | Compare actual ledger and schema with the [54-file migration manifest](onboarding-active-owner-migration-manifest.md); apply only required files in dependency order, retaining receipts and postchecks. Do not replay already-applied or duplicate preview batches. |
| Select and verify Lovable candidate | NOT RUN | Confirm selected branch, code revision, shared backend binding and actual preview URL. Do not publish. |
| Prepare synthetic identities and records | NOT RUN | Record synthetic IDs, canonical relationships, role/seat assignments and disabled outbound paths. |
| Run the eight primary workflows below | NOT RUN | Role, route, expected/actual result and concise evidence for each; desktop plus a practical mobile pass. |
| Emily reviews candidate | NOT RUN | Exact verified preview link, roles, working capabilities, true blockers and intentional deferrals supplied. |

The manifest retains historical authorization wording; its filenames, dependency order, preconditions and checks remain the technical reference. This document and the latest user instruction govern current rollout authorization. Read-only Cloud preflight confirmed 29 recent ledger entries: originals 01–22, six Lovable bundles and the ledger-preservation entry. Canonical 23–54 are absent. Existing request codes are supported legacy codes; the three checked opportunity/property/badge uniqueness groups have no duplicates. The eight guarded tables and installed predecessor functions are owned by postgres. This inventory is not evidence that pending migrations or authenticated workflows have run.

## Test identities and setup

| Person or synthetic equivalent | Permission and responsibility | Entry route |
|---|---|---|
| Emily | `admin` / Platform Owner | `/team`, `/onboarding`, `/owner-programs` |
| Kati | `onboarding`, project PM, protected `director_onboarding` seat | `/onboarding` |
| Onboarding teammate | `onboarding`, assigned project tasks | `/onboarding/my-work` |
| Micah | `manager`, protected `director_ops` seat | `/onboarding` |
| Operations acceptance/Live reviewer | `manager`, protected `ops_supervisor` seat | `/onboarding` |
| Owner A and Owner B | Separate confirmed, enabled accounts; only `owner` access after invitation redemption | `/auth?next=%2Fowner`, then `/owner` |

An admin configures **`/team` → Seats → Update seat & coverage → Save seat**. Project Director text alone does not grant the protected review responsibility. Kati may execute as PM and review as Director, but submission and review remain separate actions. Use actual enabled test accounts for permission evidence; admin role preview is not an owner-isolation test.

The existing Full Furnishing and No Furnishings assets in `qa/onboarding` are local render fixtures, not database seeds. Create clearly named synthetic QA homes through **`/properties` → Add property → Add manually**; check **Mark as a QA / test home** and leave OwnerRez links blank. **Open property → Link owner of record** uses one canonical Owner. Then **Start onboarding**, select scope, PM/Director, dates and applicable modules. Verify QA projects stay outside production metrics.

**Owner-access caveat:** pure owner access intentionally rejects `is_demo=true` programs/properties. Use two additional unmistakably named synthetic real-mode homes/programs (`is_demo=false`) for Owner A/B, with distinct canonical Owners, no external integrations and outbound delivery paused. Record these IDs explicitly; they are synthetic records even though they exercise the real owner path. Do not relax demo isolation or claim QA-mode preview proves owner access.

For each owner program: **`/owner-programs` → Create draft program → Confirm closing today → Program setup / Save details → Review activation → Activate program → Issue invite code**. Confirm included Property, canonical Owner and DFY setup first. Issue invite code creates a record without email. Use an approved no-email account-creation path with confirmed synthetic recipient email, then redeem at `/awaiting-access` or `/join`. Redemption establishes the canonical account link; do not bypass it with manual `owner_user_id` changes. Standard sign-up/reset-password and staff Team invitations can send mail, so do not use them while testing unless delivery is verifiably contained.

## Primary acceptance checklist

All rows are **NOT RUN** against the Lovable/shared backend.

| # | Primary workflow | Action and required result |
|---|---|---|
| 1 | Clear property progress and next action | In `/onboarding`, open both QA scope cases. **Overview** explains lifecycle, PM, next milestone and primary blocker. **Work** identifies the responsible person and actionable work; future work is quiet and nonapplicable furnishing work is excluded. **Handoff** explains why readiness is blocked. A blocker must prevent **Ready for handoff**. |
| 2 | Kati executes and separately reviews | In `/onboarding/{propertyId}?tab=workflow`, complete released work with evidence. **Stage capture and review → Save capture → Submit for review**, then separately **Approve stage** as Director. Return one stage for correction, resubmit and review; earlier findings remain visible. Selecting a stage is not lifecycle advancement. |
| 3 | Micah reviews operational readiness | PM requests handoff after work is ready. Kati records **Approve director of onboarding review → Record decision**. Micah then records **Director of Operations review**. Missing required work or owner approval remains a clear blocker. |
| 4 | Operations accepts and moves Live | Operations records **Approve operations acceptance → Record decision**. Property remains pending Live until the separate **Approve live confirmation → Record decision**. Only then show **Active operations**, with ordered review history. |
| 5 | Active Owner uses the program | Owner A signs in and sees the correct property, requests, WHY and progress toward **at least 100 hours**. Create an operational Ticket for A's enrolled home. In `/tickets/{id}`, save a reviewed, owner-safe **Owner update**. Its automatic opportunity appears in `/owner` under **Needs your attention** or **Property work to review**. Review details, respond where applicable, and **Log time → Save entry** with actual minutes/attestation. Response alone adds no hours; review-only work remains available. Canonical approval/authority determines spending decisions and WHY. Exactly 100.0 hours qualifies; do not fabricate real participation to test the threshold. |
| 6 | Owner A cannot access Owner B | In two genuine sessions, each owner sees only their own property/program. Attempt the other owner's known opportunity/approval identifiers through existing actions; receive denial or no other-owner payload. Switch accounts in one browser and verify no stale private content. |
| 7 | Staff-private information stays private | Place distinct synthetic canary text in internal Ticket notes, guest fields, credentials and restricted financial fields; write separate safe Owner update text. Owner screens, data responses and reports must omit private canaries and show only allowed narrative/cost. Raw internal Ticket access must not reveal them. |
| 8 | Core history is understandable and durable | Owner reviews/logs revision 1; staff saves revision 2. Current opportunity updates while **Reviewed updates in your participation history** retains revision 1. Correct a time entry and verify original history remains while total counts the replacement once. Check **Your recorded review responses**, property **History**, and participation report download. |

## Finding classification and review handoff

- **Launch blocker:** an observed failure prevents a named primary workflow, grants inappropriate access, exposes private information, loses/overwrites important records, materially misstates readiness or time, or prevents the required backup/delivery containment before shared testing. Missing authentication needed to run these checks is a concrete execution blocker, not an architecture defect.
- **Fix shortly after launch:** wording, extra clicks, cosmetic/secondary mobile issues, nonessential filters, or an identifiable legacy record with a workable manual handling path. Escalate only if its actual effect breaks a primary workflow.
- **Future scale improvement:** exhaustive stress testing, high-volume tuning, all rare role/transfer/concurrency combinations, and enterprise delivery-recovery refinements. Keep existing safeguards; do not expand this rollout to complete every theoretical test.

Do not turn every older PARTIAL checklist item into a launch blocker merely because broad acceptance evidence is missing. Record actual findings and their effect. The final handoff must state what the team can do, true launch blockers, intentional deferrals, and the **verified candidate URL plus test roles**. The project editor link alone is not proof of a working candidate: [Resolve Lovable project](https://lovable.dev/projects/9ccd5407-8c2f-4bb6-af2b-c23477f01c08). Runtime preview link and primary cloud workflow results remain unverified.
