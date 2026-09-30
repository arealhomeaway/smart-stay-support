<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Navigation rule (Resolve V2 standing rule)
NO NEW PAGE OR FEATURE IS COMPLETE IF THE USER CANNOT NAVIGATE INTO IT AND BACK OUT OF IT WHILE PRESERVING THEIR PROPERTY/DEPARTMENT CONTEXT.
Department menus, breadcrumbs and Back come from the app shell (`src/lib/shell-nav.ts` + `src/components/nav/ShellNav.tsx`). New routes register their department/label there; pages never build their own. A page may name its current view with `useShellPageLabel`.

## Help & Feedback rule (Resolve standing rule)
Every current and future Resolve page inherits the global ? Help & Feedback control from the shared app shell (`src/components/HelpFeedback.tsx`, rendered once in `AppShell`). Never add it per page. It files Resolve Help Tickets (`help_tickets`), never Operations tickets.
- Homeowner⇄ARHA conversations live in append-only `owner_request_messages` (one thread per owner-facing request, written only via post/resolve/reopen RPCs); status is derived from the last speaker — never store it twice.
- STR cleaner-time nightly check (cron `str-cleaner-time-nightly`, 07:00/07:30/08:00/08:30 UTC): the 07:00 UTC pass is primary (2 a.m. Central in CDT; 1 a.m. in CST); the 07:30, 08:00 and 08:30 passes are retries that resume an unfinished run and are no-ops once that night's run is complete (08:00 is the 2 a.m. pass in CST). Why: resumable slices survive timeouts without duplicate work.
- STR cleaner safeguard state rule lives only in `private.cleaner_safeguard_state` / `private.cleaner_safeguard_eval` (DB); UI and RPCs display it, never recompute it. Why: one authoritative rule for dispatch, overrides and alerts.
- STR dispatch enforcement is Resolve check-before-assign (`/str-dispatch-check`, `cleaner_record_dispatch`); Breezeway-native assignments are never undone, only evaluated on ingest and alerted. Why: Breezeway writes stay allowlisted and transitional.
- Safeguard overrides are single-clean, append-only (`cleaner_safeguard_overrides`), authorized by `private.is_director` (Admin or director_ops seat). Why: permanent audit, no PC/PM/Onboarding authority.
- Safeguard re-evaluation runs from a deferred trigger on `cleaner_exposure_ledger` (any insert/supersede); alerts only on escalation into a higher state or a new inversion. Why: corrections, approvals and reassignments alert exactly like live cleans without duplicates.
- Non-owner property work reporting: `cleaner_workers` is the canonical person directory; non-cleaning sources write append-only `property_work_records` (catalog `property_work_sources`); `property_person_activity` consolidates both. Cleaner ledger stays the only safeguard input. Why: extend to new sources without rebuilding the cleaner ledger.
- User identity/access edits go only through admin-checked `updateTeammate` (src/lib/access.functions.ts), which audits every change; `profiles.full_name` is the display name, first/last are stored separately. Why: one guarded path, no duplicate accounts.
- Vendor credential expiry reminders are DB-owned (`vendor_compliance_sweep`, one row per credential/expiry/stage in `vendor_compliance_reminders`), run on the 5-minute notify pass; UI state comes from `src/lib/vendor-compliance.ts`. Why: one rule, no duplicate reminders, no new cron.
