# Roadmap (checkpoint Oct 6 2026)

## Oct 20 — Approved release preparation (no publish, schedules, sends, or retained DB changes)
- [ ] Restore journal/file match; inspect unjournaled migration implications.
- [ ] Validate prepared SQL against real schema; execute rollback-only tests only through a supported transactional tool.
- [ ] Fix only demonstrated defects, run fresh-process suite, check automatic build, refresh forecast and ordered release/rollback list.

## Oct 20 — Email job safety repair (build/test only; no publish or schedule changes)
- [x] Block demo/test email at progress source and shared sender; isolated safety/sender tests, no provider calls.
- [x] Prepare unapplied safety/run-audit migrations and longer-wait recreation command; no shared database writes.
- [x] Restored schedule note to the existing 0150 journal tag without modifying managed metadata; unjournaled Opportunity file still requires release handling.
- [x] Full test inventory in fresh processes (1529 pass/0 fail/5 skip), automatic type/build OK, read-only forecast and release/rollback report in docs/pending/email-job-release/README.md.

## STABILIZATION — all feature work paused (Oct 6). Audit: docs/agent/stabilization-audit-2026-10-06.md
- [ ] A. Linders blocked: remove DFY gate + separate Day one from activation (awaiting Emily's go-ahead)
- [ ] B. Verify #24 with onboarding-role synthetic account; decide demo-account access to real-home files
- [ ] C. Owner return-navigation browser walk
- [ ] D. Verify #27; #25/#26 decisions

## Paused — outstanding acceptance work
- [ ] Vendor-only Ticket view (vendor currently reads every field on its assigned Ticket) + vendor browser check. Vendor test login stays disabled.
- [ ] Ops browser checks: vacant-home survey, Routine Control submission, negative-review follow-up (reporter unconfirmed).
- [ ] Own-account checks: James (Finance Lead review action — read-only inspection steps do NOT replace it), Emily (reopen with reason), Micah (accept Handoff Role QA Cottage). James/Micah demo access kept.
- [ ] Breezeway controlled test (target/owner/cleanup), KD Accounting account, vendor Telegram confirmations.
- [ ] Help #21 awaiting Kati's confirmation.

## Kati tickets #24–27
- [x] #24 homeowner file not openable — fixed in preview, awaiting publish + review notes
- [x] #27 stage titles not editable — fixed in preview (old-import plans); step drag exists further down
- [ ] #25 Needs My Attention on onboarding hub — layout decision for Emily
- [ ] #26 task view options — suggestion; Module explained

## Stabilization pass (Emily, Oct 6 20:48 UTC)
- [x] 1. Staff-led link (no invite), DFY + Day One removed, homes don't wait on others (migration 0135, UI)
- [x] 2. Per-home closing→Dec 31 windows; combined counted once (DB logging + pure helpers)
- [x] 2b. Per-home window totals on owner dashboard, PDF and CSV; CSV entry_scope Property-specific/General
- [x] 3. Closing: Director/Manager-only `correct_actual_closing` (migrations 0136–0137, live), history + audit, discrepancy shown on home panel; 3915 W 104th left unchanged for a Director/Manager
- [ ] 3b. Browser check of closing correction (Manager allowed, admin-only/onboarding refused)
- [x] 4. #27 all-or-nothing stage conversion; owner Opportunity close keeps list/filters; #25 two views; approval root cause found (template flags) — 9 real withdrawals await Emily
- [ ] 4b. Owner hour entry on demo programs is blocked by design (owners cannot log on demo programs) — decision needed for connected owner walkthrough
- [x] 5. Synthetic accounts demo-only in backend (0138–0142); 7 unused disabled; qa.um.manager Finance Lead seat removed
- [x] 6/7. Focused checks + release summary delivered Oct 6
- [ ] Browser checks on demo records (hours, #24, #25, #27, #26, owner nav) — not run; #26 built, #18–19 compared, 9 approvals listed

## Oct 7 (Emily)
- [x] Linders activation facts + wording fix (activation stores first closing/Dec 31; hours are calendar-year based)
- [x] Direct staff account creation (no invite code) for Onboarding Director
- [x] Evidence window open/download browser check (onboarding role); made window view-only
- [ ] Account-management check — Kati performing (checklist /mnt/documents/kati-preview-checklist.md)
- [x] CSV import as NEW template built + tested
- [ ] CSV template download + import save/reopen/edit — Kati performing
- [x] CSV stage order fixed (standard phase order when no saved stages)
- [x] Retired per-home closing-window helpers; report note = tagged breakdown only
- [x] Complete release contents list

## Oct 8 — Controlled Onboarding Stabilization + Plan Editor (Emily; prompt user-uploads Resolve_-_Controlled_Onboarding_Stabilization)
First group (authorized):
- [ ] Scope→component map + capability table (7 onboarding roles)
- [ ] #30 four step fields (description/instructions/done when/video) → Task + CSV
- [ ] #31 relative due dates (4 anchors, ± business days, overrides preserved)
- [ ] #40 assignment roles resolved from project team, gaps visible
- [ ] #42 conditional steps (Furnishing Package + Pool example), CSV round-trip, preview
- [ ] Active Owner setup: one-select enrollment, duplicate-safe, auto-queued welcome (#32/#38/#39 portions); Linders via supported staff action
- [ ] #38 inactive-state: no "0 days remain", no unusable Start
- [ ] Editable welcome email + optional video (Emily's draft = proposed, unreviewed); delivery status/retry/version stored
- [ ] OwnerRez search failure for 8219 — diagnose
- [ ] Sofia Alvarez account check (no duplicate)
- [ ] Kati checklist update
Next groups (ledger only, not started): #35–37, #41/#44–45, #33–34/#43 external, rest of #39
