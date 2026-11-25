# Status

Applied exactly: 0386_owner_card_history and 0387_owner_card_history_finish. Files match staged statements. Undo and nine isolated SQL practice checks retained. 62 focused regression tests passed; build log shows OK. No publish.

Live records unchanged: 203 real hour entries, fingerprint 93b93f41039726754c82c2df75c93402. Real card-answer fingerprint 1a454f07ba540451817365e0a84a5426 unchanged.

Not finished: owner-only removal awaits clarification of H9 archive-only; no removal action was added. Saving as an owner on desktop/phone was not verified. A temporary test sign-in was created but the existing demo-account gate requires a different email domain. No gate or identity was changed. Signed-in staff browser checks timed out before history verification. The full test suite was not completed.

## Files
- OwnerWorkForm.tsx (new): shared card/Add work form, Saved, Edit, Add more time and document links.
- OwnerWorkHistory.tsx (new): complete shared list, totals, duplicate notices and read-only staff view.
- OwnerPortalMenu.tsx (new): owner top menu from shell registry.
- owner_.history.tsx (new): authenticated My history page with metadata and loading/error boundaries.
- owner-work-history.ts / owner-work-history.functions.ts (new): totals/duplicate projection and authenticated calls.
- owner-card-history.test.ts / qa/owner-card-history-practice.ts (new): concrete count/duplicate tests and isolated SQL checks.
- OwnerOpportunityBoard.tsx: existing card source panels now use the one-save form; old panel code retained.
- OwnerOpportunities.tsx / OwnerTaskDialog.tsx: retain instructions and records; alternate shared form hides separate answer/time controls.
- OwnerSidebarNav.tsx: adds My history.
- OwnerTab.tsx: adds read-only shared history below the report line.
- owner.tsx: top menu, Add work form and shared card form.
- shell-nav.ts: owner-menu registry.
- hours-report.ts: email button destination is /owner/history.
- roadmap.md: scope and unfinished verification/blockers.
- Generated migration journal and types updated by the migration tool only.

Database: owner_work_saves added; save_owner_card_work and read_owner_work_history added; log_owner_time_entry's repeat guard admits transaction-local canonical save receipts only. Existing time totals and answer actions remain canonical; no review_status backfill.
