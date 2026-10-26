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

- Navigation: every page must be enterable/exitable keeping property/department context; menus, breadcrumbs, Back come only from `src/lib/shell-nav.ts` + `ShellNav` (`useShellPageLabel` names a view). Why: one shell.
- Help & Feedback: rendered once in `AppShell` (`HelpFeedback.tsx`), never per page; files `help_tickets`, never Operations tickets. Why: one entry point.
- Homeowner⇄ARHA threads: append-only `owner_request_messages` via RPCs; status derived from last speaker; explicit fresh asks only via `request_owner_response` (event `response_requested`, open until an owner answer, `openResponseRequest`). Resolving/reopening an Opportunity never changes its internal Task. Why: no double-stored state; owner participation never gates internal work.
- User identity/access edits only via audited admin `updateTeammate` (src/lib/access.functions.ts). Why: one guarded path, no duplicate accounts.
- Vendor expiry reminders: DB `vendor_compliance_sweep` (deduped in `vendor_compliance_reminders`) on the 5-minute notify pass; UI state from `src/lib/vendor-compliance.ts`. Why: one rule, no new cron.
- STR cleaner safeguard rules: see `drizzle/AGENTS.md`.
- Guided Ticket = `GuidedTicketPanel` over pure `ticketGuidance`; records only guest update/path/troubleshooting/vendor; statuses, SLA, closure gates, Work Order engine unchanged. Vendor pick re-checked by DB `vendor_dispatch_eligible`. Why: one rule, no second workflow.
- Vendor Transitional Review: temporary migration flag on `vendor_orgs` (never a lifecycle status), granted only at Notion import for Active/Last Resort, fixed 60-day window enforced by DB trigger; eligibility lives only in `vendor_dispatch_eligible`. Why: one rule, no silent Approved.
- Emergency Only vendors: `vendor_orgs.emergency_only`; picker visibility in `src/lib/emergency-vendor.ts`, enforced by DB `ticket_selected_vendor_guard` (P1 free, P2 basis, P3 Supervisor override; reason/authorizer stamped). Never coverage. Why: one rule.
- Ticket opening: in-app Ticket links open `TicketWorkspace` in the shell drawer (`src/components/nav/TicketDrawer.tsx`); the full page renders the same component. Why: one Ticket implementation, page context preserved.
- Work entry: one `NewTicketForm` offers Log Property Activity (`property_activity_log`, history-only, never a Ticket) / Ops Ticket / Maintenance (`tickets.entry_kind`); owner section relevance comes only from `ownerSectionRelevant` in `src/lib/work-entry.ts` reading `MAINTENANCE_POLICY`. Why: one form, one threshold, activity never counted as work.

- Review follow-up automation start date: `app_settings` key `review_followup_automation_start` read only via `reviewImportDecision` in `src/lib/guest-feedback.ts`; unset/missing publish date = history-only. Why: one rule, replays never create retroactive follow-ups.
- Departure Review creation and clean→reservation matching rules: see `drizzle/AGENTS.md`.
- Demo flag is re-read after hydration; pages wait for `demoReady`. Why: reloads keep demo context.
- Post-handoff onboarding visibility: Operations reads completed onboarding Tasks/findings/files only via DB `read_completed_onboarding_records` + `can_read_completed_onboarding_document` (staff-only, completed Tasks, operational file categories), rendered read-only by `CompletedOnboardingRecords`. Why: one source, no Ops writes.
- Finance expense, Property Activity file and review-identity rules: see `src/lib/AGENTS.md`.
- Vendor sourcing/dispatch/execution rules: see `src/lib/AGENTS.md`.
- Active Owner hours/enablement rules: see `drizzle/AGENTS.md`.
- Active Owner enrollment uses the existing enrollActiveOwner action and one property window; durable checkpoint RPCs compose existing canonical enrollment, closing, activation and release actions, with approval-only SQL staged outside migration history until authorized. Why: retries retain successful work without a second enrollment path or accidental shared-backend changes.

- Owner notification delivery safety is enforced by the BEFORE INSERT/UPDATE block_demo_owner_notification_delivery trigger, before the AFTER INSERT network callback; demo/test alerts remain in-app only. Why: every producer shares one pre-delivery guard.
