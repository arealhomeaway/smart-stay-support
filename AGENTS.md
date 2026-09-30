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
- Homeowner⇄ARHA threads: append-only `owner_request_messages` via RPCs; status derived from last speaker. Why: no double-stored state.
- User identity/access edits only via audited admin `updateTeammate` (src/lib/access.functions.ts). Why: one guarded path, no duplicate accounts.
- Vendor expiry reminders: DB `vendor_compliance_sweep` (deduped in `vendor_compliance_reminders`) on the 5-minute notify pass; UI state from `src/lib/vendor-compliance.ts`. Why: one rule, no new cron.
- STR cleaner safeguard rules: see `drizzle/AGENTS.md`.
- Guided Ticket = `GuidedTicketPanel` over pure `ticketGuidance`; records only guest update/path/troubleshooting/vendor; statuses, SLA, closure gates, Work Order engine unchanged. Vendor pick re-checked by DB `vendor_dispatch_eligible`. Why: one rule, no second workflow.
- Vendor Transitional Review: temporary migration flag on `vendor_orgs` (never a lifecycle status), granted only at Notion import for Active/Last Resort, fixed 60-day window enforced by DB trigger; eligibility lives only in `vendor_dispatch_eligible`. Why: one rule, no silent Approved.
- Emergency Only vendors: `vendor_orgs.emergency_only`; picker visibility in `src/lib/emergency-vendor.ts`, enforced by DB `ticket_selected_vendor_guard` (P1 free, P2 basis, P3 Supervisor override; reason/authorizer stamped). Never coverage. Why: one rule.
