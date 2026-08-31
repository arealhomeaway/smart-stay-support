# Resolve roadmap

## Active Owner acceptance (complete)
- [x] Fresh demo owner invite redemption (Riley Alder, code QATP-7742, redeemed by a new account)
- [x] Activate Riley's demo program clock (started 2026-08-01, ends 2026-10-29)
- [x] Sign-out / sign-in persistence check
- [x] Submit -> approve, and return -> correct -> approve, no double counting
- [x] Duplicate correction prevented (returned entry shows "Corrected already", no second correction)
- [x] Hours labels: "Reported hours" (pending + approved) vs "ARHA-approved hours"


## New: downloadable Hours & Participation Report (owner self-serve)
- [x] Server-side report builder from saved participation records (owner-scoped)
- [x] In-progress "Progress report" + automatic end-of-window final report (reuse 90-day clock)
- [x] Branded PDF + CSV of time-entry detail, server-generated, no public links
- [x] Totals split: approved / awaiting review / returned-superseded, with explanations
- [x] Shared-property entries counted once, attribution explained
- [x] Outside-period entries listed separately
- [x] Demo validation: in-progress, ended program, post-correction totals, second-owner denial, PDF/CSV match portal

## Breezeway
- [x] Webhook label fix (task lookup failures, not signature failures)
- [x] Confirmed: the nine historical failures are `verify_failed` (Breezeway task
      re-fetch failing, e.g. HTTP 500), not signature/auth rejections. Historical
      log attribution beyond the code path is unverified — no authorized log
      access in this pass.
- [x] Verify_failed events now capture the task id and a transient/permanent
      classification, so a real failure is attributable instead of anonymous
- [x] Bounded, manual recovery pass for transient lookup failures (batch-limited,
      per-event retry cap, reuses the exact live scope/dedupe path) — "Retry
      failed lookups" in the admin panel. Requires the prepared-but-not-applied
      migration `20260828193000_...sql` before the retryable/retry_count/
      recovered_at columns exist.
- [x] Closed a concurrent-duplicate-delivery gap: two identical deliveries could
      both pass the "not yet processed" check and both record `processed`. A
      unique index (same migration) plus a conflict-aware insert now force the
      loser to record as `duplicate` instead.
- [x] Regression tests added (`bun test src/lib/__tests__`) for valid pilot
      events, wrong/missing secret, malformed payloads, other company/property,
      duplicate/stale, concurrent duplicate delivery, transient vs permanent
      lookup failures, bounded recovery/retry cap, and "no business writes".
- Fitzgerald-only preview processing stays unchanged

## PR review (Claude PR #1 — Breezeway webhook recovery)
- [x] Reviewed in isolated scratch copy: patch applies, 37/37 tests pass, build passes
- [ ] Blocker: 4 typecheck errors introduced (2 exactOptionalPropertyTypes, 2 missing bun:test types)
- [ ] Migration must be applied BEFORE the code ships (recordEvent writes the new retryable column)
- Not merged, migration not applied, nothing published

## PR review round 2 (head 062eb47)
- [x] Manifest + head confirmed; patch applies clean over current HEAD (only roadmap.md overlaps)
- [x] Full typecheck / production build / 46 tests run in isolated scratch copy
- [x] Migration + concurrent-duplicate constraint verified on a disposable local Postgres (not the live DB)
- [x] Resolved (head 4569800): global bun reference replaced with a scoped `declare module "bun:test"`; full typecheck clean, 46/46 tests, production build passes in the isolated copy
- Not merged, nothing published, no events replayed

## PR review round 3 (head 4569800)
- [x] Only bun.lock / package.json / src/lib/__tests__/bun-env.d.ts changed; all other PR files byte-identical to round 2
- [x] Migration `20260828193000_...sql` APPLIED to the live database (additive columns + indexes; published receiver unaffected)
- [x] Merged (57c1b27), synced, published; duplicate migration files reconciled (ledger holds only 20260828212448; PR file idempotent, nothing rerun)
- [x] Fixture-only self-test after publish: 8/8 expected outcomes, fixture rows only, no persistence errors
- Do NOT run "Retry failed lookups" as release verification — needs separate approval


## Post-publish close-out (2026-08-28)
- [x] Published site serving release 57c1b27; webhook route reachable (GET 200)
- [x] Security scan run: 3 warn-level findings, no criticals; nothing changed or dismissed
- [x] Fixture self-test (8 outcomes) recorded with is_fixture = true, separate from live counts
- [ ] No natural Fitzgerald event has processed yet (live rows: 1283 ignored_other_property,
      9 historical verify_failed, 1 invalid; zero live `processed`). Awaiting either a real
      task update on 1473933 or approval for a controlled test.

## Beta acceptance reconciliation (Aug 28)
- Owned by Claude Code (separate branch — do NOT edit here):
  - [ ] Operations automatic assignment
  - [ ] Property/guest/owner contact population
  - [x] Handover written: assignment-rule sources + contact-source spec (.lovable/plan.md)
- Owned here (reconciliation only, no live actions):
  - [x] OwnerRez conversation/reply capability (GET+POST /v2/messages confirmed in docs)
  - [x] Breezeway dispatch/status/evidence capability (create/update task, add task photo)
  - [x] Info-mailbox communication + notification inventory
  - [x] Telegram requirement + limitation statement
  - [x] Attachment readiness (no Storage bucket, no upload code — missing)
  - [x] Active Owner guide alignment map (branded AOP package)
- Paused/unchanged: vendor portal, live sends, dispatch, external writes, automations

## Phase 1 — real file storage (Aug 29, done)
- [x] Email retry/concurrency re-verified (11 tests): claim-first + unique index, retag-only retry
- [x] Private bucket `resolve-attachments` (50 MB), documents metadata + RLS, helper moved to `private` schema
- [x] attachments.ts / attachments.server.ts / attachments.functions.ts / AttachmentsPanel; wired to ticket detail + onboarding evidence dialog
- [x] 17 unit tests + 19-check isolated end-to-end run on a temporary demo ticket (cleaned up, bucket empty)
- Still needs approval: any SharePoint *write* (new Microsoft scope) — Resolve stays the source of truth for attachments

## PR #2 review (feat/operations-assignment-contact-context)
- [ ] Isolated dry-run merge vs main; report commits/overlaps
- [ ] Reconcile typecheck discrepancy (~401 implicit-any vs clean)
- [ ] Verify auto-assignment rules vs approved SOP
- [ ] Verify guest + primary-owner contact population honesty
- [ ] Review unapplied migration + RLS; decision (merge/fix/blocked)
- [ ] Hold file-storage publish until combined Operations release

## Combined Operations release (PR #2 integration) — 2026-08-31
- [x] PR #2 patch integrated into main; attachment/owner-file/branding work preserved
- [x] Migrations re-timestamped 20260831141014 / 20260831141045 (in sequence)
- [x] Schedule-aware auto-assignment (Central, DST-safe) + exception queue
- [x] Overnight on-call roster UI (admin-managed, no default person)
- [x] General primary-owner directory from OwnerRez (read-only import)
- [ ] BLOCKER: 5 of 6 functional seats vacant — James Almario, Roms, Christine Sendico, Avy, Mike Cacatian have no Resolve profile/role
- [ ] BLOCKER: September overnight roster not yet entered
- [ ] Held: publish, mailbox polling, Breezeway automation, live intake

## Staff invitations (2026-08-31)
- [x] `tech` displays as Staff everywhere (display-only; no RLS/auth change)
- [x] Five email-bound single-use invites created (James, Romeo, Avy, Mike, Christine)
- [x] Admin "Email code" resend control in Team invite panel
- [x] Invite codes emailed from info@arealhomeaway.com (Aug 31)
- [ ] Seats stay pending until each person redeems with their exact invited email

## Property Hub / SharePoint canonical store (requested 2026-08-31) — NOT STARTED
- [ ] Phase 1: confirm OwnerRez → Resolve property identity + draft intake linking
- [ ] Phase 2: move durable file bytes from `resolve-attachments` to ARHA Resolve SharePoint Documents library
  - [ ] Report current Entra scopes, Sites.Selected grant, site/drive IDs, read vs write
  - [ ] Prepare (do NOT apply) smallest site-level write grant; approval required
  - [ ] Bucket inventory; idempotent upload + reconciliation records; proxied secure viewing
- [ ] Phase 3: Property Hub page (Overview, Details, Contacts, Onboarding, Operations, Documents & Media, Approvals, Activity) + search by name/address/owner/market/stage/external IDs
- [ ] Phase 4: read-only Notion PID inventory + full field mapping/reconciliation report; no writes, no retirement
- [ ] Phase 5: owner approval packages must carry ≥1 owner-visible file; versioned change requests
- [ ] Phase 6: Onboarding work views (My Active Projects, Needs My Attention, All Active, Awaiting Handoff, Completed)
- [ ] Phase 7: Handoff Review workspace by job title (Onboarding Dir, Ops Dir, Ops Acceptance, Live Confirmation)
- [ ] Phase 8: 5-account demo validation; report any step still needing another platform
- [ ] Hold: no tenant-wide Graph scopes, no permission change, no file moves, no Notion retirement, no publish/automation

## SharePoint architecture audit (read-only, 2026-08-31) — COMPLETE
- Findings only. No permissions changed, no files touched, no Property Hub work, nothing published.
- Site: ARHA Resolve — id `arealhomeaway.sharepoint.com,973560d0-454a-41fd-804c-659e7e460f83,67ecd2c1-b4e6-40d9-9eac-00c4b241c0bc`
- Library: "Documents" (Shared Documents) — drive id `b!0GA1l0pF_UGATGWefkYPg8HS7GfmtNlAnqwAxLJBwLwYFC_w8_PAQZ-W78Pw_f6p`; root currently empty (~1.5 MB site usage)
- Two Microsoft paths exist and disagree: app-user connector (Sites.Selected, resolve.integration@) vs workspace connection "ARHA Sharepoint Folder" (Sites.Read.All / Sites.ReadWrite.All / Files.Read.All / Sites.Manage.All, NOT linked to project)
- Required target: single app-scoped identity + Sites.Selected + one site-level write grant on /sites/ARHAResolve
- Buckets: `resolve-attachments` (private, 50MB cap, 1 object), `database_export_24_08_26` (private, 1 export)
- Properties: 162 rows, 156 with OwnerRez ids, 6 demo
- Next priority: Operations/Breezeway release readiness (Property Hub deferred)
