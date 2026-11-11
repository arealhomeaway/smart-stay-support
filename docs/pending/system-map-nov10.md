# Resolve system map (as built), Nov 10, 2026

Report only. Nothing in the app, the database or any setting was changed to make this map. Nothing was published and no OwnerRez search was run. This file is the only thing written.

How it was checked (Nov 11, 04:00 to 04:15 UTC):
- Code: every route file under `src/routes` (102 signed-in page files plus public pages and 11 public hook routes), the server function modules in `src/lib`, `src/lib/shell-nav.ts`, `src/lib/route-access.ts`, `src/lib/feature-flags.ts`.
- Database: read-only queries for row counts of all 266 tables in `public`, every switch in `feature_flags`, the keys in `app_settings`, live function and trigger definitions, and recent run records.
- Scheduled jobs: the platform schedule list (16 jobs). Run history for those jobs is not readable; "last run" below comes from the records each job writes, and is marked Not verified where no such record exists.
- There is no `supabase/functions` folder. The app has no edge functions; all background work is TanStack routes under `src/routes/api/public/` or database functions.

Row counts are raw counts on Nov 11 at 04:00 UTC and include demo and test rows unless a split is given.

---

## 0. Findings that matter most (read first)

1. **The "Homeowner alerts" switch (`owner_alerts`, Off) controls nothing.** It is declared in `src/lib/feature-flags.ts:23` but no code and no database function reads it. Homeowner emails are controlled per program by `owner_programs.notify_email`. In the last 7 days 27 real homeowner emails were marked sent; 8 of them went to the 9211 Fitzgerald Dr / 3915 W 104th St S program. My smoke test reply said "homeowner alerts stay off"; that was too broad. Emails do go out today.
2. **The legacy Active Owner tables are still read and written.** `owner_task_templates` (32 rows) and `owner_opportunity_library` (8 rows) are read by `src/lib/after-handoff.functions.ts:35-36,94-95`, `src/lib/ao-data.ts:167` and `owner-program.server.ts`; `owner_opportunity_library` is written by `src/lib/opportunity-library.functions.ts:85-110` (the Optional Library at `/owner-library`). The project rule says they are "legacy and not used". Code says otherwise.
3. **The Automated homeowner plan switch only works on a program's primary home.** `ao_set_home_automation` requires `owner_programs.property_id` to equal the home. 3915 W 104th St S is a second home in a live program, so the switch refuses it ("This home has no active Active Owner program").
4. **Turning on the Automated plan for 9211 Fitzgerald Dr today would email the owner about 27 times.** Each open card creates an owner item waiting on the owner, and the existing owner item trigger queues one email per item when `notify_email` is on (it is on for this program). Details in 4b and 4c.
5. **Breezeway safety sweep (job 22) is active every 10 minutes** against `/api/public/hooks/breezeway-mirror`. In the preview code it does nothing while the bridge is off. The published Nov 6 code answers the same address and refreshes work orders (5,245 rows, newest copy 03:40 UTC). Which version answers it today is Not verified.
6. **`breezeway_outbound` is On.** The bridge, onboarding send and internal work orders are Off, but ticket sends to Breezeway are governed by this switch plus the verified-home and dispatch guards. Do not describe "all Breezeway sending" as off.

---

## 1. Systems

Each system lists: purpose; tables (rows); pages; server functions; scheduled jobs; switches; integrations. `A/` = `src/routes/_authenticated/`, `L/` = `src/lib/`.

### 1.1 Tickets and Team Queue
- Purpose: every guest and home issue as one Ticket with an owner, clock, next step and closure rules.
- Tables: `tickets` 92 (90 real, 2 demo), `ticket_activity` 266, `ticket_state_log` 2, `ticket_steps` 0, `ticket_visits` 0, `ticket_timed_alerts` 0, `ticket_owner_updates` 0, `ticket_troubleshooting_answers` 0, `troubleshooting_guides` 10, `troubleshooting_guide_steps` 30, `work_types` 22, `routine_controls` 50, `routine_check_corrections` 0, `shift_end_records` 0, `special_handling` 0, `escalations` 0, `evidence_items`/`evidence_events`/`evidence_requirements` 0, `staff_notifications` 475, `coach_sessions` 9, `audit_log` 2,832.
- Pages: `/dashboard` (Home), `/team-queue`, `/tickets/$ticketId` (also opens in the shell drawer), `/tickets/new`, `/tickets` (old My Work, off menu), `/routines`, `/oversight`, `/supervisor-check`, `/coach` (Ask the Coach, AI).
- Server functions: `ticket-lifecycle`, `ticket-current-action`, `ticket-priority`, `ticket-reopen`, `queue-bulk`, `ticket-owner-updates`, `coach`, `escalation`, `guidance`, `evidence`, `evidence-slots`, `final-review`, `record-work`, `record-routine` (`L/*.functions.ts`).
- Jobs: `ticket-timed-alerts` every minute, active (no run record table with rows; `ticket_timed_alerts` is 0, last run Not verified). `team-queue-alert-email` hook is called by a database trigger on `staff_notifications`.
- Switches: `operations_queue_v2` On; six checklist switches Off (`checklist_lockout`, `_cleaning`, `_maintenance`, `_other_complaint`, `_damage`, `_booking`); `survey_review_check` Off; `internal_work_orders` Off.
- Integrations: Lovable AI (Coach), OwnerRez (reservation on a ticket), Breezeway (linked work order), Microsoft 365 email.

### 1.2 Direct Bookings and leads
- Purpose: direct booking requests from partners, home search, owner approval and partner reply.
- Tables: `leads` 2, `lead_activity` 3, `lead_properties` 1, `lead_tickets` 0, `direct_booking_approvals` 1, `inquiry_sources` 18, `email_templates` 9.
- Pages: `/direct-bookings`, `/direct-bookings/$requestId`, `/direct-bookings/settings`, `/inquiry-sources`; old `/leads` (index, new, manager, my-leads, pipeline) and `/availability-finder`, both still reachable.
- Server functions: `L/direct-bookings.functions.ts` (19 functions), `direct-bookings-mail.server.ts`, `availability-finder.functions.ts`, `lead-offers.functions.ts`, `outlook-lead.server.ts`.
- Jobs: `direct-booking-approval-escalation` every 20 seconds, active (last run Not verified).
- Switches: none of its own. Settings: `app_settings.direct_booking_settings`.
- Integrations: OwnerRez (availability, listings), PriceLabs, Google Maps, Microsoft 365 email.

### 1.3 Databases hub
- Purpose: one place to open each record set (Properties, Owners, Vendors, Tickets, Claims, Bonus payouts and others).
- Tables: none of its own; reads the tables of each card.
- Pages: `/databases`, `/databases/$key`. Catalog in `L/databases.ts:57-249` (22 cards: properties, house-items, owners, vendors, utilities, inventory, onboarding-projects, assessments, handoffs, budgets, inspections, tickets, departure-reviews, arrival-readiness, reviews, claims, vendor-invoices, direct-bookings, referral-sources, bonus-payouts, playbooks, team).
- Server functions: browser reads under RLS through `L/databases-data.ts`; one write RPC `databases_save_claim_or_refund`.
- Jobs: none. Switches: `claims_menu` Off, `imported_tickets_page` Off, `work_orders_page` Off affect related menus.

### 1.4 Properties and the property page (was the PID)
- Purpose: one page per home with facts, owners, files, logins, tickets, onboarding and Active Owner.
- Tables: `properties` 167 (161 real, 6 demo), `property_owners` 128, `property_owner_contacts` 1, `property_field_provenance` 13,266, `property_external_links` 473, `property_credentials` 730, `credential_access_log` 13, `credential_intake_queue` 1, `property_label_assignments` 26, `property_labels` 1, `property_label_events` 27, `property_activity_log` 0, `property_profile_edits` 0, `property_profile_photos` 0, `property_assets` 0, `property_fact_proposals` 0, `field_conflicts` 34, `external_links` 156, `marketing_photo_downloads` 0, `marketing_photo_notices` 0.
- Pages: `/properties`, `/property/$propertyId`, `/map` (Work Map, off menu). Public: `/api/public/marketing-photos/$token`.
- Server functions: `property-hub`, `property-intake`, `property-facts`, `property-enrichment`, `marketing-photos`, `geo`, `credentials`, `owner-directory`.
- Jobs: nightly property info and photo refresh at 3 AM Central runs inside the five-minute `deliver-owner-alerts` job (only in the preview code; the published Nov 6 version does not have it).
- Switches: `work_map` Off. Integrations: OwnerRez, Google Maps.

### 1.5 Onboarding
- Purpose: turn a new home into a guest-ready home through a template plan of Tasks, then hand it to Operations.
- Tables: `onboarding_projects` 11 (7 real, 4 demo), `onboarding_tasks` 1,751, `onboarding_task_stage_history` 1,391, `onboarding_flag_snapshots` 1,515, `onboarding_project_events` 20, `onboarding_notes` 4, `onboarding_templates` 9, `onboarding_template_versions` 6, `onboarding_template_stages` 17, `onboarding_template_tasks` 617, `onboarding_step_review_settings` 1, `onboarding_task_reviews` 1, `onboarding_task_review_events` 1, `onboarding_task_review_decisions` 0, `onboarding_task_file_links` 0, `onboarding_task_breezeway_links` 0, `onboarding_task_breezeway_events` 0, `onboarding_budgets` 8, `onboarding_budget_lines` 0, `onboarding_follows` 0, `handoff_requirements` 50, `handoff_link_suggestions` 26, `home_handoff_decisions` 0, `handoff_carryovers` 0, `handoff_reminders` 0, `handoff_reviews` 0, `handoff_standard_history` 0, `handoff_step_history` 0, `property_handoffs` 0, `handoffs` 0 (ticket handoffs), `approvals` 15, `documents` 439, `staff_review_preferences` 2.
- Pages: `/onboarding` (Onboarding Home, `?lens=all` for All properties), `/onboarding/$propertyId` (seven tabs), `/onboarding/my-work`, `/onboarding/owner-completions`, `/onboarding/team`, `/onboarding/templates`, `/onboarding/handoff-standard`, `/handoffs`. Redirect only: `/onboarding/properties`, `/onboarding/transitions`, `/onboarding/utilities`.
- Server functions: `onboarding`, `onboarding-template-admin`, `v2-workflow` (template v2, bulk edit, publish version), `plan-csv`, `step-file-links`, `onboarding-team`, `onboarding-accounts`, `onboarding-reviews`, `onboarding-stage`, `onboarding-details`, `onboarding-cleanup`, `onboarding-kati` (bulk complete, Breezeway section), `onboarding-work-orders`, `onboarding-delivery`, `completed-onboarding`, `handoff-standard`, `handoffs-overview`, `onboarding-budget`, `onboarding-finance`.
- Jobs: `handoff-reminders` 8 AM and 9 AM Central, active (`handoff_reminders` 0 rows; last run Not verified). Review overdue checks run inside `deliver-owner-alerts`.
- Switches: `onboarding_portal_v2` On, `onboarding_breezeway_send` Off, `onboarding_external_sync` Off, `onboarding_sharepoint_docs` Off.
- Integrations: SharePoint, Breezeway (manual link only), Microsoft 365 email.
- Standard plan v5 is staged and not applied to existing homes.

### 1.6 Active Owner
- Purpose: homeowner co-host collaboration: cards and Opportunities, approvals, conversations, hours.
- Tables, live card engine: `ao_library_cards` 57 (55 released, 2 draft: A15, A41), `ao_library_card_history` 121, `ao_home_plan_cards` 0, `ao_home_plan_settings` 0, `ao_home_plan_settings_history` 0, `ao_contributions` 0, `ao_card_item_map` 24, `ao_card_step_link_suggestions` 26, `ao_dedupe_events` 27, `ao_one_off_confirmations` 0, `ao_business_holidays` 0.
- Tables, programs and owner work: `owner_programs` 8 (5 real, 3 demo), `owner_program_properties` 11, `program_members` 6, `owner_program_events` 256, `owner_program_rules` 6, `active_owner_enrollment_runs` 3, `owner_reviews` 187, `owner_review_properties` 137, `owner_request_messages` 129, `owner_time_entries` 129, `owner_time_entry_properties` 120, `owner_notifications` 167, `owner_alert_log` 45, `owner_contact_alerts` 14, `owner_badges` 14, `owner_completion_reviews` 67, `owner_followup_tasks` 5, `owner_welcome_messages` 3, `owner_invites` 2, `owner_invite_redemptions` 2, `owner_approval_publications` 1, `owner_approval_receipts` 1, `owner_library_videos` 1, `work_items` 1,878 (1,498 real, 380 demo), `work_item_resources` 285, `after_handoff_plan_items` 0, `after_handoff_schedule` 0, `report_wording_versions` 1, `report_wording_uses` 1, `report_legacy_card_map` 0, `str_participation_reports` 0.
- Tables, legacy but still used: `owner_task_templates` 32, `owner_opportunity_library` 8 (see 0.2 and section 2).
- Pages, staff: `/owner-programs`, `/owner-oversight`, `/homeowners`, `/owner-analytics`, `/owner-library`, `/owner-handoff-plan`, `/active-owner-followup`, `/owner-card-library`, `/owner-contributions`, `/owner-report-wording`; the Active Owner panel on the property page; Send to Active Owner in the onboarding Task drawer.
- Pages, owner portal: `/owner` (dashboard, Opportunities, Files, Team), `/join`, `/welcome`, `/welcome-video`.
- Server functions: `owner-program`, `owner-portal`, `owner-onboarding`, `owner-contacts`, `owner-conversation`, `owner-approval`, `co-owners`, `owner-evidence`, `after-handoff`, `opportunity-library`, `library-video`, `owner-welcome`; card engine RPCs `ao_set_home_automation`, `ao_preview_home_automation`, `ao_owner_plan`, `ao_unlock_now`, `ao_process_clocks`, `ao_submit_card`, `ao_card_save`.
- Jobs: `deliver-owner-alerts` every 5 minutes, active; it sends owner and staff emails, runs card clocks (`ao_process_clocks`), welcomes, review overdue checks and OwnerRez jobs. Last run: `email_job_runs` newest Nov 11 04:00 UTC.
- Switches: `owner_alerts` Off but read nowhere (0.1). Per home: Automated homeowner plan, 0 homes on.
- Integrations: Microsoft 365 email.

### 1.7 Vendors and vendor portal
- Purpose: vendor directory, compliance, coverage, dispatch and private vendor scores.
- Tables: `vendor_orgs` 77 (76 real, 1 demo), `vendor_market_coverage` 103, `vendor_markets` 6, `vendor_service_categories` 19, `vendor_import_batches` 1, `vendor_import_rows` 268, `gatekeeper_requirements` 16; all of these are 0: `vendor_contacts`, `vendor_documents`, `vendor_service_areas`, `vendor_status_events`, `vendor_job_ratings`, `vendor_org_members`, `vendor_attestations`, `vendor_gatekeeper_results`, `vendor_compliance_reminders`, `vendor_transitional_reminders`, `vendor_sourcing_requests`, `vendor_saved_views`, `vendor_custom_fields`, `vendor_field_audit`, `property_vendor_coverage`.
- Pages: `/vendors`, `/vendors/$vendorId` (opened from Databases; not in the left menu); vendor portal `/vendor`, `/vendor/$ticketId`, `/vendor/scorecard`.
- Server functions: `vendors`, `vendor`, `vendor-coverage`, `vendor-email`, `vendor-sourcing`, `scorecard`.
- Jobs: vendor expiry sweep inside `deliver-owner-alerts`. Switches: `vendor_portal` Off.

### 1.8 Breezeway
- Purpose: copy of Breezeway work orders on tickets and homes; later a bridge that turns Breezeway issues into tickets; guarded outbound sends.
- Tables: `breezeway_work_orders` 5,245, `breezeway_work_order_comments` 924, `breezeway_work_order_photos` 27, `breezeway_webhook_events` 44,398, `breezeway_webhook_subscriptions` 1, `breezeway_people` 143, `breezeway_outbound_tasks` 0, `breezeway_bridge_records` 0, `breezeway_home_tags` 0, `breezeway_sending_settings` 0, `breezeway_sending_history` 0, `integration_tokens` 1.
- Pages: no page of its own; panels on `/integrations`, tickets, the property page and onboarding Tasks.
- Routes: `/api/public/hooks/breezeway-mirror`, `/api/public/hooks/breezeway/$token` (webhook), `/api/public/hooks/cleaner-hours-reconcile`.
- Server functions: `breezeway`, `breezeway-bridge`, `breezeway-workorders`, `breezeway-outbound`, `breezeway-sending`, `sync-review`.
- Jobs: `breezeway-safety-sweep` every 10 minutes, active (0.5). Last webhook event Nov 11 03:40 UTC.
- Switches: `breezeway_bridge` Off, `breezeway_outbound` On, `onboarding_breezeway_send` Off, `internal_work_orders` Off.

### 1.9 OwnerRez
- Purpose: homes, owners, photos, bookings and guest reviews from OwnerRez.
- Tables: writes into `properties`, `property_owners`, `property_field_provenance`, `guest_feedback` 471, `guest_feedback_events` 484, `arrival_reservations` 1, `integration_events` (157 booking events, newest Nov 11 03:45 UTC; 6 review events, newest Nov 10 08:00 UTC).
- Pages: none of its own. Server functions: `ownerrez`, `property-intake`, `property-enrichment`, `guest-feedback`, `review-sync.server`, `guest-touch-base.server`, `reservation-snapshot.server`.
- Jobs: inside `deliver-owner-alerts`: reviews nightly 2 AM Central, Guest Touch Base hourly, property refresh nightly 3 AM Central (preview code only).
- Settings: `review_followup_automation_start` (undated reviews are history only).

### 1.10 Email intake and Microsoft 365
- Purpose: turn info inbox mail into tickets or leads; send all app email; SharePoint files.
- Tables: `integration_events` (outlook_inbox 13,167, newest Sep 2; outlook_subscription 5, newest Sep 1), `email_log` 588, `email_job_runs` 6,136, `app_user_connections` 1.
- Routes: `/api/public/intake/email`, `/api/public/sync/mailbox`, `/api/public/hooks/outlook/messages`, `/oauth/sharepoint/return`. Page: panels on `/integrations`.
- Server functions: `mailbox`, `email-intake.server`, `intake.server`, `outlook-subscription.server`, `email`, `email-composer`, `sharepoint`.
- Jobs: `resolve-mailbox-sync` every minute, inactive.
- Switches: `email_intake` Off.

### 1.11 Notion import
- Purpose: one time import of old Notion tickets, homes and vendors.
- Tables: writes `tickets`, `external_databases` 3, `external_records` 0, `vendor_import_rows`; `integration_events` notion_ticket_import 32, newest Nov 9 17:02 UTC.
- Pages: `/integrations/notion-import`, `/imported-tickets` (old list, off menu).
- Server functions: `notion-import` (status, check, start, batch, stop, resume, retries), `notion-reopen`, `inbound`.
- Jobs: none. Runs only from the Admin button. State in `app_settings.notion_import_runner` (last job done Nov 9). Switch: none.

### 1.12 Backups and nightly export
- Purpose: nightly backup, full backup and the resumable nightly export to SharePoint.
- Tables: `backup_runs` 10 (newest Nov 10 08:00 UTC), `full_backups` 8 (newest Nov 10 04:49 UTC), `backup_file_copies` 0, `backup_export_alerts` 0.
- Pages: `/export-check`, backup panels on `/integrations`. Route: `/api/public/hooks/nightly-backup`.
- Jobs: `nightly-backup-0700utc` and `-0800utc` daily, active; `nightly-export-continue` every 10 minutes 7 to 10 UTC, active; `nightly-export-missed-check` 10:15 and 11:15 UTC, active.
- Settings: `nightly_export_settings`.

### 1.13 Alerts and notifications
- Purpose: staff alerts in app and by email, homeowner emails, timed ticket alerts.
- Tables: `staff_notifications` 475, `owner_notifications` 167 (150 sent, 9 skipped demo, 8 skipped real), `user_notification_preferences` 0, `email_log` 588, `owner_alert_log` 45.
- Pages: `/notifications`, email preferences in `/account`. Routes: `/api/public/hooks/owner-notify`, `/owner-notification-email`, `/team-queue-alert-email`.
- Jobs: `deliver-owner-alerts` every 5 minutes; `ticket-timed-alerts` every minute.
- Switches: `owner_alerts` Off, not read (0.1). Settings: `team_queue_timing`, `owner_oversight_alerts`, `owner_email_copy`.
- No text message provider exists; texting is by people.

### 1.14 Scorecard capture, bonus engine and trackers
- Purpose: add-only facts for the scorecards, the bonus engine, and the three manual trackers.
- Tables: `scorecard_records` 1, `bonus_plans` 3, `bonus_goals` 16, `bonus_goal_thresholds` 3, `bonus_participants` 5, `bonus_period_amounts` 2, `bonus_periods` 0, `bonus_priorities` 0, `bonus_manual_measures` 0, `bonus_adjustments` 0, `bonus_questions` 0, `bonus_period_history` 0, `bonus_settings_history` 0, `team_record_draws` 0, `team_record_check_picks` 0, `weekly_scorecard_drafts` 0, `metric_definitions` 0, `cleaning_reviews` 3.
- Pages: `/my-scorecard` (My bonus), `/bonus-verify`, `/bonus-settings`, `/team-records`, `/coaching`, `/weekly-scorecard`.
- Server functions: `scorecard-capture`, `scorecard`; bonus and tracker writes are database RPCs.
- Jobs: `bonus-periods` hourly at :17, active (first periods open Dec 1; 0 periods today); `team-records-draw` Mondays 11:05 and 12:05 UTC, active (first draw Mon Nov 16; 0 draws today).
- Switches: `arrival_ready_button` Off, `finance_packet_button` Off. Settings: `guest_rating_channels`, `coaching_settings`, `team_records_settings`, `weekly_scorecard_settings`.

### 1.15 Analytics
- Pages: `/analytics`, `/ops-analytics`, `/owner-analytics`, `/command-center`, `/finance`. Server functions: `ops-analytics`, `owner-analytics`, `command-center`. Tables: reads only. Jobs and switches: none.

### 1.16 Help tickets
- Tables: `help_tickets` 67, `help_ticket_events` 83. Page: `/help-tickets`; the ? control in the shell. Server functions: `help-feedback`, `help-ticket-response`, `help-ticket-bulk`. Setting: `help_feedback_recipient`.

### 1.17 Admin pages
- Pages: `/integrations`, `/audit`, `/oversight-access-log`, `/imported-tickets`, `/integrations/notion-import`, `/export-check`, `/bonus-settings`, `/demo`. Tables: `audit_log` 2,832, `feature_flags` 27, `app_settings` 20, `demo_environment` 0.

### 1.18 Users, roles and access
- Tables: `profiles` 17, `user_roles` 18, `functional_roles` 24, `functional_role_members` 8, `departments` 8, `department_members` 0, `team_invites` 20, `program_members` 6.
- Pages: `/auth`, `/reset-password`, `/awaiting-access`, `/join`, `/hub`, `/account`, `/team` (people part), `/demo`.
- Server functions: `access` (`updateTeammate`), `account`, `team-invites`, `user-removal`, `act-as`. Rules: `L/route-access.ts`, `L/permissions.ts`. View as and Act as are different paths.
- Settings: `test_account_ids`.

### 1.19 Claims and refunds
- Tables: `claims` 36 (all real), `claim_activity` 0, `claim_waivers` 0, `guest_recovery` 0, `guest_recovery_activity` 0, `expense_recoveries` 0.
- Pages: `/claims` (index, manager, my-claims, closed), `/recovery` (index, manager, my-recoveries), Databases Claims card. Switch: `claims_menu` Off (hides the menu only).

### 1.20 Playbooks, ticket checklists and SOP upload
- Tables: `playbooks` 35, `playbook_steps` 114, `playbook_approvals` 0, `sop_playbooks` 0, `sop_versions` 0.
- Pages: `/playbooks`, `/ticket-checklists`. Server functions: `playbook-editing`, `sop-upload`, `sop-ai.server`. Switches: the six checklist switches (Off). Integrations: SharePoint, Lovable AI.

### 1.21 Team and Coverage
- Tables: `coverage_config` 1, `coverage_shifts` 29, `coverage_overrides` 1, `coverage_triage_windows` 8, `oncall_roster` 37, `time_off_requests` 0.
- Page: `/team`. Server functions: `coverage-admin`. Settings: `oncall_weekday_pattern`, `schedule_grid_seats`, `time_off_requests_start`.

### 1.22 Arrival checks
- Tables: `arrival_checks` 1, `arrival_reservations` 1, `arrival_check_state` 1 (last run Nov 11 04:03 UTC, switch off, 0 created).
- Pages: Arrival readiness card in Databases; panel on tickets. Job: `arrival-checks` every minute, active, does nothing while Off. Switch: `arrival_checks` Off.

### 1.23 Other systems found (not in the requested list)
- Departure Review and cleaning: `departure_reviews` 3, `departure_review_events` 21, `departure_clean_matches` 0; Databases card.
- Quarterly reviews: `/quarterly`, `cleaning_regions` 6; job `quarterly-inspection-scheduler` inactive; switches `quarterly_reviews` Off, `quarterly_scheduler` Off.
- STR cleaner safeguard: `/cleaner-hours`, `/str-dispatch-check`, `/str-participation-report`; `cleaner_*` tables (snapshots 115, task state 48, sync runs 43, newest Nov 10 07:00 UTC); jobs `str-cleaner-time-nightly` and `str-cleaner-time-weekly-digest`, both active.
- Guest surveys: public `/guest-feedback`, `/guest-feedback/$token`; `guest_survey_responses` 5.
- Finance and expenses: `/finance`; `expenses` 0, `financial_requests` 0, `utility_accounts` 0, `utility_costs` 0, `statement_reconciliations` 0.
- Internal work orders: `/work-orders` pages; `work_orders` 0 and all `work_order_*` tables 0; `work_projects` 0; `property_work_records` 0, `property_work_sources` 8.

---

## 2. Legacy and duplicates

"Still used" means code or links reach it today. Nothing here is a delete recommendation.

| Item | What replaced it | Still used? |
|---|---|---|
| `owner_task_templates` (32) | `ao_library_cards` | Yes: read by `after-handoff.functions.ts`, `ao-data.ts:167`, `owner-program.server.ts` |
| `owner_opportunity_library` (8) | `ao_library_cards` | Yes: read and written by the Optional Library (`/owner-library`, `opportunity-library.functions.ts`) |
| `after-handoff.functions.ts`, `/owner-handoff-plan`, `/active-owner-followup` | Card engine | Yes; mixes old tables, cards and `work_items`. `after_handoff_*` tables are all 0 |
| `/tickets` (My Work) | Home `/dashboard` | Off menu, page still loads |
| `/leads` and children | `/direct-bookings` | Reachable; menu falls back to it for some users |
| `/availability-finder` and its functions | Direct Bookings search | Reachable off menu (Build 17 finding 4 fixed the duplicate lead there) |
| `/work-orders` pages and `work_orders` tables | Breezeway work orders | Hidden by `work_orders_page` Off; 0 rows |
| `/map` Work Map | Properties and Team Queue maps | Hidden by `work_map` Off; `JobMap` component still used by Team Queue |
| `/imported-tickets` and the Integrations imported list | Databases, Tickets | Hidden by `imported_tickets_page` Off |
| `/onboarding/properties`, `/onboarding/transitions`, `/onboarding/utilities` | `/onboarding` | Redirects only |
| `/handoffs` | Onboarding handoff tab | Used by roles without the onboarding workspace |
| `/command-center` | Analytics | Still an Analytics target |
| `/claims`, `/recovery` pages | Databases Claims card | Menu hidden by `claims_menu` Off; pages load |
| Ready for arrival and Finance packet buttons | Arrival checks; Finance packet retired | Hidden by Off switches; their functions remain |
| `handoffs` table (0) | `property_handoffs` (0) and onboarding handoff state | Both 0 rows; ticket handoff UI (`HandoffPanel`) still in use |
| `report_legacy_card_map` (0) | Card engine | Empty |
| `resolve-mailbox-sync`, `quarterly-inspection-scheduler` jobs | Paused features | Inactive |
| Nightly backup, full backup, nightly export | Three separate modules | All used; overlap not reviewed |
| `owner_alerts` switch | `owner_programs.notify_email` | Declared, read nowhere |

---

## 3. In the app but not in the register

Checked against every line of `docs/decision-register.md` (H, A, M, T, C, D, N, S, B, P, O, K, E, BN). Most of these were built before Nov 7.

- Systems: STR cleaner safeguard and participation reports; the Active Owner card engine (automated plan, card library, de-duplication, owner report wording); after-handoff owner plan; Optional Library and videos; Ask the Coach and the welcome and training screens; owner participation analytics; credentials (logins) with access log; property field provenance and conflicts; marketing photos; owner completion reviews, follow-ups and welcome messages; troubleshooting guides; guest surveys.
- Pages: `/auth`, `/reset-password`, `/awaiting-access`, `/hub`, `/welcome`, `/welcome-video`, `/coach`, `/audit`, `/oversight-access-log`, `/cleaner-hours`, `/str-dispatch-check`, `/str-participation-report`, `/owner-analytics`, `/owner-library`, `/owner-handoff-plan`, `/active-owner-followup`, `/owner-card-library`, `/owner-contributions`, `/owner-report-wording`, `/onboarding/owner-completions`; public routes for marketing photos, cleaner reconciliation, owner notify and owner notification email; the retired onboarding redirects.
- Switches: `owner_alerts`, `operations_queue_v2`, `onboarding_portal_v2`, `onboarding_sharepoint_docs`, and the six checklist switches by name.
- Tables: all `cleaner_*`, `after_handoff_*`, `ao_*`, `report_*`, `marketing_photo_*`, `owner_library_videos`, `owner_completion_reviews`, `owner_followup_tasks`, `owner_welcome_messages`, `owner_request_messages`, `owner_contact_alerts`, `owner_badges`, `staff_review_preferences`, `troubleshooting_*`, `external_records`, `field_conflicts`, `property_field_provenance`, `credential_intake_queue`, `coach_sessions`.
- Register notes: there is no K1; T16 and T17 explain the reused T8 and T9; the heading says Nov 8 but lines run to Nov 11.

---

## 4. Active Owner question: 9211 Fitzgerald Dr and 3915 W 104th St S

Facts checked: both homes are real (not demo), both are in one live program (status active, not demo, `notify_email` on). The program's primary home is 9211 Fitzgerald Dr; 3915 W 104th St S is the second home. Neither home has a row in `ao_home_plan_settings` or `ao_home_plan_cards`. Both onboarding projects are in progress with no handoff accepted; their closing dates (Sep 22 and Sep 23) have passed, so the engine puts both at the "launch" stage.

### 4a. What staff do today to put cards in front of these owners
- There is **no screen to pick a chosen set of cards** for a home. The only path that creates cards is the Automated homeowner plan, and it adds every released card that fits the home's stage.
- Steps, Admin or Director of Onboarding only: Properties, open the home, Active Owner panel, Automated homeowner plan, see the preview counts, press Confirm (`src/components/ao/HomeAutomation.tsx`, RPC `ao_set_home_automation`).
- For 9211 Fitzgerald Dr this works. For 3915 W 104th St S it is refused because it is not the program's primary home.
- To limit which cards go out, the only control is the card library (`/owner-card-library`): a card set back to draft is left out for every home, not just these.
- Unlock now only opens a card that is already on a home's plan, so it does nothing here.
- Send to Active Owner (onboarding Task drawer) is a different path: it sends one onboarding approval (`approvals` and `owner_approval_publications`), shown under Your approvals. It does not create cards.

### 4b. What the automated setting does
- Turning it on records who and when, then for each released card works out one result: open, locked (waits on a linked onboarding step), already covered, or skipped because its stage has passed. It creates one owner item (`owner_reviews`) and one plan card per open or locked card.
- Open cards start their clock at once: deadline at 5 PM Central after the card's business or calendar days. Cards that are not flexible also get one reminder (5 PM, one business day before) and a cutoff (9 AM, business days after the deadline), after which ARHA takes it over.
- Locked cards open by themselves when the linked onboarding Task is completed.
- **Email: yes.** Every open card's owner item is created waiting on the owner, and the trigger `notify_owner_of_review` then queues one email per item when `notify_email` is on. The automation does not use the batch summary. The five-minute job sends one email per row (`L/owner-notify.server.ts:100-140`). The reminder step in `ao_process_clocks` also queues owner emails. The `owner_alerts` switch does not stop any of this.
- Turning it off stops the clocks; Not verified whether it removes cards already shown.

### 4c. What each home would get if staff turned it on today (simulated read only, not done)
Of 55 released cards: **27 open, 11 locked, 17 skipped (stage passed), 0 already covered.** No card's linked step matched these homes' Tasks, so locked cards would stay locked until someone uses Unlock now. The same result applies to both homes, but only 9211 Fitzgerald Dr can actually be turned on.

Open (27), deadlines if turned on Wed Nov 11 (Nov 11 counts as a business day because the holidays table is empty):
- N01, N03, N05 to N08, N11 to N14, P11, P17, P18: flexible, due Wed Nov 18, 5 PM; no reminder or cutoff.
- N04: flexible, due Sat Nov 21, 5 PM.
- N09: flexible, no deadline.
- P05, P09, P10, P16: flexible, due Wed Nov 18, 5 PM.
- P07, P12, P13, P14, P19: launch, due Wed Nov 18, 5 PM; reminder Tue Nov 17, 5 PM; cutoff Thu Nov 19, 9 AM.
- P08, P15: launch, due Mon Nov 16, 5 PM; reminder Fri Nov 13, 5 PM; cutoff Tue Nov 17, 9 AM.
- P20: launch, due Wed Nov 18, 5 PM; reminder Tue Nov 17, 5 PM; cutoff Thu Nov 19, 9 AM.

Locked (11): A14, A31, A33, A35, A51, A52, A56, A59, N02, N10, P21.

Skipped, stage passed (17): A03, A22, A24, A25, A26, A27, A28, A30, A39, A40, A57, A58, P01, P02, P03, P04, P06.

Note: the preview step removes duplicates of the same Task, but the turn on step does not, so the two can differ. Card titles are in `ao_library_cards`.

### 4d. How the owner portal shows cards today
- Cards appear in one flat list, "Your homeowner plan", inside the Your approvals section of `/owner`, in code order (`src/components/owner/OwnerPlanCards.tsx`). The list is hidden when a home has no cards.
- Other owner items are grouped by home under Your approvals; the Opportunities view has filters Needs Your Attention, Awaiting Your Response, Feedback Sent, New.
- The library has three card groups (Guide activity 22, Guide project 21, New project 14), and they are not shown to owners.
- **It does not match the five groups.** None of "Home care and records", "Guest experience and local market", "Booking sources and community connections", "Launch marketing and social media" or "After your homes go live" exists anywhere in the code.

### 4e. Can Victor see any card today?
- **No cards:** there are 0 plan cards, so "Your homeowner plan" is hidden.
- He does see other items for this program: 54 owner items waiting on him, 1 answered, 4 closed; 1 open Opportunity, 46 complete, 12 archived; 1 published onboarding approval. He was emailed 8 times in the last 7 days.
- Not verified in a browser as his account.

---

## 5. Source of truth per system

| System | Source of truth | Views, copies or caches |
|---|---|---|
| Tickets | `tickets`, `ticket_activity` | Team Queue, Home and Databases are views; `ticket_state_log` is history |
| Direct Bookings | `leads`, `direct_booking_approvals` | Old Leads pages read the same rows |
| Properties | `properties`, `property_owners` | `property_field_provenance` records where each fact came from; OwnerRez is the upstream for imported fields |
| Onboarding | `onboarding_projects`, `onboarding_tasks`, template tables and versions | Stage history and flag snapshots are history |
| Handoff | `handoff_requirements`, `home_handoff_decisions`, project handoff state | `property_handoffs`, `handoffs` are 0 |
| Active Owner cards | `ao_library_cards`, `ao_home_plan_cards`, `ao_home_plan_settings` | The owner item for each card lives in `owner_reviews`; `ao_owner_plan` is the portal view |
| Active Owner work | `owner_programs`, `program_members`, `owner_reviews`, `work_items`, `owner_request_messages`, `owner_time_entries` | Analytics and reports are views |
| Breezeway | Breezeway itself | `breezeway_work_orders`, comments and photos are copies; webhook events are a log |
| OwnerRez | OwnerRez itself | `guest_feedback`, `arrival_reservations` and property facts are copies |
| Vendors | `vendor_orgs` and coverage tables | Scores are computed |
| Bonus | `bonus_plans`, `bonus_goals`, thresholds, amounts, periods; facts in `scorecard_records` and tracker tables | My bonus and Finance payouts are views |
| Switches and settings | `feature_flags`, `app_settings` | `src/lib/feature-flags.ts` lists names only |
| Users | `profiles`, `user_roles`, `functional_role_members` | Sign-in accounts live in the managed auth service |
| Files | `documents` plus storage | SharePoint is the master for SOPs and export copies |

---

## 6. Not verified
- Last run of every scheduled job that writes no record (`ticket-timed-alerts`, `direct-booking-approval-escalation`, `handoff-reminders`, `bonus-periods`, `team-records-draw`, `str-cleaner-time-weekly-digest`).
- Which version (published or preview) answers the Breezeway safety sweep.
- Whether turning off the Automated plan removes cards the owner already sees.
- Victor's portal in a browser.
- The full list of tables touched inside every database function (only the main tables are listed).
- Whether Microsoft 365, SharePoint, Breezeway and OwnerRez connections are healthy today (not called).
