CREATE SCHEMA auth; CREATE SCHEMA private; CREATE SCHEMA cron; CREATE ROLE authenticated; CREATE ROLE anon; CREATE ROLE service_role; SET check_function_bodies=off; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$SELECT nullif(current_setting('test.user',true),'')::uuid$$;
CREATE TYPE public.app_role AS ENUM('admin','manager','tech','vendor','owner','onboarding');
CREATE TYPE public.credential_category AS ENUM('wifi','gate_community','property_access','garage','lockbox','streaming','supply_storage','alarm_security','other');
CREATE TYPE public.lead_channel AS ENUM('call','email','text','other','note','stage_change','system');
CREATE TYPE public.lead_loss_reason AS ENUM('unresponsive','other_option','budget_too_low','no_properties_available','outside_coverage','requirements_not_met','expired','dates_did_not_work','other');
CREATE TYPE public.lead_source AS ENUM('insurance','relocation','corporate','direct','referral','realtor','website','phone','email','social','other');
CREATE TYPE public.lead_stage AS ENUM('new','first_contact','follow_up_1','final_follow_up','engaged','booking_pending','converted','lost');
CREATE TABLE private.ao_n02_relock_backup_20261115("kind" text,"row_id" uuid,"property_id" uuid,"before_value" jsonb);
CREATE TABLE private.ao_owner_needed_backup_20261115("kind" text,"row_id" uuid,"property_id" uuid,"code" text,"before_value" jsonb);
CREATE TABLE private.backup_cron_token("id" integer DEFAULT 1,"token" text DEFAULT replace(((gen_random_uuid())::text || (gen_random_uuid())::text), '-'::text, ''::text),"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE private.cleaner_cron_token("id" integer DEFAULT 1,"token" text DEFAULT replace(((gen_random_uuid())::text || (gen_random_uuid())::text), '-'::text, ''::text),"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE private.email_intake_safety_undo("id" integer,"job" jsonb,"saved_at" timestamp with time zone DEFAULT now());
CREATE TABLE private.pid_sync_credential_links("property_id" uuid,"pid_field" text,"credential_id" uuid,"linked_at" timestamp with time zone DEFAULT now());
CREATE TABLE private.pid_sync_field_hashes("property_id" uuid,"field_key" text,"value_md5" text,"written_at" timestamp with time zone DEFAULT now());
CREATE TABLE private.pid_sync_secret_fingerprints("property_id" uuid,"source_field" text,"fingerprint" text,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.active_owner_enrollment_runs("id" uuid,"actor_id" uuid,"property_id" uuid,"input" jsonb,"account_id" uuid,"program_id" uuid,"checkpoints" jsonb DEFAULT '{}'::jsonb,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.after_handoff_plan_events("id" uuid DEFAULT gen_random_uuid(),"plan_item_id" uuid,"actor_id" uuid,"action" text,"old_value" jsonb,"new_value" jsonb,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.after_handoff_plan_items("id" uuid DEFAULT gen_random_uuid(),"title" text,"source_kind" text,"template_id" uuid,"library_id" uuid,"send_after_days" integer DEFAULT 0,"active" boolean DEFAULT true,"sort_order" integer DEFAULT 0,"notes" text,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_by" uuid,"updated_at" timestamp with time zone DEFAULT now(),"coverage" text DEFAULT 'send'::text,"covered_card_code" text);
CREATE TABLE public.after_handoff_schedule("id" uuid DEFAULT gen_random_uuid(),"program_id" uuid,"property_id" uuid,"project_id" uuid,"plan_item_id" uuid,"title" text,"source_kind" text,"template_id" uuid,"library_id" uuid,"send_on" date,"status" text DEFAULT 'scheduled'::text,"work_item_id" uuid,"one_off" boolean DEFAULT false,"last_changed_by" uuid,"last_changed_at" timestamp with time zone DEFAULT now(),"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.after_handoff_schedule_events("id" uuid DEFAULT gen_random_uuid(),"schedule_id" uuid,"property_id" uuid,"project_id" uuid,"actor_id" uuid,"action" text,"old_value" jsonb,"new_value" jsonb,"note" text,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.ao_business_holidays("day" date,"label" text DEFAULT ''::text);
CREATE TABLE public.ao_card_item_map("id" uuid DEFAULT gen_random_uuid(),"match_kind" text,"match_value" text,"card_code" text,"status" text DEFAULT 'suggested'::text,"note" text DEFAULT ''::text,"created_at" timestamp with time zone DEFAULT now(),"decided_by" uuid,"decided_at" timestamp with time zone);
CREATE TABLE public.ao_card_step_link_suggestions("id" uuid DEFAULT gen_random_uuid(),"card_code" text,"suggestion_kind" text,"template_task_ids" uuid[] DEFAULT ARRAY[]::uuid[],"proposed_lock" text,"confidence" text,"note" text DEFAULT ''::text,"status" text DEFAULT 'suggested'::text,"created_at" timestamp with time zone DEFAULT now(),"decided_by" uuid,"decided_at" timestamp with time zone);
CREATE TABLE public.ao_contribution_changes("id" uuid DEFAULT gen_random_uuid(),"plan_card_id" uuid,"contribution_id" uuid,"property_id" uuid,"program_id" uuid,"changed_by" uuid,"changed_at" timestamp with time zone DEFAULT now(),"before_values" jsonb,"after_values" jsonb,"before_files" jsonb,"after_files" jsonb,"chat_message_id" uuid);
CREATE TABLE public.ao_contributions("id" uuid DEFAULT gen_random_uuid(),"plan_card_id" uuid,"property_id" uuid,"program_id" uuid,"card_id" uuid,"submitted_by" uuid,"field_values" jsonb,"submitted_at" timestamp with time zone DEFAULT now(),"files" jsonb DEFAULT '[]'::jsonb);
CREATE TABLE public.ao_daily_email_items("notification_id" uuid,"daily_notification_id" uuid,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.ao_dedupe_events("id" bigint,"subject" text,"subject_id" uuid,"action" text,"detail" jsonb DEFAULT '{}'::jsonb,"actor" uuid,"at" timestamp with time zone DEFAULT now());
CREATE TABLE public.ao_home_plan_cards("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"program_id" uuid,"card_id" uuid,"card_version" integer,"join_outcome" text,"owner_review_id" uuid,"linked_task_id" uuid,"unlocked_at" timestamp with time zone,"unlocked_by" uuid,"deadline_at" timestamp with time zone,"reminder_at" timestamp with time zone,"cutoff_at" timestamp with time zone,"reminder_sent_at" timestamp with time zone,"expired_at" timestamp with time zone,"owner_completed_at" timestamp with time zone,"created_at" timestamp with time zone DEFAULT now(),"covered_reason" text,"covered_source" text,"covered_item_id" uuid);
CREATE TABLE public.ao_home_plan_settings("property_id" uuid,"automated" boolean DEFAULT false,"updated_by" uuid,"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.ao_home_plan_settings_history("id" bigint,"property_id" uuid,"automated" boolean,"changed_by" uuid,"changed_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.ao_library_card_history("id" bigint,"card_id" uuid,"version" integer,"snapshot" jsonb,"changed_by" uuid,"changed_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.ao_library_cards("id" uuid DEFAULT gen_random_uuid(),"version" integer DEFAULT 1,"title" text,"what_text" text DEFAULT ''::text,"why_text" text DEFAULT ''::text,"how_text" text DEFAULT ''::text,"required_output" text DEFAULT ''::text,"documentation_note" text DEFAULT ''::text,"est_hours_min" numeric,"est_hours_max" numeric,"lane" text,"stage_window" text,"team_needs_this" boolean DEFAULT false,"lock_rule" text DEFAULT 'none'::text,"linked_template_task_ids" uuid[] DEFAULT ARRAY[]::uuid[],"code" text,"status" text DEFAULT 'draft'::text,"card_group" text DEFAULT ''::text,"event_triggered" boolean DEFAULT false,"opens_text" text DEFAULT ''::text,"deadline_text" text DEFAULT ''::text,"deadline_business_days" integer,"deadline_calendar_days" integer,"cutoff_rule" text DEFAULT 'next_business_day_9am'::text,"cutoff_business_days" integer DEFAULT 1,"takeover_text" text DEFAULT ''::text,"output_fields" jsonb DEFAULT '[]'::jsonb,"retired_at" timestamp with time zone,"updated_by" uuid,"updated_at" timestamp with time zone DEFAULT now(),"created_at" timestamp with time zone DEFAULT now(),"once_per_owner" boolean DEFAULT false,"owner_needed" boolean DEFAULT false);
CREATE TABLE public.ao_one_off_confirmations("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"task_id" uuid,"title_key" text DEFAULT ''::text,"confirmed_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"used_at" timestamp with time zone);
CREATE TABLE public.ao_owner_email_days("owner_key" uuid,"day" date,"kind" text,"notification_id" uuid,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.ao_plan_move_receipts("id" bigint,"project_id" uuid,"property_id" uuid,"kind" text,"task_id" uuid,"step_id" uuid,"prior_version_id" uuid,"archived_at" timestamp with time zone,"actor_id" uuid,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.ao_plan_ready_notices("notification_id" uuid,"program_id" uuid,"property_ids" uuid[] DEFAULT ARRAY[]::uuid[],"open_count" integer DEFAULT 0,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.app_settings("key" text,"value" jsonb DEFAULT '{}'::jsonb,"updated_by" uuid,"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.app_user_connections("id" uuid DEFAULT gen_random_uuid(),"user_id" uuid,"connector_id" text,"connection_key_ciphertext" text,"connected_identity" text,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.approval_email_responses("id" uuid DEFAULT gen_random_uuid(),"approval_id" uuid,"status" text DEFAULT 'matched'::text,"match_method" text,"message_id" text,"internet_message_id" text,"conversation_id" text,"subject" text,"from_name" text,"from_address" text,"received_at" timestamp with time zone,"body_text" text,"web_link" text,"has_attachments" boolean DEFAULT false,"attachments" jsonb DEFAULT '[]'::jsonb,"candidates" jsonb DEFAULT '[]'::jsonb,"linked_by" uuid,"linked_at" timestamp with time zone,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.approvals("id" uuid DEFAULT gen_random_uuid(),"entity_type" text,"entity_id" uuid,"department_id" uuid,"property_id" uuid,"kind" text,"title" text,"detail" text,"amount" numeric,"currency" text DEFAULT 'USD'::text,"requested_by" uuid,"approver_id" uuid,"approver_role" text,"status" text DEFAULT 'pending'::text,"decision_note" text,"decided_at" timestamp with time zone,"due_on" date,"evidence_url" text,"external_reference" text,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"is_demo" boolean DEFAULT false,"response_channel" text,"recorded_by" uuid,"responded_at" timestamp with time zone,"ref" bigint,"owner_email_to" text,"owner_email_sent_at" timestamp with time zone,"owner_email_conversation_id" text,"onboarding_delivery_attempt" jsonb,"onboarding_delivery_history" jsonb DEFAULT '[]'::jsonb);
CREATE TABLE public.arrival_check_state("id" boolean DEFAULT true,"last_run_at" timestamp with time zone,"last_run" jsonb DEFAULT '{}'::jsonb,"last_ingest_at" timestamp with time zone,"last_ingest" jsonb DEFAULT '{}'::jsonb);
CREATE TABLE public.arrival_checks("id" uuid DEFAULT gen_random_uuid(),"ownerrez_booking_id" text,"property_id" uuid,"ticket_id" uuid,"home_label" text,"arrival_on" date,"check_in_at" timestamp with time zone,"deadline_at" timestamp with time zone,"time_zone" text,"team" text DEFAULT 'property_operations'::text,"owner_stay" boolean DEFAULT false,"late_booking" boolean DEFAULT false,"is_test" boolean DEFAULT false,"guest_first_name" text,"guests" integer,"pets" integer,"status" text DEFAULT 'open'::text,"lock_connected" boolean,"lock_note" text,"work_orders_reviewed" boolean,"outcome" text,"issue_text" text,"backup_plan" text,"issue_ticket_id" uuid,"completed_by" uuid,"completed_at" timestamp with time zone,"result" text,"result_at" timestamp with time zone,"alert_sent_at" timestamp with time zone,"alert_recipient" uuid,"cancelled_at" timestamp with time zone,"cleared_at" timestamp with time zone,"created_at" timestamp with time zone DEFAULT now(),"steps" jsonb DEFAULT '{}'::jsonb,"recheck_flag" boolean DEFAULT false,"closed_outside_at" timestamp with time zone,"closed_outside_by" uuid,"closed_outside_reason" text);
CREATE TABLE public.arrival_reservations("ownerrez_booking_id" text,"ownerrez_property_id" text,"property_id" uuid,"arrival_on" date,"departure_on" date,"check_in_time" text,"status" text,"booking_type" text,"is_block" boolean DEFAULT false,"owner_stay" boolean DEFAULT false,"title" text,"guest_id" text,"guest_first_name" text,"adults" integer,"children" integer,"infants" integer,"pets" integer,"booked_at" timestamp with time zone,"is_test" boolean DEFAULT false,"first_seen_at" timestamp with time zone DEFAULT now(),"last_seen_at" timestamp with time zone DEFAULT now(),"decision" text,"decision_reason" text,"decided_at" timestamp with time zone);
CREATE TABLE public.assessment_findings("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"project_id" uuid,"source_task_id" uuid,"context" text DEFAULT 'standard_assessment'::text,"category" text DEFAULT 'other'::text,"title" text,"detail" text,"location" text,"severity" text DEFAULT 'normal'::text,"photo_url" text,"status" text DEFAULT 'open'::text,"correction_task_id" uuid,"finding_key" text,"is_demo" boolean DEFAULT false,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.audit_log("id" uuid DEFAULT gen_random_uuid(),"actor_id" uuid,"actor_label" text,"action" text,"entity_type" text,"entity_id" uuid,"entity_label" text,"reason" text,"before_value" jsonb,"after_value" jsonb,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.backup_export_alerts("folder_name" text,"reason" text,"message" text,"notified" integer DEFAULT 0,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.backup_file_copies("bucket" text,"name" text,"etag" text,"size" bigint DEFAULT 0,"copied_at" timestamp with time zone DEFAULT now(),"run_id" uuid);
CREATE TABLE public.backup_runs("id" uuid DEFAULT gen_random_uuid(),"folder_name" text,"status" text DEFAULT 'running'::text,"trigger" text DEFAULT 'schedule'::text,"started_at" timestamp with time zone DEFAULT now(),"finished_at" timestamp with time zone,"folder_item_id" text,"files" jsonb,"pruned_count" integer,"pruned_at" timestamp with time zone,"error" text,"kind" text DEFAULT 'nightly'::text,"weekly" boolean DEFAULT false,"phase" text,"progress" jsonb,"lease_until" timestamp with time zone,"sharepoint_path" text,"table_count" integer,"total_rows" bigint,"files_inventoried" integer,"files_copied" integer,"bytes_copied" bigint,"manifest_sha256" text,"verify_status" text,"verify_reasons" text[],"verify_result" jsonb,"verified_at" timestamp with time zone);
CREATE TABLE public.bonus_adjustments("id" uuid DEFAULT gen_random_uuid(),"plan_code" text,"user_id" uuid,"period_start" date,"goal_id" uuid,"kind" text,"fact_key" text,"reason" text,"requested_by" uuid,"requested_at" timestamp with time zone DEFAULT clock_timestamp(),"decision" text,"decision_note" text,"decided_by" uuid,"decided_at" timestamp with time zone);
CREATE TABLE public.bonus_goal_thresholds("goal_id" uuid,"applies_from" date,"threshold_met" numeric(8,3),"threshold_strong" numeric(8,3),"threshold_exceeds" numeric(8,3),"updated_by" uuid,"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.bonus_goals("id" uuid DEFAULT gen_random_uuid(),"plan_code" text,"position" integer,"code" text,"name" text,"share" numeric(5,2),"unit" text,"threshold_met" numeric(8,3),"threshold_strong" numeric(8,3),"threshold_exceeds" numeric(8,3),"source" text,"measure_key" text,"how_measured" text,"active" boolean DEFAULT true,"updated_by" uuid,"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.bonus_manual_measures("id" uuid DEFAULT gen_random_uuid(),"plan_code" text,"user_id" uuid,"period_start" date,"goal_id" uuid,"value" numeric(10,3),"note" text,"evidence_url" text,"entered_by" uuid,"entered_at" timestamp with time zone DEFAULT clock_timestamp());
CREATE TABLE public.bonus_participants("user_id" uuid,"plan_code" text,"eligible_from" date,"active" boolean DEFAULT true,"updated_by" uuid,"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.bonus_period_amounts("id" uuid DEFAULT gen_random_uuid(),"plan_code" text,"period_start" date,"period_end" date,"label" text,"amount_goal_met" numeric(10,2),"amount_strong" numeric(10,2),"amount_exceeds" numeric(10,2),"updated_by" uuid,"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.bonus_period_history("id" uuid DEFAULT gen_random_uuid(),"period_id" uuid,"version" integer,"action" text,"reason" text,"snapshot" jsonb,"total" numeric(10,2),"done_by" uuid,"done_at" timestamp with time zone DEFAULT clock_timestamp());
CREATE TABLE public.bonus_periods("id" uuid DEFAULT gen_random_uuid(),"plan_code" text,"user_id" uuid,"period_start" date,"period_end" date,"label" text,"status" text DEFAULT 'ready'::text,"ready_at" timestamp with time zone DEFAULT clock_timestamp(),"notified_at" timestamp with time zone,"reminded_at" timestamp with time zone,"verified_by" uuid,"verified_at" timestamp with time zone,"version" integer DEFAULT 0,"snapshot" jsonb,"total" numeric(10,2));
CREATE TABLE public.bonus_plans("code" text,"name" text,"position" integer,"period_kind" text,"counting_start" date,"reviewer_role" text,"reviewer_name" text,"amount_goal_met" numeric(10,2),"amount_strong" numeric(10,2),"amount_exceeds" numeric(10,2),"updated_by" uuid,"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.bonus_priorities("id" uuid DEFAULT gen_random_uuid(),"plan_code" text DEFAULT 'director_ops'::text,"user_id" uuid,"period_start" date,"name" text,"points" integer,"status" text DEFAULT 'proposed'::text,"accepted_on" date,"result_note" text,"updated_by" uuid,"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.bonus_questions("id" uuid DEFAULT gen_random_uuid(),"period_id" uuid,"question" text,"raised_by" uuid,"raised_at" timestamp with time zone DEFAULT clock_timestamp(),"answer" text,"answered_by" uuid,"answered_at" timestamp with time zone);
CREATE TABLE public.bonus_settings_history("id" uuid DEFAULT gen_random_uuid(),"area" text,"row_key" text,"field" text,"old_value" jsonb,"new_value" jsonb,"reason" text,"changed_by" uuid,"changed_at" timestamp with time zone DEFAULT clock_timestamp());
CREATE TABLE public.breezeway_bridge_records("id" uuid DEFAULT gen_random_uuid(),"breezeway_task_id" bigint,"work_order_id" uuid,"breezeway_home_id" text,"property_id" uuid,"kind" text,"outcome" text,"reason" text DEFAULT ''::text,"ticket_id" uuid,"routine_id" uuid,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.breezeway_home_tags("home_id" text,"tags" text[] DEFAULT '{}'::text[],"fetched_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.breezeway_outbound_tasks("id" uuid DEFAULT gen_random_uuid(),"source_type" text,"ticket_id" uuid,"onboarding_task_id" uuid,"property_id" uuid,"breezeway_home_id" text,"request_key" text,"breezeway_task_id" bigint,"status" text DEFAULT 'creating'::text,"title" text,"description" text,"priority" text,"department" text,"scheduled_date" date,"scheduled_time" text,"template_id" text,"assignee" text,"tags" text[],"attempts" integer DEFAULT 0,"error_message" text,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"last_synced_at" timestamp with time zone,"last_webhook_at" timestamp with time zone,"reviewed_by" uuid,"reviewed_at" timestamp with time zone,"review_note" text,"template_name" text,"assignee_ids" integer[] DEFAULT '{}'::integer[],"assignee_names" text[] DEFAULT '{}'::text[],"resolve_evidence_note" text,"work_order_id" uuid,"dispatch_guarded" boolean DEFAULT false,"instructions_set_at" timestamp with time zone,"instructions_error" text);
CREATE TABLE public.breezeway_people("id" uuid DEFAULT gen_random_uuid(),"breezeway_person_id" bigint,"first_name" text,"last_name" text,"email" text,"active" boolean DEFAULT true,"resolve_user_id" uuid,"mapping_state" text DEFAULT 'unmatched'::text,"is_integration_identity" boolean DEFAULT false,"synced_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.breezeway_sending_history("id" uuid DEFAULT gen_random_uuid(),"actor_id" uuid,"before_value" jsonb,"after_value" jsonb,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.breezeway_sending_settings("id" boolean DEFAULT true,"mode" text DEFAULT 'all_verified'::text,"home_ids" uuid[] DEFAULT '{}'::uuid[],"updated_by" uuid,"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.breezeway_webhook_events("id" uuid DEFAULT gen_random_uuid(),"received_at" timestamp with time zone DEFAULT now(),"outcome" text,"reason" text,"task_id" bigint,"home_id" bigint,"company_id" bigint,"task_updated_at" timestamp with time zone,"is_fixture" boolean DEFAULT false,"retryable" boolean DEFAULT false,"retry_count" integer DEFAULT 0,"recovered_at" timestamp with time zone);
CREATE TABLE public.breezeway_webhook_subscriptions("id" uuid DEFAULT gen_random_uuid(),"subscription_id" text,"webhook_type" text,"receiver_host" text,"registered_at" timestamp with time zone DEFAULT now(),"last_verified_at" timestamp with time zone,"active" boolean DEFAULT true,"note" text);
CREATE TABLE public.breezeway_work_order_comments("id" uuid DEFAULT gen_random_uuid(),"work_order_id" uuid,"breezeway_task_id" bigint,"breezeway_comment_id" bigint,"author" text,"body" text,"commented_at" timestamp with time zone,"direction" text DEFAULT 'inbound'::text,"created_at" timestamp with time zone DEFAULT now(),"resolve_author_id" uuid,"resolve_author_name" text,"breezeway_person_id" bigint,"identity_mode" text,"delivery_state" text DEFAULT 'mirrored'::text,"delivery_error" text,"posted_at" timestamp with time zone,"source" text DEFAULT 'breezeway'::text);
CREATE TABLE public.breezeway_work_order_photos("id" uuid DEFAULT gen_random_uuid(),"work_order_id" uuid,"breezeway_task_id" bigint,"breezeway_photo_id" bigint,"property_id" uuid,"url" text,"caption" text,"photo_type" text,"uploader" text,"breezeway_created_at" timestamp with time zone,"source" text DEFAULT 'breezeway'::text,"evidence_item_id" uuid,"first_seen_at" timestamp with time zone DEFAULT now(),"last_synced_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.breezeway_work_orders("id" uuid DEFAULT gen_random_uuid(),"breezeway_task_id" bigint,"property_id" uuid,"breezeway_home_id" text,"name" text,"description" text,"department" text,"priority" text,"status" text,"stage" text,"scheduled_date" date,"scheduled_time" text,"assignees" jsonb DEFAULT '[]'::jsonb,"photo_count" integer DEFAULT 0,"comment_count" integer DEFAULT 0,"linked_ticket_id" uuid,"needs_attention" boolean DEFAULT false,"breezeway_created_at" timestamp with time zone,"breezeway_updated_at" timestamp with time zone,"last_synced_at" timestamp with time zone DEFAULT now(),"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"reservation_snapshot" jsonb,"finished_at" timestamp with time zone,"tags" text[],"created_by_id" text,"created_by_name" text,"requested_by" text,"reported_issue" boolean,"report_url" text,"bridge_keep" boolean DEFAULT false);
CREATE TABLE public.claim_activity("id" uuid DEFAULT gen_random_uuid(),"claim_id" uuid,"author_id" uuid,"event_type" text DEFAULT 'note'::text,"body" text,"detail" jsonb,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.claim_line_items("id" uuid DEFAULT gen_random_uuid(),"claim_id" uuid,"issue" text,"amount_requested" numeric(12,2),"created_by" uuid,"is_demo" boolean DEFAULT false,"archived_at" timestamp with time zone,"archived_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.claim_platform_log("id" uuid DEFAULT gen_random_uuid(),"claim_id" uuid,"entry_on" date DEFAULT ((now() AT TIME ZONE 'America/Chicago'::text))::date,"author_id" uuid,"platform_said" text,"we_did" text,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.claim_waivers("id" uuid DEFAULT gen_random_uuid(),"claim_id" uuid,"requested_by" uuid,"reason" text,"context" text,"status" text DEFAULT 'pending'::text,"decided_by" uuid,"decision_notes" text,"decided_at" timestamp with time zone,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now(),"routed_to" uuid,"routing_basis" text,"routing_note" text);
CREATE TABLE public.claims("id" uuid DEFAULT gen_random_uuid(),"claim_type" text,"stage" text DEFAULT 'potential'::text,"disposition" text,"disposition_reason" text,"title" text,"incident_description" text,"incident_on" date,"property_id" uuid,"ticket_id" uuid,"work_order_id" uuid,"guest_name" text,"reservation_channel" text,"reservation_confirmation" text,"ownerrez_booking_id" text,"stay_arrival" date,"stay_departure" date,"assigned_to" uuid,"deadline_on" date,"follow_up_on" date,"submitted_on" date,"decided_on" date,"recovered_on" date,"closed_at" timestamp with time zone,"estimated_amount" numeric(12,2),"actual_cost" numeric(12,2),"submitted_amount" numeric(12,2),"approved_amount" numeric(12,2),"recovered_amount" numeric(12,2),"currency" text DEFAULT 'USD'::text,"external_reference" text,"cost_snapshot" jsonb,"created_by" uuid,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"category" text,"departure_review_id" uuid,"damage_categories" text[],"evidence_document_ids" uuid[],"booking_source" text,"contracting_party" text,"deposit_payer" text,"deadline_source" text,"deadline_timezone" text DEFAULT 'America/Chicago'::text,"deadline_verified" boolean DEFAULT false,"deposit_release_on" date,"deposit_release_source" text,"deposit_release_verified" boolean DEFAULT false,"submission_document_ids" uuid[] DEFAULT '{}'::uuid[],"decision_document_ids" uuid[] DEFAULT '{}'::uuid[],"nonrecovery_reason" text,"finance_decision_pending" text,"finance_treatment" text,"finance_treatment_note" text,"finance_treated_by" uuid,"finance_treated_at" timestamp with time zone,"leadership_decision_required" boolean DEFAULT false,"leadership_decision" text,"leadership_decided_by" uuid,"leadership_decided_at" timestamp with time zone,"approval_status" text,"approval_authority" text,"approval_amount" numeric,"approval_requested_by" uuid,"approval_requested_at" timestamp with time zone,"approval_decided_by" uuid,"approval_decided_at" timestamp with time zone,"approval_reason" text);
CREATE TABLE public.cleaner_account_events("id" uuid DEFAULT gen_random_uuid(),"breezeway_person_id" bigint,"from_classification" text,"to_classification" text,"from_worker_id" uuid,"to_worker_id" uuid,"note" text,"actor_id" uuid,"actor_name" text,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.cleaner_breezeway_accounts("breezeway_person_id" bigint,"last_seen_name" text,"classification" text DEFAULT 'unclassified'::text,"worker_id" uuid,"classification_note" text,"classified_by" uuid,"classified_at" timestamp with time zone,"first_seen_at" timestamp with time zone DEFAULT now(),"last_seen_at" timestamp with time zone DEFAULT now(),"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.cleaner_dispatch_decisions("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"worker_id" uuid,"company_worker_id" uuid,"task_ref" text,"breezeway_task_id" bigint,"scheduled_date" date,"state" text,"action" text,"evaluation" jsonb DEFAULT '{}'::jsonb,"override_id" uuid,"note" text,"actor_id" uuid,"actor_name" text,"created_at" timestamp with time zone DEFAULT now(),"is_fixture" boolean DEFAULT false);
CREATE TABLE public.cleaner_exposure_ledger("id" uuid DEFAULT gen_random_uuid(),"entry_key" text,"worker_id" uuid,"breezeway_person_id" bigint,"breezeway_person_name" text,"property_id" uuid,"completion_date" date,"breezeway_task_id" bigint,"assignee_count" integer,"raw_elapsed_seconds" integer,"attributed_minutes" numeric(10,2),"original_minutes" numeric(10,2),"attribution_method" text,"counted" boolean,"review_state" text,"confidence" text,"snapshot_id" uuid,"source_revision" timestamp with time zone,"synced_at" timestamp with time zone DEFAULT now(),"supersedes_id" uuid,"superseded_at" timestamp with time zone,"superseded_reason" text,"reason" text,"author_id" uuid,"author_name" text,"is_fixture" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.cleaner_hours_properties("property_id" uuid,"active" boolean DEFAULT true,"tracking_from" date,"note" text,"designated_by" uuid,"designated_at" timestamp with time zone DEFAULT now(),"ended_at" timestamp with time zone,"is_fixture" boolean DEFAULT false,"standard_clean_minutes" integer);
CREATE TABLE public.cleaner_hours_property_events("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"active" boolean,"tracking_from" date,"note" text,"actor_id" uuid,"actor_name" text,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.cleaner_pending_activations("property_id" uuid,"breezeway_home_id" text,"earliest_date" date,"note" text,"created_at" timestamp with time zone DEFAULT now(),"activated_at" timestamp with time zone,"activated_task_id" bigint,"activated_from" date);
CREATE TABLE public.cleaner_review_items("id" uuid DEFAULT gen_random_uuid(),"kind" text,"dedupe_key" text,"status" text DEFAULT 'open'::text,"breezeway_task_id" bigint,"breezeway_person_id" bigint,"breezeway_home_id" bigint,"property_id" uuid,"ledger_entry_id" uuid,"source_revision" timestamp with time zone,"detail" jsonb DEFAULT '{}'::jsonb,"is_fixture" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now(),"resolved_at" timestamp with time zone,"resolved_by" uuid,"resolved_by_name" text,"resolution_note" text);
CREATE TABLE public.cleaner_safeguard_overrides("id" uuid DEFAULT gen_random_uuid(),"kind" text,"property_id" uuid,"worker_id" uuid,"task_ref" text,"breezeway_task_id" bigint,"scheduled_date" date,"year" integer,"current_hours" numeric,"projected_clean_hours" numeric,"projected_total_hours" numeric,"owner_hours" numeric,"buffer_hours" numeric,"state_at_approval" text,"estimate_source" text,"reason_category" text,"justification" text,"approved_by" uuid,"approved_by_name" text,"created_at" timestamp with time zone DEFAULT now(),"is_fixture" boolean DEFAULT false);
CREATE TABLE public.cleaner_sync_runs("id" uuid DEFAULT gen_random_uuid(),"kind" text,"status" text DEFAULT 'running'::text,"window_from" date,"window_to" date,"home_queue" jsonb DEFAULT '[]'::jsonb,"cursor" integer DEFAULT 0,"tasks_seen" integer DEFAULT 0,"snapshots_created" integer DEFAULT 0,"errors" jsonb DEFAULT '[]'::jsonb,"last_error" text,"people_refreshed_at" timestamp with time zone,"started_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"completed_at" timestamp with time zone);
CREATE TABLE public.cleaner_task_snapshots("id" uuid DEFAULT gen_random_uuid(),"breezeway_task_id" bigint,"breezeway_home_id" bigint,"property_id" uuid,"status_code" text,"status_stage" text,"department" text,"template_id" bigint,"task_name" text,"scheduled_date" date,"started_at" timestamp with time zone,"finished_at" timestamp with time zone,"total_time" text,"elapsed_seconds" integer,"finished_by_id" bigint,"finished_by_name" text,"assignees" jsonb DEFAULT '[]'::jsonb,"linked_reservation" jsonb,"source_updated_at" timestamp with time zone,"payload" jsonb,"payload_hash" text,"source" text,"is_fixture" boolean DEFAULT false,"synced_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.cleaner_task_state("breezeway_task_id" bigint,"latest_snapshot_id" uuid,"property_id" uuid,"last_synced_at" timestamp with time zone DEFAULT now(),"last_source" text,"is_fixture" boolean DEFAULT false);
CREATE TABLE public.cleaner_workers("id" uuid DEFAULT gen_random_uuid(),"display_name" text,"account_type" text,"active" boolean DEFAULT true,"company_worker_id" uuid,"vendor_org_id" uuid,"notes" text,"created_by" uuid,"updated_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"person_kinds" text[] DEFAULT ARRAY['cleaner'::text],"staff_user_id" uuid);
CREATE TABLE public.cleaning_regions("market" text,"manager_id" uuid,"manager_name" text,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.cleaning_reviews("id" uuid DEFAULT gen_random_uuid(),"departure_review_id" uuid,"property_id" uuid,"breezeway_task_id" bigint,"ownerrez_booking_id" text,"reservation_code" text,"cleaner_name" text,"reviewed_by" uuid,"reviewed_at" timestamp with time zone,"outcome" text,"property_issues_found" boolean,"damage_found" boolean,"notes" text,"photo_document_ids" uuid[] DEFAULT '{}'::uuid[],"linked_ticket_ids" uuid[] DEFAULT '{}'::uuid[],"linked_claim_id" uuid,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"bill_guest" boolean,"guest_paid_deposit" boolean);
CREATE TABLE public.coach_sessions("id" uuid DEFAULT gen_random_uuid(),"created_at" timestamp with time zone DEFAULT now(),"created_by" uuid,"property_id" uuid,"ticket_id" uuid,"question" text,"guidance" jsonb DEFAULT '{}'::jsonb,"follow_ups" jsonb DEFAULT '[]'::jsonb);
CREATE TABLE public.coverage_config("id" boolean DEFAULT true,"after_hours_start_minute" integer,"after_hours_end_minute" integer,"timezone" text DEFAULT 'America/Chicago'::text,"note" text,"configured_by" uuid,"configured_at" timestamp with time zone,"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.coverage_overrides("id" uuid DEFAULT gen_random_uuid(),"role_code" text,"kind" text DEFAULT 'cover'::text,"user_id" uuid,"starts_at" timestamp with time zone,"ends_at" timestamp with time zone,"note" text,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.coverage_shifts("id" uuid DEFAULT gen_random_uuid(),"role_code" text,"weekday" smallint,"start_minute" integer,"end_minute" integer,"active" boolean DEFAULT true,"note" text,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"lunch_start_minute" integer,"lunch_end_minute" integer);
CREATE TABLE public.coverage_triage_windows("id" uuid DEFAULT gen_random_uuid(),"weekday" smallint,"start_minute" integer,"end_minute" integer,"covers_team" text,"role_code" text,"active" boolean DEFAULT true,"note" text,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.credential_access_log("id" uuid DEFAULT gen_random_uuid(),"credential_id" uuid,"property_id" uuid,"user_id" uuid,"action" text,"ticket_id" uuid,"user_agent_hash" text,"occurred_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.credential_intake_queue("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"source_field" text,"suggested_category" credential_category DEFAULT 'other'::credential_category,"suggested_label" text,"secret_ciphertext" text,"secret_nonce" text,"status" text DEFAULT 'pending'::text,"reviewed_by" uuid,"reviewed_at" timestamp with time zone,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.demo_environment("id" text,"active" boolean DEFAULT true,"seeded_at" timestamp with time zone,"scenario_count" integer DEFAULT 0);
CREATE TABLE public.department_members("id" uuid DEFAULT gen_random_uuid(),"department_id" uuid,"user_id" uuid,"level" text DEFAULT 'member'::text,"market_scope" text[] DEFAULT '{}'::text[],"active" boolean DEFAULT true,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.departments("id" uuid DEFAULT gen_random_uuid(),"code" text,"label" text,"blurb" text,"landing_path" text,"sort_order" integer DEFAULT 0,"active" boolean DEFAULT true,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.departure_clean_match_events("id" uuid DEFAULT gen_random_uuid(),"match_id" uuid,"event_type" text,"from_state" text,"to_state" text,"ownerrez_booking_id" text,"summary" text,"actor_id" uuid,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.departure_clean_matches("id" uuid DEFAULT gen_random_uuid(),"breezeway_work_order_id" uuid,"breezeway_task_id" bigint,"property_id" uuid,"state" text,"ownerrez_booking_id" text,"checkout_date" date,"match_method" text,"confidence" text,"reason" text,"candidates" jsonb DEFAULT '[]'::jsonb,"reservation" jsonb,"is_manual" boolean DEFAULT false,"decided_by" uuid,"decided_at" timestamp with time zone,"last_evaluated_at" timestamp with time zone DEFAULT now(),"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.departure_review_events("id" uuid DEFAULT gen_random_uuid(),"departure_review_id" uuid,"property_id" uuid,"event_type" text,"summary" text,"actor_id" uuid,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.departure_reviews("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"breezeway_work_order_id" uuid,"breezeway_task_id" bigint,"event_key" text,"team" text DEFAULT 'property_operations'::text,"status" text DEFAULT 'open'::text,"claimed_by" uuid,"claimed_at" timestamp with time zone,"guest_name" text,"stay_arrival" date,"stay_departure" date,"ownerrez_booking_id" text,"reservation_code" text,"booking_source" text,"deposit_payer" text,"deposit_amount" numeric,"clean_name" text,"clean_completed_at" timestamp with time zone,"cleaner_name" text,"clean_photo_count" integer,"clean_reviewed_at" timestamp with time zone,"clean_reviewed_by" uuid,"property_attention" text,"property_notes" text,"damage_screen" text,"damage_categories" text[] DEFAULT '{}'::text[],"damage_description" text,"damage_estimate" numeric,"damage_notes" text,"claim_id" uuid,"outreach_decision" text,"outreach_reason" text,"outreach_status" text,"host_review" text,"notes" text,"attachment_document_ids" uuid[] DEFAULT '{}'::uuid[],"completed_at" timestamp with time zone,"completed_by" uuid,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"clean_completed_exact" boolean DEFAULT false);
CREATE TABLE public.direct_booking_approvals("id" uuid DEFAULT gen_random_uuid(),"lead_id" uuid,"requested_by" uuid,"requested_at" timestamp with time zone DEFAULT now(),"reply" jsonb,"property_ids" uuid[] DEFAULT '{}'::uuid[],"escalated_at" timestamp with time zone,"decision" text,"decided_by" uuid,"decided_at" timestamp with time zone,"decided_as" text,"note" text);
CREATE TABLE public.document_recipient_events("id" uuid DEFAULT gen_random_uuid(),"document_id" uuid,"owner_id" uuid,"program_id" uuid,"actor_id" uuid,"event" text,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.documents("id" uuid DEFAULT gen_random_uuid(),"entity_type" text,"entity_id" uuid,"department_id" uuid,"title" text,"kind" text DEFAULT 'link'::text,"storage_path" text,"external_url" text,"visibility" text DEFAULT 'staff'::text,"required" boolean DEFAULT false,"note" text,"archived_at" timestamp with time zone,"uploaded_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"property_id" uuid,"original_filename" text,"mime_type" text,"size_bytes" bigint,"upload_key" text,"uploaded_at" timestamp with time zone,"upload_status" text DEFAULT 'stored'::text,"requested_from" text,"deleted_at" timestamp with time zone,"deleted_by" uuid,"delete_reason" text,"is_demo" boolean DEFAULT false,"category" text,"owner_recipient_id" uuid,"owner_recipient_program_id" uuid,"fulfils_request_id" uuid,"fulfilled_by_document_id" uuid,"owner_category" text,"work_item_id" uuid);
CREATE TABLE public.email_job_runs("id" uuid DEFAULT gen_random_uuid(),"started_at" timestamp with time zone DEFAULT now(),"finished_at" timestamp with time zone,"parts" jsonb DEFAULT '{}'::jsonb,"email_counts" jsonb DEFAULT '{}'::jsonb,"errors" jsonb DEFAULT '[]'::jsonb,"closed_reason" text);
CREATE TABLE public.email_log("id" uuid DEFAULT gen_random_uuid(),"recipient" text,"subject" text,"purpose" text DEFAULT 'general'::text,"sender" text,"reply_to" text,"ticket_id" uuid,"status" text DEFAULT 'pending'::text,"attempts" integer DEFAULT 0,"error_message" text,"sent_at" timestamp with time zone,"created_at" timestamp with time zone DEFAULT now(),"entity_type" text,"entity_id" uuid,"body" text,"sent_by" uuid,"template_id" uuid,"cc" text[] DEFAULT '{}'::text[],"bcc" text[] DEFAULT '{}'::text[],"scheduled_for" timestamp with time zone,"scheduled_time_zone" text,"attachments" jsonb DEFAULT '[]'::jsonb,"to_additional" text[] DEFAULT '{}'::text[],"email_job_run_id" uuid,"email_job_part" text);
CREATE TABLE public.email_pass_outages("id" uuid DEFAULT gen_random_uuid(),"last_success_at" timestamp with time zone,"noticed_at" timestamp with time zone DEFAULT now(),"notified" integer DEFAULT 0,"cleared_at" timestamp with time zone);
CREATE TABLE public.email_templates("id" uuid DEFAULT gen_random_uuid(),"name" text,"audience" text DEFAULT 'guest'::text,"contexts" text[] DEFAULT ARRAY['ticket'::text],"subject" text,"body" text,"active" boolean DEFAULT true,"created_by" uuid,"updated_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.escalations("id" uuid DEFAULT gen_random_uuid(),"ticket_id" uuid,"work_order_id" uuid,"property_id" uuid,"escalated_by" uuid,"escalated_to_role" text,"escalated_to" uuid,"reason" text,"already_tried" text,"help_needed" text,"urgency" text DEFAULT 'normal'::text,"status" text DEFAULT 'open'::text,"outcome" text,"outcome_note" text,"resolved_by" uuid,"resolved_at" timestamp with time zone,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"onboarding_task_id" uuid,"work_item_id" uuid);
CREATE TABLE public.evidence_events("id" uuid DEFAULT gen_random_uuid(),"item_id" uuid,"requirement_id" uuid,"event" text,"actor_id" uuid,"detail" jsonb DEFAULT '{}'::jsonb,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.evidence_items("id" uuid DEFAULT gen_random_uuid(),"requirement_id" uuid,"document_id" uuid,"property_id" uuid,"source" text DEFAULT 'resolve_upload'::text,"external_url" text,"breezeway_photo_id" bigint,"breezeway_task_id" bigint,"status" text DEFAULT 'checking'::text,"stage_a" jsonb DEFAULT '{}'::jsonb,"stage_b" jsonb DEFAULT '{}'::jsonb,"reason_codes" text[] DEFAULT '{}'::text[],"guidance" text,"evaluator" text,"evaluated_at" timestamp with time zone,"uploaded_by" uuid,"exception_by" uuid,"exception_reason" text,"exception_at" timestamp with time zone,"original_rejection" text,"posted_to_breezeway_at" timestamp with time zone,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.evidence_requirements("id" uuid DEFAULT gen_random_uuid(),"subject_type" text,"subject_id" uuid,"property_id" uuid,"slot_key" text,"label" text,"requirement_kind" text DEFAULT 'general'::text,"instruction" text,"detail" text,"required" boolean DEFAULT true,"status" text DEFAULT 'awaiting'::text,"accepted_item_id" uuid,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.expense_events("id" uuid DEFAULT gen_random_uuid(),"expense_id" uuid,"actor_id" uuid,"kind" text,"before_value" jsonb,"after_value" jsonb,"reason" text,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.expense_links("id" uuid DEFAULT gen_random_uuid(),"expense_id" uuid,"link_type" text,"target_id" uuid,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.expense_recoveries("id" uuid DEFAULT gen_random_uuid(),"expense_id" uuid,"party" text,"expected_amount" numeric DEFAULT 0,"received_amount" numeric DEFAULT 0,"received_on" date,"note" text,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"claim_id" uuid,"accounting_reference" text,"corrects_id" uuid,"is_demo" boolean DEFAULT false);
CREATE TABLE public.expenses("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"expense_type" text DEFAULT 'vendor_service'::text,"payee" text,"amount" numeric,"expense_date" date,"received_on" date DEFAULT ((now() AT TIME ZONE 'America/Chicago'::text))::date,"reason" text,"dispatch_reason" text,"visit_outcome" text,"purchased_what" text,"purchase_purpose" text,"vendor_invoice_ref" text,"invoice_document_ids" uuid[] DEFAULT '{}'::uuid[],"photo_document_ids" uuid[] DEFAULT '{}'::uuid[],"photos_required" boolean DEFAULT false,"approval_id" uuid,"authorization_note" text,"owner_notified_at" timestamp with time zone,"owner_notification_note" text,"reservation_link_state" text DEFAULT 'not_relevant'::text,"ownerrez_booking_id" text,"proposed_statement_period" date,"ops_completion" text DEFAULT 'open'::text,"recommended_responsibility" text,"ops_recommendation_note" text,"recommended_by" uuid,"cost_responsibility" text DEFAULT 'pending'::text,"split_allocations" jsonb DEFAULT '[]'::jsonb,"finance_review" text DEFAULT 'not_started'::text,"finance_treatment_note" text,"reviewed_by" uuid,"reviewed_at" timestamp with time zone,"qb_reference_manual" text,"leadership_required" boolean DEFAULT false,"leadership_reason" text,"leadership_assignee" uuid,"leadership_decision" text,"leadership_decided_by" uuid,"leadership_decided_at" timestamp with time zone,"change_reason" text,"financial_request_id" uuid,"is_demo" boolean DEFAULT false,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"archived_at" timestamp with time zone,"archived_by" uuid,"archive_reason" text,"work_order_visit_id" uuid,"is_estimate" boolean DEFAULT false,"duplicate_flag" text,"duplicate_of" uuid,"purchase_auth_status" text,"purchase_auth_evidence" text,"purchase_authorized_by" text,"invoice_date" date);
CREATE TABLE public.external_databases("id" uuid DEFAULT gen_random_uuid(),"key" text,"label" text,"source" text DEFAULT 'notion'::text,"external_database_id" text,"description" text,"sync_enabled" boolean DEFAULT false,"read_only" boolean DEFAULT true,"verified" boolean DEFAULT false,"archived_at" timestamp with time zone,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.external_links("id" uuid DEFAULT gen_random_uuid(),"entity_type" text,"entity_id" uuid,"system" text,"external_id" text,"external_url" text,"external_parent_id" text,"last_synced_at" timestamp with time zone,"last_sync_status" text DEFAULT 'pending'::text,"last_error" text,"payload_hash" text,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.external_records("id" uuid DEFAULT gen_random_uuid(),"database_key" text,"source" text DEFAULT 'notion'::text,"external_id" text,"title" text,"payload" jsonb DEFAULT '{}'::jsonb,"property_id" uuid,"ownerrez_property_id" text,"match_status" text DEFAULT 'unmatched'::text,"match_note" text,"matched_by" uuid,"matched_at" timestamp with time zone,"is_demo" boolean DEFAULT false,"archived_at" timestamp with time zone,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.feature_flags("key" text,"label" text,"description" text,"enabled" boolean DEFAULT false,"updated_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.field_conflicts("id" uuid DEFAULT gen_random_uuid(),"entity_type" text,"entity_id" uuid,"system" text,"field_key" text,"field_label" text,"resolve_value" text,"external_value" text,"detected_at" timestamp with time zone DEFAULT now(),"status" text DEFAULT 'open'::text,"chosen_source" text,"final_value" text,"resolved_by" uuid,"resolved_at" timestamp with time zone,"note" text,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.financial_requests("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"project_id" uuid,"task_id" uuid,"kind" text DEFAULT 'repair'::text,"title" text,"vendor" text,"description" text,"estimate_amount" numeric(12,2) DEFAULT 0,"authority_tier" text DEFAULT 'proceed'::text,"emergency" boolean DEFAULT false,"emergency_reason" text,"approval_id" uuid,"approved_amount" numeric(12,2),"approved_at" timestamp with time zone,"invoice_amount" numeric(12,2),"invoice_ref" text,"invoice_at" timestamp with time zone,"variance_note" text,"accounting_recipient" text,"accounting_sent_at" timestamp with time zone,"settled_at" timestamp with time zone,"settlement_note" text,"status" text DEFAULT 'estimate'::text,"created_by" uuid,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"actual_amount" numeric(12,2),"actual_recorded_at" timestamp with time zone,"actual_recorded_by" uuid,"authority_policy" jsonb,"onboarding_delivery_attempt" jsonb,"onboarding_delivery_history" jsonb DEFAULT '[]'::jsonb);
CREATE TABLE public.full_backups("id" uuid DEFAULT gen_random_uuid(),"folder" text,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"finished_at" timestamp with time zone,"status" text DEFAULT 'running'::text,"table_count" integer,"total_rows" bigint,"counts" jsonb,"manifest_sha256" text,"error" text,"verified_at" timestamp with time zone,"verified_by" uuid,"verify_ok" boolean,"verify_result" jsonb);
CREATE TABLE public.functional_role_members("id" uuid DEFAULT gen_random_uuid(),"role_code" text,"user_id" uuid,"added_by" uuid,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.functional_roles("id" uuid DEFAULT gen_random_uuid(),"code" text,"name" text,"team" text DEFAULT 'property_operations'::text,"coverage_window" text,"lunch_window" text,"lunch_coverage" text,"backup_role_code" text,"current_seat_holder" uuid,"current_seat_name" text,"sort_order" integer DEFAULT 0,"active" boolean DEFAULT true,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"available" boolean DEFAULT true,"unavailable_note" text,"unavailable_until" timestamp with time zone);
CREATE TABLE public.gatekeeper_requirements("id" uuid DEFAULT gen_random_uuid(),"code" text,"label" text,"detail" text,"applies_to_class" text DEFAULT 'any'::text,"applies_to_category" text,"applies_to_market" text,"requirement_level" text DEFAULT 'required'::text,"verification_method" text,"approver_role" text DEFAULT 'manager'::text,"expires_after_days" integer,"sort_order" integer DEFAULT 0,"active" boolean DEFAULT true,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"allows_not_applicable" boolean DEFAULT false,"allows_equivalent" boolean DEFAULT false,"exception_rule" text,"expiry_required" boolean DEFAULT false,"evidence_required" boolean DEFAULT false);
CREATE TABLE public.guest_feedback("id" uuid DEFAULT gen_random_uuid(),"feedback_type" text,"property_id" uuid,"ownerrez_booking_id" text,"reservation_match" text DEFAULT 'unknown'::text,"guest_id" text,"guest_name" text,"rating" integer,"summary" text,"response_text" text,"source" text,"source_review_id" text,"source_url" text,"submitted_at" timestamp with time zone DEFAULT now(),"stay_start" date,"stay_end" date,"booking_platform" text,"issue_categories" text[] DEFAULT '{}'::text[],"follow_up_required" boolean DEFAULT false,"follow_up_status" text DEFAULT 'none'::text,"ticket_id" uuid,"contact_outcome" text,"contact_notes" text,"followup_outcome" text,"followup_completed_at" timestamp with time zone,"followup_completed_by" uuid,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"reviewer_display_name" text,"reservation_guest_name" text,"reservation_guest_first_name" text,"reservation_guest_last_name" text,"reservation_confirmation" text,"reservation_enriched_at" timestamp with time zone,"published_date_known" boolean DEFAULT true);
CREATE TABLE public.guest_feedback_events("id" uuid DEFAULT gen_random_uuid(),"feedback_id" uuid,"kind" text,"detail" text,"actor_id" uuid,"event_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.guest_ready_standards("id" uuid DEFAULT gen_random_uuid(),"label" text,"must_be_done" text DEFAULT 'Not set'::text,"locked" boolean DEFAULT false,"rule" text DEFAULT 'not_set'::text,"rule_days" integer,"work_type_id" uuid,"match_priority" text,"lock_note" text,"sort_order" integer DEFAULT 100,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"updated_by" uuid);
CREATE TABLE public.guest_recovery("id" uuid DEFAULT gen_random_uuid(),"ticket_id" uuid,"property_id" uuid,"claim_id" uuid,"stage" text DEFAULT 'reported'::text,"outcome" text,"recovery_action" text,"title" text,"issue_summary" text,"impact_detail" text,"guest_name" text,"reservation_channel" text,"reservation_confirmation" text,"ownerrez_booking_id" text,"stay_arrival" date,"stay_departure" date,"nightly_rate" numeric,"impacted_nights" numeric,"proposed_amount" numeric,"approved_amount" numeric,"delivered_amount" numeric,"currency" text DEFAULT 'USD'::text,"delivery_method" text,"authority_level" text,"approval_id" uuid,"approved_by" uuid,"approved_at" timestamp with time zone,"delivered_on" date,"guest_notified_on" date,"follow_up_on" date,"assigned_to" uuid,"created_by" uuid,"closed_at" timestamp with time zone,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"policy_version" text DEFAULT 'ARHA Operations Policy Thresholds for Resolve — v1'::text,"within_airbnb_policy" boolean,"escalation_flags" text[] DEFAULT '{}'::text[],"guest_requested_amount" numeric,"approval_status" text DEFAULT 'not_required'::text,"approval_authority" text,"escalation_reason" text,"decision_reason" text,"requested_by" uuid,"requested_at" timestamp with time zone,"decision_at" timestamp with time zone,"decision_note" text,"issued_by" uuid,"issued_on" date,"priority" text DEFAULT 'p3'::text,"corrective_action" text,"unresolved_concern" text,"final_communication_at" timestamp with time zone,"last_guest_update_at" timestamp with time zone,"promised_update_at" timestamp with time zone,"temporary_mitigation" text,"mitigation_at" timestamp with time zone,"resolution_attempts" integer DEFAULT 0,"guest_requested_supervisor" boolean DEFAULT false,"supervisor_engaged_at" timestamp with time zone,"supervisor_escalation_reason" text,"reopened_at" timestamp with time zone,"reopened_by" uuid,"reopen_reason" text,"handoff_to" uuid,"handoff_status" text,"handoff_reason" text,"handoff_next_action" text,"handoff_due" timestamp with time zone,"handoff_accepted_at" timestamp with time zone);
CREATE TABLE public.guest_recovery_activity("id" uuid DEFAULT gen_random_uuid(),"recovery_id" uuid,"author_id" uuid,"event_type" text,"body" text,"detail" jsonb DEFAULT '{}'::jsonb,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.guest_survey_responses("feedback_id" uuid,"answers" jsonb DEFAULT '{}'::jsonb,"had_issues" boolean,"follow_up_permission" boolean,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.handoff_carryovers("id" uuid DEFAULT gen_random_uuid(),"project_id" uuid,"property_id" uuid,"item_key" text,"requirement_id" uuid,"task_ids" uuid[] DEFAULT '{}'::uuid[],"ticket_id" uuid,"title" text,"category" text,"owner_role" text,"due_on" date,"note" text DEFAULT ''::text,"accepted_at" timestamp with time zone,"accepted_by" uuid,"is_demo" boolean DEFAULT false);
CREATE TABLE public.handoff_link_suggestions("id" uuid DEFAULT gen_random_uuid(),"requirement_id" uuid,"template_step_id" uuid,"confidence" text,"confirmed_at" timestamp with time zone,"confirmed_by" uuid);
CREATE TABLE public.handoff_reminders("id" uuid DEFAULT gen_random_uuid(),"project_id" uuid,"property_id" uuid,"handoff_on" date,"kind" text,"sent_on" date,"recipients" uuid[] DEFAULT '{}'::uuid[],"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.handoff_requirements("id" uuid DEFAULT gen_random_uuid(),"code" text,"name" text,"category" text,"tier" text,"done_when" text DEFAULT ''::text,"proof_needed" text DEFAULT ''::text,"status" text DEFAULT 'proposed'::text,"notes" text DEFAULT ''::text,"sort_order" integer DEFAULT 0,"template_step_ids" uuid[] DEFAULT '{}'::uuid[],"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.handoff_reviews("id" uuid DEFAULT gen_random_uuid(),"handoff_id" uuid,"property_id" uuid,"step" text,"decision" text,"reviewer_id" uuid,"note" text,"exception_reason" text,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.handoff_standard_history("id" uuid DEFAULT gen_random_uuid(),"requirement_id" uuid,"actor_id" uuid,"actor_name" text,"created_at" timestamp with time zone DEFAULT now(),"old_value" jsonb,"new_value" jsonb,"action" text);
CREATE TABLE public.handoff_step_history("id" uuid DEFAULT gen_random_uuid(),"project_id" uuid,"actor_id" uuid,"step" text,"items" jsonb,"booking_block" boolean DEFAULT false,"booking_block_at" timestamp with time zone,"created_at" timestamp with time zone DEFAULT now(),"is_demo" boolean DEFAULT false);
CREATE TABLE public.handoffs("id" uuid DEFAULT gen_random_uuid(),"ticket_id" uuid,"from_user" uuid,"to_user" uuid,"to_role_code" text,"handoff_type" text DEFAULT 'ownership_transfer'::text,"summary" text,"priority" text DEFAULT 'p3'::text,"actions_completed" text,"current_status" text,"next_action" text,"due_at" timestamp with time zone,"guest_comm_status" text DEFAULT 'not_required'::text,"risks" text,"status" text DEFAULT 'pending'::text,"responded_at" timestamp with time zone,"response_reason" text,"created_at" timestamp with time zone DEFAULT now(),"is_demo" boolean DEFAULT false,"accepted_by" uuid,"accepted_at" timestamp with time zone);
CREATE TABLE public.help_ticket_events("id" uuid DEFAULT gen_random_uuid(),"ticket_id" uuid,"kind" text,"from_status" text,"to_status" text,"body" text,"author_id" uuid,"author_name" text,"email_status" text,"email_recipient" text,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.help_tickets("id" uuid DEFAULT gen_random_uuid(),"ticket_number" bigint,"submitted_at" timestamp with time zone DEFAULT now(),"submitted_by" uuid,"submitter_name" text,"submitter_email" text,"user_role" text,"portal" text,"property_id" uuid,"property_label" text,"page_title" text,"route" text,"kind" text,"description" text,"attachments" jsonb DEFAULT '[]'::jsonb,"work_item_id" text,"user_agent" text,"status" text DEFAULT 'new'::text,"email_status" text,"updated_at" timestamp with time zone DEFAULT now(),"last_activity_at" timestamp with time zone);
CREATE TABLE public.home_chat_alerts("id" uuid DEFAULT gen_random_uuid(),"chat_id" uuid,"message_id" uuid,"audience" text,"notification_ids" uuid[] DEFAULT '{}'::uuid[],"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.home_chat_message_tasks("message_id" uuid,"task_id" uuid,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.home_chat_messages("id" uuid DEFAULT gen_random_uuid(),"chat_id" uuid,"author_id" uuid,"author_type" text,"body" text DEFAULT ''::text,"attachments" jsonb DEFAULT '[]'::jsonb,"mentions" uuid[] DEFAULT '{}'::uuid[],"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.home_chat_reads("chat_id" uuid,"user_id" uuid,"last_read_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.home_chats("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"kind" text,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.home_handoff_decisions("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"requirement_id" uuid,"state" text,"reason" text,"actor_id" uuid,"created_at" timestamp with time zone DEFAULT now(),"is_demo" boolean DEFAULT false);
CREATE TABLE public.homeowner_answer_reviews("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"item_key" text,"answer_at" timestamp with time zone,"reviewed_by" uuid,"reviewed_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.homeowner_updates("id" uuid DEFAULT gen_random_uuid(),"program_id" uuid,"property_id" uuid,"kind" text,"item_id" uuid,"item_title" text,"task_id" uuid,"actor_id" uuid,"summary" text,"chat_message_id" uuid,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.inquiry_sources("id" uuid DEFAULT gen_random_uuid(),"name" text,"source_type" text,"corporate_housing_extra" numeric,"discount_percent" numeric,"referral_percent" numeric,"referral_fee" numeric,"referral_rule" text,"utilities_included" boolean,"application_fee" numeric,"cleaning_fee" numeric,"security_deposit" numeric,"pet_fee_per_pet" numeric DEFAULT 250,"pet_fee_notes" text,"pet_deposit_notes" text,"payment_details" text,"booking_documents" text,"pricing_flags" text,"active" boolean DEFAULT true,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"created_by" uuid,"updated_by" uuid);
CREATE TABLE public.integration_events("id" uuid DEFAULT gen_random_uuid(),"system" text,"direction" text,"entity_type" text,"entity_id" uuid,"external_id" text,"operation" text,"status" text DEFAULT 'pending'::text,"attempts" integer DEFAULT 0,"next_attempt_at" timestamp with time zone,"payload_hash" text,"request_payload" jsonb,"previous_value" jsonb,"error_message" text,"resolved_by" uuid,"resolved_at" timestamp with time zone,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"conversation_id" text);
CREATE TABLE public.integration_tokens("provider" text,"access_token_enc" text,"refresh_token_enc" text,"obtained_at" timestamp with time zone,"expires_at" timestamp with time zone,"last_auth_attempt_at" timestamp with time zone,"last_check_at" timestamp with time zone,"last_check_ok" boolean,"last_error" text,"company_label" text,"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.lead_activity("id" uuid DEFAULT gen_random_uuid(),"lead_id" uuid,"channel" lead_channel,"outcome" text,"note" text,"from_stage" lead_stage,"to_stage" lead_stage,"actor_id" uuid,"occurred_at" timestamp with time zone DEFAULT now(),"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.lead_properties("id" uuid DEFAULT gen_random_uuid(),"lead_id" uuid,"property_id" uuid,"note" text,"presented_at" timestamp with time zone,"added_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"quote_total" numeric,"quote_currency" text,"outcome" text,"outcome_reason" text,"outcome_at" timestamp with time zone,"outcome_by" uuid);
CREATE TABLE public.lead_tickets("id" uuid DEFAULT gen_random_uuid(),"lead_id" uuid,"ticket_id" uuid,"linked_by" uuid,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.leads("id" uuid DEFAULT gen_random_uuid(),"contact_name" text,"company" text,"phone" text,"email" text,"preferred_channel" lead_channel,"source" lead_source DEFAULT 'direct'::lead_source,"source_detail" jsonb DEFAULT '{}'::jsonb,"market" text,"desired_move_in" date,"length_of_stay_days" integer,"bedrooms" integer,"budget_monthly" numeric(12,2),"requirements" text,"pets" boolean,"date_flexible" boolean,"stage" lead_stage DEFAULT 'new'::lead_stage,"assigned_to" uuid,"last_contact_at" timestamp with time zone,"keep_open_reason" text,"quote_sent_at" timestamp with time zone,"quote_amount" numeric(12,2),"quote_note" text,"converted_at" timestamp with time zone,"converted_by" uuid,"converted_property_id" uuid,"reservation_ref" text,"lost_at" timestamp with time zone,"lost_reason" lead_loss_reason,"lost_note" text,"notes" text,"created_by" uuid,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"search_region" text,"desired_check_out" date,"guests" integer,"dogs" integer,"cats" integer,"inquiry_source_id" uuid,"next_follow_up_on" date,"kind" text,"subject" text,"partner_name" text,"min_bathrooms" numeric,"owned_by" uuid,"started_at" timestamp with time zone,"reply_to" text,"reply_cc" text[],"reply_subject" text,"reply_body" text,"offered_property_ids" uuid[],"reply_sent_at" timestamp with time zone,"reply_sent_by" uuid,"reply_sent_via" text,"last_follow_up_at" timestamp with time zone,"outcome" text,"outcome_at" timestamp with time zone,"outcome_by" uuid,"booked_property_id" uuid,"booked_move_in" date,"not_booked_reason" text,"not_booked_note" text,"asap" boolean,"stay_length" text,"preferred_bedrooms" integer,"near_address" text,"distance_wanted" text,"follow_up_due_at" timestamp with time zone,"partner_approved_at" timestamp with time zone,"partner_approved_by" uuid,"partner_approved_note" text,"overnight_until" timestamp with time zone,"morning_alerted_at" timestamp with time zone,"portal_link" text,"reply_method" text,"portal_answered_at" timestamp with time zone,"portal_answered_by" uuid,"portal_answer_note" text);
CREATE TABLE public.marketing_photo_downloads("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"user_id" uuid,"requested_at" timestamp with time zone DEFAULT now(),"token_hash" text,"expires_at" timestamp with time zone,"started_at" timestamp with time zone,"file_count" integer DEFAULT 0,"total_bytes" bigint DEFAULT 0);
CREATE TABLE public.marketing_photo_notices("property_id" uuid,"notified_at" timestamp with time zone DEFAULT now(),"notified_user" uuid);
CREATE TABLE public.metric_definitions("id" uuid DEFAULT gen_random_uuid(),"key" text,"label" text,"section" text,"department_id" uuid,"business_definition" text,"source_system" text,"unit" text DEFAULT 'count'::text,"target_text" text,"target_low" numeric,"target_high" numeric,"higher_is_better" boolean DEFAULT true,"drill_path" text,"connected" boolean DEFAULT true,"unavailable_reason" text,"sort_order" integer DEFAULT 0,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.onboarding_budget_changes("id" uuid DEFAULT gen_random_uuid(),"budget_id" uuid,"line_id" uuid,"field" text,"old_value" text,"new_value" text,"reason" text,"changed_by" uuid,"changed_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.onboarding_budget_lines("id" uuid DEFAULT gen_random_uuid(),"budget_id" uuid,"property_id" uuid,"category" text DEFAULT 'other'::text,"label" text,"vendor" text,"estimated_amount" numeric(12,2) DEFAULT 0,"committed_amount" numeric(12,2),"actual_amount" numeric(12,2),"status" text DEFAULT 'planned'::text,"financial_request_id" uuid,"note" text,"is_demo" boolean DEFAULT false,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.onboarding_budgets("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"project_id" uuid,"approved_amount" numeric(12,2),"approved_basis" text,"approved_by" uuid,"approved_at" timestamp with time zone,"notes" text,"is_demo" boolean DEFAULT false,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.onboarding_daily_reminders("user_id" uuid,"local_day" date,"time_zone" text,"task_ids" uuid[] DEFAULT '{}'::uuid[],"notification_id" uuid,"emailed_to" text,"email_status" text DEFAULT 'pending'::text,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.onboarding_flag_snapshots("snapshot_key" text,"table_name" text,"row_id" uuid,"blocks_handoff" boolean,"is_required" boolean,"updated_at" timestamp with time zone,"taken_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.onboarding_follows("user_id" uuid,"property_id" uuid,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.onboarding_notes("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"task_id" uuid,"body" text,"mentions" uuid[] DEFAULT '{}'::uuid[],"internal" boolean DEFAULT true,"author_id" uuid,"is_demo" boolean DEFAULT false,"archived_at" timestamp with time zone,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"kind" text DEFAULT 'note'::text);
CREATE TABLE public.onboarding_project_events("id" uuid DEFAULT gen_random_uuid(),"project_id" uuid,"property_id" uuid,"kind" text,"summary" text,"detail" text,"prior_value" text,"new_value" text,"actor" uuid,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.onboarding_project_stagers("id" uuid DEFAULT gen_random_uuid(),"project_id" uuid,"vendor_org_id" uuid,"added_by" uuid,"added_at" timestamp with time zone DEFAULT now(),"removed_at" timestamp with time zone,"removed_by" uuid);
CREATE TABLE public.onboarding_projects("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"status" text DEFAULT 'active'::text,"branch" text,"project_manager" uuid,"director" uuid,"planned_closing_on" date,"possession_on" date,"target_handoff_on" date,"furnishing_scope" text DEFAULT 'full_furnishing'::text,"modules" text[] DEFAULT '{}'::text[],"external_refs" jsonb DEFAULT '{}'::jsonb,"notes" text,"started_by" uuid,"started_at" timestamp with time zone DEFAULT now(),"completed_at" timestamp with time zone,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"target_handoff_source" text DEFAULT 'auto'::text,"pool_location" text DEFAULT 'none'::text,"utility_manager" uuid,"template_version_id" uuid,"handoff_state" text DEFAULT 'in_progress'::text,"ready_for_ops_at" timestamp with time zone,"ready_for_ops_by" uuid,"ops_accepted_at" timestamp with time zone,"ops_accepted_by" uuid,"role_assignments" jsonb DEFAULT '{}'::jsonb,"staging_provider" text,"owner_type" text,"project_status" text,"pma_status" text,"invoice_status" text,"greater_area" text,"weekly_status" text,"committed_handoff_on" date,"committed_handoff_set_at" timestamp with time zone,"committed_handoff_set_by" uuid,"inspection_on" date,"closed_reason" text,"closed_at" timestamp with time zone,"closed_by" uuid,"telegram_url" text,"loa_status" text);
CREATE TABLE public.onboarding_step_review_settings("template_task_id" uuid,"reviewer_roles" text[] DEFAULT '{}'::text[],"time_limit_business_days" integer DEFAULT 1,"alerts_enabled" boolean DEFAULT false,"blocks" text DEFAULT 'nothing'::text,"blocked_step_ids" uuid[] DEFAULT '{}'::uuid[],"blocked_stage" text,"updated_by" uuid,"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.onboarding_step_review_settings_history("id" uuid DEFAULT gen_random_uuid(),"template_task_id" uuid,"before_value" jsonb,"after_value" jsonb,"changed_by" uuid,"changed_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.onboarding_task_batches("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"project_id" uuid,"action" text,"actor" uuid,"detail" jsonb DEFAULT '{}'::jsonb,"task_rows" jsonb DEFAULT '[]'::jsonb,"cards" jsonb DEFAULT '[]'::jsonb,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now(),"undo_until" timestamp with time zone DEFAULT (now() + '00:10:00'::interval),"undone_at" timestamp with time zone,"undone_by" uuid,"undo_result" jsonb);
CREATE TABLE public.onboarding_task_breezeway_events("id" uuid DEFAULT gen_random_uuid(),"task_id" uuid,"property_id" uuid,"actor" uuid,"before_value" jsonb,"after_value" jsonb,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.onboarding_task_breezeway_links("task_id" uuid,"property_id" uuid,"tentative_date" date,"assignee_choice" text,"breezeway_person_id" bigint,"assignee_name" text,"breezeway_task_id" bigint,"breezeway_url" text,"is_demo" boolean DEFAULT false,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_by" uuid,"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.onboarding_task_file_links("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"receiving_task_id" uuid,"source_task_id" uuid,"origin" text,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"removed_at" timestamp with time zone,"removed_by" uuid);
CREATE TABLE public.onboarding_task_review_decisions("id" uuid DEFAULT gen_random_uuid(),"review_id" uuid,"role_code" text,"reviewer_id" uuid,"decision" text,"note" text,"decided_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.onboarding_task_review_events("id" uuid DEFAULT gen_random_uuid(),"task_id" uuid,"review_id" uuid,"kind" text,"actor_id" uuid,"role_code" text,"note" text,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.onboarding_task_reviews("id" uuid DEFAULT gen_random_uuid(),"task_id" uuid,"property_id" uuid,"project_id" uuid,"round" integer DEFAULT 1,"status" text DEFAULT 'pending'::text,"reviewer_roles" text[] DEFAULT '{}'::text[],"submitted_by" uuid,"submitted_at" timestamp with time zone DEFAULT now(),"due_at" timestamp with time zone,"alerts_enabled" boolean DEFAULT false,"overdue_alerted_at" timestamp with time zone,"closed_at" timestamp with time zone,"is_demo" boolean DEFAULT false);
CREATE TABLE public.onboarding_task_stage_history("id" uuid DEFAULT gen_random_uuid(),"task_id" uuid,"property_id" uuid,"from_stage" text,"to_stage" text,"legacy_stage" text,"assigned_seat" text,"assigned_to" uuid,"changed_by" uuid,"reason" text,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.onboarding_task_work_order_watch("id" uuid DEFAULT gen_random_uuid(),"outbound_id" uuid,"task_id" uuid,"property_id" uuid,"breezeway_task_id" bigint,"completed_at" timestamp with time zone DEFAULT now(),"completed_by" uuid,"state" text DEFAULT 'watching'::text,"reopen_kind" text,"reopen_reason" text,"reopened_at" timestamp with time zone,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.onboarding_tasks("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"stage" text DEFAULT 'setup'::text,"title" text,"detail" text,"assigned_to" uuid,"due_on" date,"blocker" text,"requires_owner_approval" boolean DEFAULT false,"owner_approval_status" text DEFAULT 'not_required'::text,"evidence_note" text,"evidence_required" boolean DEFAULT false,"status" text DEFAULT 'open'::text,"blocks_handoff" boolean DEFAULT true,"carryover_of" uuid,"carryover_reason" text,"completed_at" timestamp with time zone,"completed_by" uuid,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"parent_task_id" uuid,"depends_on" uuid[] DEFAULT '{}'::uuid[],"sort_order" integer DEFAULT 0,"exception_reason" text,"exception_by" uuid,"exception_at" timestamp with time zone,"linked_ticket_id" uuid,"archived_at" timestamp with time zone,"archived_by" uuid,"is_demo" boolean DEFAULT false,"schedule_anchor" text,"schedule_offset_days" integer,"due_on_overridden" boolean DEFAULT false,"due_on_source" text,"assigned_seat" text,"legacy_stage" text,"tags" text[] DEFAULT '{}'::text[],"template_task_id" uuid,"is_required" boolean DEFAULT true,"owner_dependency" text,"description" text,"done_when" text,"video_url" text,"schedule_offset_unit" text DEFAULT 'calendar'::text,"started_at" timestamp with time zone,"started_by" uuid,"task_kind" text DEFAULT 'do_it'::text,"kind_settings" jsonb DEFAULT '{}'::jsonb,"follow_up_of" uuid,"is_one_off" boolean DEFAULT false);
CREATE TABLE public.onboarding_template_stages("id" uuid DEFAULT gen_random_uuid(),"template_id" uuid,"name" text,"sort_order" integer DEFAULT 0,"active" boolean DEFAULT true,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.onboarding_template_tasks("id" uuid DEFAULT gen_random_uuid(),"template_id" uuid,"stage" text,"title" text,"role" text,"detail" text,"sort_order" integer DEFAULT 0,"blocks_handoff" boolean DEFAULT false,"requires_owner_approval" boolean DEFAULT false,"owner_approval_when_active_owner" boolean DEFAULT false,"evidence_required" boolean DEFAULT false,"schedule_anchor" text,"offset_days" integer,"breezeway_template_id" text,"subtasks" text[] DEFAULT '{}'::text[],"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"tags" text[] DEFAULT '{}'::text[],"is_required" boolean DEFAULT true,"is_active" boolean DEFAULT true,"functional_role" text,"module" text,"condition" jsonb,"opportunity" jsonb,"owner_dependency" text,"description" text,"done_when" text,"video_url" text,"offset_unit" text DEFAULT 'calendar'::text,"show_files_from" uuid[] DEFAULT '{}'::uuid[],"task_kind" text DEFAULT 'do_it'::text,"kind_settings" jsonb DEFAULT '{}'::jsonb);
CREATE TABLE public.onboarding_template_versions("id" uuid DEFAULT gen_random_uuid(),"template_id" uuid,"version" integer,"snapshot" jsonb,"published_at" timestamp with time zone DEFAULT now(),"published_by" uuid);
CREATE TABLE public.onboarding_templates("id" uuid DEFAULT gen_random_uuid(),"key" text,"name" text,"description" text,"is_default" boolean DEFAULT false,"is_archived" boolean DEFAULT false,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.oncall_roster("id" uuid DEFAULT gen_random_uuid(),"starts_on" date,"ends_on" date,"user_id" uuid,"label" text,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.owner_alert_log("id" uuid DEFAULT gen_random_uuid(),"program_id" uuid,"alert_kind" text,"severity" integer DEFAULT 0,"status_at_send" text,"sent_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.owner_approval_publications("id" uuid DEFAULT gen_random_uuid(),"approval_id" uuid,"revision" integer,"approval_updated_at" timestamp with time zone,"program_id" uuid,"owner_record_id" uuid,"property_id" uuid,"recipient_id" uuid,"entity_type" text,"entity_id" uuid,"title" text,"detail" text,"amount" numeric,"currency" text,"property_name" text,"due_on" date,"reviewed_by" uuid,"reviewed_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.owner_approval_receipts("approval_id" uuid,"publication_id" uuid,"status" text,"decision_note" text,"decided_at" timestamp with time zone,"actor_id" uuid);
CREATE TABLE public.owner_badges("id" uuid DEFAULT gen_random_uuid(),"program_id" uuid,"code" text,"awarded_at" timestamp with time zone DEFAULT now(),"trigger_rule" text,"supporting" jsonb DEFAULT '{}'::jsonb,"needs_review" boolean DEFAULT false,"review_note" text);
CREATE TABLE public.owner_closing_update_events("id" uuid DEFAULT gen_random_uuid(),"update_id" uuid,"property_id" uuid,"action" text,"detail" jsonb DEFAULT '{}'::jsonb,"actor_id" uuid,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.owner_closing_updates("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"update_no" smallint,"closing_on" date,"send_on" date,"send_at" timestamp with time zone,"time_zone" text,"status" text DEFAULT 'scheduled'::text,"status_reason" text,"edited_subject" text,"edited_body" text,"edited_by" uuid,"edited_at" timestamp with time zone,"held_by" uuid,"held_at" timestamp with time zone,"preview_notified_at" timestamp with time zone,"channel" text,"sent_subject" text,"sent_body" text,"sent_to" text[],"sent_at" timestamp with time zone,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.owner_completion_reviews("id" uuid DEFAULT gen_random_uuid(),"work_item_id" uuid,"status" text,"internal_note" text,"follow_up_task_id" uuid,"owner_feedback_message_id" uuid,"actor_id" uuid,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.owner_contact_alerts("id" uuid DEFAULT gen_random_uuid(),"program_id" uuid,"notification_id" uuid,"ticket_id" uuid,"priority" text DEFAULT 'p1'::text,"owner_name" text,"owner_phone" text,"owner_email" text,"title" text,"body" text DEFAULT ''::text,"reason" text DEFAULT 'Urgent matter — reach this homeowner by text or phone.'::text,"status" text DEFAULT 'pending'::text,"handled_by" uuid,"handled_at" timestamp with time zone,"handled_note" text,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.owner_decision_reminders("work_item_id" uuid,"notification_id" uuid,"due_on" date,"sent_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.owner_followup_tasks("id" uuid DEFAULT gen_random_uuid(),"program_id" uuid,"property_id" uuid,"assigned_to" uuid,"route_reason" text,"no_project_manager" boolean DEFAULT false,"item_count" integer,"title" text,"link_path" text,"status" text DEFAULT 'open'::text,"closed_by" uuid,"closed_at" timestamp with time zone,"close_note" text,"is_demo" boolean DEFAULT true,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.owner_invite_redemptions("invite_id" uuid,"program_id" uuid,"owner_record_id" uuid,"user_id" uuid,"recipient_email" text,"email_verified_at" timestamp with time zone,"property_ids" uuid[],"program_version" uuid,"redeemed_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.owner_invites("id" uuid DEFAULT gen_random_uuid(),"code" text,"program_id" uuid,"owner_email" text,"expires_at" timestamp with time zone DEFAULT (now() + '60 days'::interval),"redeemed_by" uuid,"redeemed_at" timestamp with time zone,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.owner_item_task_sends("review_id" uuid,"task_id" uuid,"property_id" uuid,"program_id" uuid,"sent_by" uuid,"sent_at" timestamp with time zone DEFAULT now(),"note" text,"is_demo" boolean DEFAULT false);
CREATE TABLE public.owner_library_videos("id" uuid DEFAULT gen_random_uuid(),"library_id" uuid,"storage_bucket" text DEFAULT 'resolve-attachments'::text,"storage_path" text,"mime_type" text,"size_bytes" bigint,"label" text DEFAULT 'Watch the walkthrough'::text,"uploaded_by" uuid,"uploaded_at" timestamp with time zone DEFAULT now(),"removed_at" timestamp with time zone,"removed_by" uuid,"removal_reason" text,"replaced_by" uuid);
CREATE TABLE public.owner_notifications("id" uuid DEFAULT gen_random_uuid(),"program_id" uuid,"owner_user_id" uuid,"ticket_id" uuid,"review_id" uuid,"kind" text,"priority" text DEFAULT 'p3'::text,"title" text,"body" text DEFAULT ''::text,"action_path" text,"read_at" timestamp with time zone,"email_status" text DEFAULT 'pending'::text,"sms_status" text DEFAULT 'skipped'::text,"delivery_error" text,"delivered_at" timestamp with time zone,"created_at" timestamp with time zone DEFAULT now(),"is_demo" boolean DEFAULT false,"email_job_run_id" uuid);
CREATE TABLE public.owner_opportunity_library("id" uuid DEFAULT gen_random_uuid(),"title" text,"summary" text DEFAULT ''::text,"what" text DEFAULT ''::text,"why" text DEFAULT ''::text,"how" text DEFAULT ''::text,"ways_to_document" text DEFAULT ''::text,"suggested_minutes" integer,"category" text DEFAULT 'research'::text,"image_key" text DEFAULT 'research'::text,"tags" text[] DEFAULT '{}'::text[],"resource_label" text,"resource_url" text,"active" boolean DEFAULT true,"sort_order" integer DEFAULT 0,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.owner_program_events("id" uuid DEFAULT gen_random_uuid(),"program_id" uuid,"property_id" uuid,"entry_id" uuid,"review_id" uuid,"kind" text,"summary" text,"detail" jsonb DEFAULT '{}'::jsonb,"previous_value" text,"new_value" text,"reason" text,"actor_id" uuid,"actor_label" text,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.owner_program_properties("id" uuid DEFAULT gen_random_uuid(),"program_id" uuid,"property_id" uuid,"closing_date" date,"closing_confirmed" boolean DEFAULT false,"added_on" date DEFAULT CURRENT_DATE,"added_by" uuid,"inclusion_status" text DEFAULT 'included'::text,"onboarding_status" text DEFAULT 'not_started'::text,"launch_status" text DEFAULT 'not_ready'::text,"coverage_status" text DEFAULT 'no_activity'::text,"last_owner_activity_at" timestamp with time zone,"notes" text,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"is_demo" boolean DEFAULT false,"archived_at" timestamp with time zone);
CREATE TABLE public.owner_program_rules("id" uuid DEFAULT gen_random_uuid(),"key" text,"label" text,"description" text,"value" jsonb DEFAULT '{}'::jsonb,"updated_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.owner_programs("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"owner_user_id" uuid,"owner_name" text,"owner_email" text,"status" text DEFAULT 'pending'::text,"started_on" date,"ends_on" date,"target_hours" numeric(6,2) DEFAULT 100,"onboarding_target_hours" numeric(6,2) DEFAULT 60,"ongoing_target_hours" numeric(6,2) DEFAULT 40,"notes" text,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"owner_phone" text,"notify_email" boolean DEFAULT true,"notify_sms_p1" boolean DEFAULT true,"notify_push" boolean DEFAULT true,"activated_by" uuid,"activated_at" timestamp with time zone,"operating_target_hours" numeric DEFAULT 105,"onboarding_milestone_hours" numeric DEFAULT 60,"onboarding_milestone_day" integer DEFAULT 35,"onboarding_lead" uuid,"operations_lead" uuid,"dfy_confirmed" boolean DEFAULT false,"dfy_confirmed_at" timestamp with time zone,"internal_notes" text,"completed_at" timestamp with time zone,"completed_by" uuid,"last_owner_activity_at" timestamp with time zone,"is_demo" boolean DEFAULT false,"archived_at" timestamp with time zone,"archived_by" uuid,"archive_reason" text,"completion_report" jsonb,"report_version" uuid DEFAULT gen_random_uuid(),"owner_record_id" uuid,"pace_emails_held_until" timestamp with time zone);
CREATE TABLE public.owner_request_messages("id" uuid DEFAULT gen_random_uuid(),"work_item_id" uuid,"property_id" uuid,"program_id" uuid,"task_id" uuid,"author_id" uuid,"author_type" text,"author_name" text,"event" text,"body" text,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now(),"request_kind" text,"review_id" uuid);
CREATE TABLE public.owner_review_properties("id" uuid DEFAULT gen_random_uuid(),"review_id" uuid,"property_id" uuid,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.owner_reviews("id" uuid DEFAULT gen_random_uuid(),"program_id" uuid,"template_id" uuid,"ticket_id" uuid,"phase" text,"stage" text,"title" text,"recommendation" text,"evidence" text,"impact" text,"decision_path" text DEFAULT 'consult'::text,"respond_by" date,"status" text DEFAULT 'prepared'::text,"owner_decision" text,"owner_response" text,"notified_at" timestamp with time zone,"responded_at" timestamp with time zone,"closed_at" timestamp with time zone,"outcome" text,"sort_order" integer DEFAULT 0,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"task_type" text DEFAULT 'program_wide'::text,"property_id" uuid,"business_question" text,"attachment_path" text,"is_demo" boolean DEFAULT false,"archived_at" timestamp with time zone,"photos" jsonb DEFAULT '[]'::jsonb,"source_type" text DEFAULT 'program'::text,"onboarding_task_id" uuid,"owner_action_type" text DEFAULT 'review_comment'::text,"available_from" timestamp with time zone,"staff_context" text,"auto_ticket" boolean DEFAULT false);
CREATE TABLE public.owner_task_templates("id" uuid DEFAULT gen_random_uuid(),"phase" text,"stage" text,"code" text,"title" text,"summary" text,"owner_action" text,"decision_path" text DEFAULT 'consult'::text,"planning_hours_low" numeric(5,2) DEFAULT 0,"planning_hours_high" numeric(5,2) DEFAULT 0,"respond_within_days" integer DEFAULT 5,"recurring" boolean DEFAULT false,"sort_order" integer DEFAULT 0,"active" boolean DEFAULT true,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"owner_action_type" text DEFAULT 'review_comment'::text);
CREATE TABLE public.owner_time_entries("id" uuid DEFAULT gen_random_uuid(),"program_id" uuid,"review_id" uuid,"owner_user_id" uuid,"phase" text,"entry_date" date DEFAULT CURRENT_DATE,"minutes" integer,"activity" text,"materials_reviewed" text,"output" text,"attested" boolean DEFAULT false,"amends_entry_id" uuid,"created_at" timestamp with time zone DEFAULT now(),"ticket_id" uuid,"activity_category" text,"decision_outcome" text,"comments" text,"attachment_path" text,"correction_reason" text,"review_status" text DEFAULT 'submitted'::text,"reviewed_by" uuid,"reviewed_at" timestamp with time zone,"review_note" text,"flagged" boolean DEFAULT false,"is_demo" boolean DEFAULT false,"owner_update_revision" integer,"owner_update_snapshot" jsonb,"review_version" uuid DEFAULT gen_random_uuid(),"attachment_paths" jsonb DEFAULT '[]'::jsonb);
CREATE TABLE public.owner_time_entry_properties("id" uuid DEFAULT gen_random_uuid(),"entry_id" uuid,"property_id" uuid,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.owner_weekly_update_events("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"update_id" uuid,"action" text,"detail" jsonb DEFAULT '{}'::jsonb,"actor_id" uuid,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.owner_weekly_update_settings("property_id" uuid,"auto_send" boolean DEFAULT false,"paused" boolean DEFAULT false,"updated_by" uuid,"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.owner_weekly_updates("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"week_start" date,"draft_text" text,"edited_text" text,"edited_by" uuid,"edited_at" timestamp with time zone,"status" text DEFAULT 'draft'::text,"sent_text" text,"sent_by" uuid,"sent_at" timestamp with time zone,"sent_automatically" boolean DEFAULT false,"owner_notification_id" uuid,"email_log_id" uuid,"skipped_at" timestamp with time zone,"skip_reason" text,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.owner_welcome_messages("id" uuid DEFAULT gen_random_uuid(),"program_id" uuid,"owner_user_id" uuid,"property_id" uuid,"recipient" text,"status" text DEFAULT 'queued'::text,"template_version" integer,"subject" text,"body" text,"video_url" text,"attempts" integer DEFAULT 0,"error_message" text,"queued_by" uuid,"queued_at" timestamp with time zone DEFAULT now(),"sent_at" timestamp with time zone,"is_demo" boolean DEFAULT false);
CREATE TABLE public.ownerrez_listing_cache("listing_id" text,"name" text,"city" text,"state" text,"added_on" date,"checked_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.ownerrez_listing_dismissals("id" uuid DEFAULT gen_random_uuid(),"listing_id" text,"listing_name" text,"reason" text,"dismissed_by" uuid,"dismissed_at" timestamp with time zone DEFAULT now(),"restored_at" timestamp with time zone,"restored_by" uuid);
CREATE TABLE public.pid_sync_review_items("id" uuid DEFAULT gen_random_uuid(),"run_id" uuid,"property_id" uuid,"home" text,"ownerrez_id" text,"field_key" text,"kind" text,"resolve_value" text,"notion_value" text,"reason" text,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.playbook_approvals("id" uuid DEFAULT gen_random_uuid(),"playbook_id" uuid,"from_status" text,"to_status" text,"actor_id" uuid,"actor_role" text,"note" text,"created_at" timestamp with time zone DEFAULT now(),"version" integer);
CREATE TABLE public.playbook_steps("id" uuid DEFAULT gen_random_uuid(),"playbook_id" uuid,"position" integer,"instruction" text,"detail" text,"required" boolean DEFAULT true,"photo_required" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.playbooks("id" uuid DEFAULT gen_random_uuid(),"category" text,"title" text,"summary" text,"active" boolean DEFAULT true,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"playbook_key" text,"version" integer DEFAULT 1,"status" text DEFAULT 'active'::text,"effective_on" date,"approved_by" uuid,"applies_to" text[] DEFAULT ARRAY['ticket'::text],"matcher" jsonb DEFAULT '{}'::jsonb,"priority_reason" text,"risk_flags" jsonb DEFAULT '[]'::jsonb,"immediate_actions" text[] DEFAULT ARRAY[]::text[],"escalate_if" text[] DEFAULT ARRAY[]::text[],"vendor_brief" jsonb,"source" text DEFAULT 'authored'::text,"source_refs" text[] DEFAULT '{}'::text[],"supersedes_id" uuid,"requires_director" boolean DEFAULT false,"submitted_by" uuid,"submitted_at" timestamp with time zone,"approved_at" timestamp with time zone,"retired_at" timestamp with time zone,"review_note" text,"source_version" text,"generated_at" timestamp with time zone,"required_evidence" text[] DEFAULT '{}'::text[],"checklist" jsonb,"checklist_category" text,"sop_url" text);
CREATE TABLE public.profiles("id" uuid,"full_name" text,"email" text,"phone" text,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"oncall_eligible" boolean DEFAULT false,"email_signature" text,"avatar_url" text,"job_title" text,"first_name" text,"last_name" text,"removed_at" timestamp with time zone,"removed_by" uuid,"archived_at" timestamp with time zone,"archived_by" uuid,"time_zone" text DEFAULT 'America/Chicago'::text);
CREATE TABLE public.program_members("id" uuid DEFAULT gen_random_uuid(),"program_id" uuid,"user_id" uuid,"role" text,"added_by" uuid,"added_at" timestamp with time zone DEFAULT now(),"removed_at" timestamp with time zone,"removed_by" uuid);
CREATE TABLE public.properties("id" uuid DEFAULT gen_random_uuid(),"name" text,"nickname" text,"address_line1" text,"city" text,"state" text,"postal_code" text,"unit" text,"access_notes" text,"wifi_notes" text,"notes" text,"active" boolean DEFAULT true,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"ownerrez_property_id" text,"ownerrez_synced_at" timestamp with time zone,"breezeway_property_id" text,"breezeway_synced_at" timestamp with time zone,"latitude" double precision,"longitude" double precision,"formatted_address" text,"geocode_status" text,"geocoded_at" timestamp with time zone,"last_quarterly_review_at" timestamp with time zone,"quarterly_review_due_on" date DEFAULT CURRENT_DATE,"lifecycle_status" text DEFAULT 'not_onboarded'::text,"onboarding_stage" text,"onboarding_owner" uuid,"onboarding_started_at" timestamp with time zone,"handoff_accepted_at" timestamp with time zone,"archived_at" timestamp with time zone,"archive_reason" text,"market" text,"is_demo" boolean DEFAULT false,"planned_closing_on" date,"actual_closing_on" date,"actual_access_on" date,"breezeway_mapping_state" text DEFAULT 'unmapped'::text,"breezeway_mapping_verified_at" timestamp with time zone,"breezeway_mapping_note" text,"owner_record_id" uuid,"ownerrez_owner_id" text,"primary_photo_url" text,"primary_photo_medium_url" text,"primary_photo_thumb_url" text,"primary_photo_source" text,"primary_photo_synced_at" timestamp with time zone,"bedrooms" integer,"bathrooms" numeric,"max_guests" integer,"living_area_sqft" integer,"property_type" text,"check_in_time" text,"check_out_time" text,"time_zone" text,"listing_public_url" text,"listing_alias" text,"neighborhood" text,"tier" text,"min_stay_months" integer,"year_built" integer,"instant_book" boolean,"furniture_package" text,"legacy_handoff_date" date,"operating_notes" text,"facts" jsonb DEFAULT '{}'::jsonb,"parking" jsonb DEFAULT '{}'::jsonb,"access" jsonb DEFAULT '{}'::jsonb,"utilities" jsonb DEFAULT '{}'::jsonb,"hvac" jsonb DEFAULT '{}'::jsonb,"systems" jsonb DEFAULT '{}'::jsonb,"fireplace" jsonb DEFAULT '{}'::jsonb,"storm_shelter" jsonb DEFAULT '{}'::jsonb,"sprinklers" jsonb DEFAULT '{}'::jsonb,"grounds" jsonb DEFAULT '{}'::jsonb,"waste" jsonb DEFAULT '{}'::jsonb,"pool_spa" jsonb DEFAULT '{}'::jsonb,"hoa" jsonb DEFAULT '{}'::jsonb,"amenities" jsonb DEFAULT '{}'::jsonb,"security" jsonb DEFAULT '{}'::jsonb,"warranty" jsonb DEFAULT '{}'::jsonb,"compliance" jsonb DEFAULT '{}'::jsonb,"external_refs" jsonb DEFAULT '{}'::jsonb,"geocode_source" text,"geocode_address_fingerprint" text,"coords_overridden_by" uuid,"coords_overridden_at" timestamp with time zone,"coords_override_reason" text,"guidebook_url" text);
CREATE TABLE public.property_activity_log("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"occurred_at" timestamp with time zone DEFAULT now(),"category" text,"what_happened" text,"outcome" text,"involved" text,"logged_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"is_demo" boolean DEFAULT false,"attachment_document_ids" uuid[] DEFAULT '{}'::uuid[],"problem_type_id" uuid,"one_touch" boolean DEFAULT false);
CREATE TABLE public.property_assets("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"name" text,"kind" text,"manufacturer" text,"model" text,"serial_number" text,"location" text,"warranty_notes" text,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"archived_at" timestamp with time zone,"is_demo" boolean DEFAULT false);
CREATE TABLE public.property_credentials("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"category" credential_category DEFAULT 'other'::credential_category,"label" text,"username" text,"secret_ciphertext" text,"secret_nonce" text,"instructions" text,"last_verified_on" date,"verified_by" uuid,"source" text DEFAULT 'staff_entry'::text,"sort_order" integer DEFAULT 0,"active" boolean DEFAULT true,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.property_external_links("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"kind" text,"label" text,"url" text,"context" text,"staff_only" boolean DEFAULT true,"canonical" boolean DEFAULT false,"needs_replacement" boolean DEFAULT false,"source" text DEFAULT 'notion_pid'::text,"source_field" text,"as_of" timestamp with time zone,"note" text,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.property_fact_proposals("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"project_id" uuid,"task_id" uuid,"field_key" text,"field_label" text,"current_value" text,"proposed_value" text,"source" text DEFAULT 'field_capture'::text,"source_detail" text,"status" text DEFAULT 'pending'::text,"proposed_by" uuid,"reviewed_by" uuid,"reviewed_at" timestamp with time zone,"decision_note" text,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now(),"asset_id" uuid);
CREATE TABLE public.property_field_provenance("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"field_key" text,"value_source" text,"source_record_id" text,"as_of" timestamp with time zone DEFAULT now(),"note" text,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.property_handoffs("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"status" text DEFAULT 'requested'::text,"requested_by" uuid,"requested_at" timestamp with time zone DEFAULT now(),"checklist" jsonb DEFAULT '[]'::jsonb,"validation" jsonb DEFAULT '{}'::jsonb,"open_task_ids" uuid[] DEFAULT '{}'::uuid[],"carryover_accepted" boolean DEFAULT false,"reviewed_by" uuid,"reviewed_at" timestamp with time zone,"corrections" text,"notes" text,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"gate_step" text DEFAULT 'kati_review'::text,"kati_reviewer" uuid,"kati_decision" text,"kati_note" text,"kati_at" timestamp with time zone,"micah_reviewer" uuid,"micah_decision" text,"micah_note" text,"micah_at" timestamp with time zone,"accepted_by" uuid,"accepted_at" timestamp with time zone,"live_confirmed_by" uuid,"live_confirmed_at" timestamp with time zone,"exceptions" jsonb DEFAULT '[]'::jsonb,"archived_at" timestamp with time zone,"is_demo" boolean DEFAULT false,"financial_status" text DEFAULT 'open'::text,"financial_reconciled_by" uuid,"financial_reconciled_at" timestamp with time zone,"financial_note" text);
CREATE TABLE public.property_label_assignments("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"label_id" uuid,"added_by" uuid,"added_at" timestamp with time zone DEFAULT now(),"removed_by" uuid,"removed_at" timestamp with time zone);
CREATE TABLE public.property_label_events("id" uuid DEFAULT gen_random_uuid(),"label_id" uuid,"property_id" uuid,"action" text,"from_name" text,"to_name" text,"actor_id" uuid,"actor_label" text,"at" timestamp with time zone DEFAULT now());
CREATE TABLE public.property_labels("id" uuid DEFAULT gen_random_uuid(),"name" text,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"renamed_by" uuid,"renamed_at" timestamp with time zone,"retired_by" uuid,"retired_at" timestamp with time zone,"system_key" text);
CREATE TABLE public.property_owner_contacts("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"owner_name" text,"owner_email" text,"owner_phone" text,"source" text,"source_id" text,"match_status" text DEFAULT 'matched'::text,"candidate_count" integer DEFAULT 1,"detail" text,"synced_at" timestamp with time zone DEFAULT now(),"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.property_owner_team_note_events("id" uuid DEFAULT gen_random_uuid(),"owner_id" uuid,"before_text" text,"after_text" text,"actor_id" uuid,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.property_owners("id" uuid DEFAULT gen_random_uuid(),"source" text DEFAULT 'ownerrez'::text,"source_owner_id" text,"name" text,"email" text,"phone" text,"city" text,"state" text,"postal_code" text,"active" boolean DEFAULT true,"notes" text,"synced_at" timestamp with time zone DEFAULT now(),"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"co_owner_name" text,"co_owner_email" text,"co_owner_phone" text,"preferred_method" text,"telegram" text,"team_notes" text,"team_notes_updated_at" timestamp with time zone,"team_notes_updated_by" uuid);
CREATE TABLE public.property_pid_extra_fields("property_id" uuid,"field_name" text,"field_type" text,"value" jsonb,"as_of" timestamp with time zone,"synced_on" date,"source_page_id" text,"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.property_profile_edits("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"card" text,"item_key" text,"label" text,"old_value" jsonb,"new_value" jsonb,"edited_by" uuid,"edited_by_label" text,"edited_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.property_profile_photos("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"item_key" text,"document_id" uuid,"added_by" uuid,"added_at" timestamp with time zone DEFAULT now(),"removed_by" uuid,"removed_at" timestamp with time zone);
CREATE TABLE public.property_vendor_coverage("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"org_id" uuid,"service_category" text,"coverage_priority" text DEFAULT 'primary'::text,"effective_from" date DEFAULT CURRENT_DATE,"effective_to" date,"rate_note" text,"playbook_id" uuid,"approval_limit" numeric,"access_requirements" text,"last_verified_at" timestamp with time zone,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"excluded" boolean DEFAULT false,"exclusion_reason" text);
CREATE TABLE public.property_work_records("id" uuid DEFAULT gen_random_uuid(),"record_key" text,"source_code" text,"source_ref" text,"person_id" uuid,"property_id" uuid,"work_date" date,"minutes" numeric(8,2),"method" text,"confidence" text DEFAULT 'medium'::text,"review_state" text DEFAULT 'auto'::text,"reason" text,"supersedes_id" uuid,"superseded_at" timestamp with time zone,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"is_fixture" boolean DEFAULT false);
CREATE TABLE public.property_work_sources("code" text,"label" text,"activity_category" text,"counts_toward_cleaner_safeguard" boolean DEFAULT false,"active" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.report_legacy_card_map("id" uuid DEFAULT gen_random_uuid(),"match_kind" text,"match_value" text,"card_code" text,"approved_by" uuid,"approved_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.report_wording_uses("id" uuid DEFAULT gen_random_uuid(),"program_id" uuid,"report_kind" text,"report_ref" uuid,"file_format" text,"wording_version" integer,"generated_by" uuid,"generated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.report_wording_versions("version" integer,"sentences" jsonb,"note" text,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.routine_check_corrections("id" uuid DEFAULT gen_random_uuid(),"routine_control_id" uuid,"corrected_by" uuid,"corrected_at" timestamp with time zone DEFAULT now(),"note" text,"is_demo" boolean DEFAULT false);
CREATE TABLE public.routine_controls("id" uuid DEFAULT gen_random_uuid(),"kind" text,"event_key" text,"property_id" uuid,"ticket_id" uuid,"follow_up_ticket_id" uuid,"status" text DEFAULT 'due'::text,"outcome" text,"title" text,"guest_name" text,"reservation_confirmation" text,"reservation_channel" text,"stay_arrival" date,"stay_departure" date,"due_at" timestamp with time zone DEFAULT now(),"assigned_to" uuid,"assigned_role_code" text,"team" text,"findings" text,"notes" text,"contact_result" text,"evidence_urls" text[] DEFAULT '{}'::text[],"completed_by" uuid,"completed_at" timestamp with time zone,"created_by" uuid,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"answers" jsonb DEFAULT '{}'::jsonb,"guest_feedback_id" uuid);
CREATE TABLE public.saved_views("id" uuid DEFAULT gen_random_uuid(),"user_id" uuid,"page" text,"kind" text DEFAULT 'view'::text,"name" text DEFAULT ''::text,"filters" jsonb DEFAULT '{}'::jsonb,"view" text,"sort" text,"columns" text[] DEFAULT '{}'::text[],"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"archived_at" timestamp with time zone);
CREATE TABLE public.scorecard_records("id" uuid DEFAULT gen_random_uuid(),"kind" text,"recorded_by" uuid,"recorded_at" timestamp with time zone DEFAULT now(),"about_user_id" uuid,"property_id" uuid,"stay_ref" text,"ticket_id" uuid,"note" text,"details" jsonb DEFAULT '{}'::jsonb,"refers_to" uuid,"about_imported_ticket" boolean DEFAULT false,"is_demo" boolean DEFAULT false);
CREATE TABLE public.shift_end_records("id" uuid DEFAULT gen_random_uuid(),"user_id" uuid,"kind" text DEFAULT 'end_of_shift'::text,"ended_at" timestamp with time zone DEFAULT now(),"nothing_to_hand_off" boolean DEFAULT false,"ticket_ids" uuid[] DEFAULT '{}'::uuid[],"handoff_ids" uuid[] DEFAULT '{}'::uuid[],"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.sop_playbooks("playbook_id" uuid,"sop_version_id" uuid,"checklist_categories" text[] DEFAULT '{}'::text[]);
CREATE TABLE public.sop_versions("id" uuid DEFAULT gen_random_uuid(),"title" text,"original_name" text,"version" integer,"owner_id" uuid,"effective_on" date,"uploaded_by" uuid,"uploaded_at" timestamp with time zone DEFAULT now(),"file_url" text,"drive_id" text,"file_id" text,"state" text DEFAULT 'reserved'::text,"draft_ids" uuid[] DEFAULT '{}'::uuid[]);
CREATE TABLE public.special_handling("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"rule_type" text,"trade" text,"title" text,"instruction" text,"vendor_org_id" uuid,"vendor_name" text,"threshold_amount" numeric,"owner_notification_required" boolean DEFAULT false,"applies_to" text[] DEFAULT '{}'::text[],"severity" text DEFAULT 'standard'::text,"active" boolean DEFAULT true,"source" text,"created_by" uuid,"updated_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.staff_notifications("id" uuid DEFAULT gen_random_uuid(),"user_id" uuid,"kind" text,"title" text,"body" text DEFAULT ''::text,"entity_type" text,"entity_id" uuid,"link_path" text,"priority" text DEFAULT 'normal'::text,"actor_id" uuid,"read_at" timestamp with time zone,"email_status" text DEFAULT 'none'::text,"email_attempts" integer DEFAULT 0,"email_error" text,"delivered_at" timestamp with time zone,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now(),"retracted_at" timestamp with time zone,"retracted_by" uuid,"retracted_reason" text);
CREATE TABLE public.staff_review_preference_history("id" uuid DEFAULT gen_random_uuid(),"user_id" uuid,"before_value" boolean,"after_value" boolean,"changed_by" uuid,"changed_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.staff_review_preferences("user_id" uuid,"no_second_look" boolean DEFAULT false,"updated_by" uuid,"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.statement_dispositions("id" uuid DEFAULT gen_random_uuid(),"expense_id" uuid,"property_id" uuid,"period" date,"disposition" text,"defer_to_period" date,"owner_description" text,"internal_note" text,"exclusion_treatment" text,"recovery_treatment" text,"decided_by" uuid,"decided_at" timestamp with time zone DEFAULT now(),"superseded_at" timestamp with time zone,"superseded_by" uuid,"is_demo" boolean DEFAULT false);
CREATE TABLE public.statement_reconciliations("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"period" date,"status" text DEFAULT 'confirmed'::text,"reviewed_by" uuid,"reviewed_at" timestamp with time zone DEFAULT now(),"source_reference" text,"exception_resolution" text,"snapshot" jsonb,"invalidated_at" timestamp with time zone,"invalidated_reason" text,"is_demo" boolean DEFAULT false);
CREATE TABLE public.str_participation_reports("id" uuid DEFAULT gen_random_uuid(),"program_id" uuid,"property_id" uuid,"version" integer,"status" text,"period_start" date,"period_end" date,"snapshot" jsonb,"source_refs" jsonb DEFAULT '[]'::jsonb,"blockers" jsonb DEFAULT '[]'::jsonb,"exclusion_note" text,"revision_reason" text,"supersedes_id" uuid,"generated_at" timestamp with time zone DEFAULT now(),"released_at" timestamp with time zone,"released_by" uuid,"superseded_at" timestamp with time zone,"created_by" uuid);
CREATE TABLE public.team_invites("id" uuid DEFAULT gen_random_uuid(),"code" text,"role" app_role,"invitee_email" text,"invitee_name" text,"note" text,"expires_at" timestamp with time zone DEFAULT (now() + '30 days'::interval),"revoked_at" timestamp with time zone,"redeemed_by" uuid,"redeemed_at" timestamp with time zone,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"seat_role_code" text);
CREATE TABLE public.team_record_check_picks("review_id" uuid,"week_start" date,"picked_at" timestamp with time zone DEFAULT clock_timestamp());
CREATE TABLE public.team_record_draws("id" uuid DEFAULT gen_random_uuid(),"week_start" date,"draw_no" integer,"record_kind" text,"record_id" uuid,"owner_id" uuid,"label" text,"record_at" timestamp with time zone,"link_path" text,"replaces" uuid,"drawn_by" text,"drawn_at" timestamp with time zone DEFAULT clock_timestamp());
CREATE TABLE public.ticket_activity("id" uuid DEFAULT gen_random_uuid(),"ticket_id" uuid,"author_id" uuid,"kind" text DEFAULT 'note'::text,"body" text,"created_at" timestamp with time zone DEFAULT now(),"event_type" text DEFAULT 'update'::text,"event_at" timestamp with time zone DEFAULT now(),"from_owner" uuid,"to_owner" uuid,"channel" text,"evidence_url" text,"is_demo" boolean DEFAULT false,"internal" boolean DEFAULT true,"mentions" uuid[] DEFAULT '{}'::uuid[],"external_author_name" text,"external_id" text);
CREATE TABLE public.ticket_owner_updates("id" uuid DEFAULT gen_random_uuid(),"ticket_id" uuid,"property_id" uuid,"owner_record_id" uuid,"revision" integer,"issue" text,"work_performed" text,"outcome" text,"reviewed_by" uuid,"reviewed_at" timestamp with time zone DEFAULT now(),"source_updated_at" timestamp with time zone,"is_demo" boolean,"owner_request_type" text,"owner_request_why" text);
CREATE TABLE public.ticket_state_log("id" uuid DEFAULT gen_random_uuid(),"ticket_id" uuid,"field" text,"change" text,"next_action" text,"next_action_due_at" timestamp with time zone,"waiting_on" text,"waiting_reason" text,"next_review_at" timestamp with time zone,"actor_id" uuid,"recorded_at" timestamp with time zone DEFAULT now(),"is_imported" boolean DEFAULT false,"is_demo" boolean DEFAULT false);
CREATE TABLE public.ticket_steps("id" uuid DEFAULT gen_random_uuid(),"ticket_id" uuid,"position" integer,"instruction" text,"detail" text,"required" boolean DEFAULT true,"photo_required" boolean DEFAULT false,"completed" boolean DEFAULT false,"completed_by" uuid,"completed_at" timestamp with time zone,"note" text,"created_at" timestamp with time zone DEFAULT now(),"step_key" text,"answer" text,"answer_fields" jsonb,"not_applicable_reason" text,"checklist_playbook_id" uuid);
CREATE TABLE public.ticket_timed_alerts("id" uuid DEFAULT gen_random_uuid(),"ticket_id" uuid,"kind" text,"episode_at" timestamp with time zone,"recipient" uuid,"notification_id" uuid,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.ticket_troubleshooting_answers("id" uuid DEFAULT gen_random_uuid(),"ticket_id" uuid,"step_id" uuid,"outcome" text,"note" text,"answered_by" uuid,"answered_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.ticket_visits("id" uuid DEFAULT gen_random_uuid(),"ticket_id" uuid,"property_id" uuid,"vendor_user_id" uuid,"checked_in_at" timestamp with time zone DEFAULT now(),"check_in_lat" double precision,"check_in_lng" double precision,"check_in_accuracy_m" double precision,"check_in_distance_m" double precision,"check_in_verified" boolean DEFAULT false,"checked_out_at" timestamp with time zone,"check_out_lat" double precision,"check_out_lng" double precision,"check_out_accuracy_m" double precision,"check_out_distance_m" double precision,"check_out_verified" boolean DEFAULT false,"minutes_on_site" integer,"notes" text,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"is_demo" boolean DEFAULT false);
CREATE TABLE public.tickets("id" uuid DEFAULT gen_random_uuid(),"ref" integer,"property_id" uuid,"playbook_id" uuid,"title" text,"description" text,"category" text DEFAULT 'other'::text,"priority" text DEFAULT 'p3'::text,"status" text DEFAULT 'open'::text,"guest_name" text,"guest_contact" text,"guest_in_residence" boolean DEFAULT false,"reported_at" timestamp with time zone DEFAULT now(),"due_at" timestamp with time zone,"assigned_to" uuid,"vendor_name" text,"resolution_notes" text,"guest_confirmed" boolean DEFAULT false,"resolved_at" timestamp with time zone,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"record_type" text DEFAULT 'ticket'::text,"work_type_id" uuid,"bucket" text,"source_channel" text DEFAULT 'internal'::text,"initiator_type" text DEFAULT 'guest'::text,"source_reference" text,"acknowledged_at" timestamp with time zone,"action_started_at" timestamp with time zone,"response_due_at" timestamp with time zone,"action_due_at" timestamp with time zone,"next_action" text,"next_action_due_at" timestamp with time zone,"promised_update_due_at" timestamp with time zone,"next_review_at" timestamp with time zone,"waiting_on" text,"waiting_reason" text,"accountable_owner" uuid,"current_action_owner" uuid,"guest_comm_owner" uuid,"pending_handoff_to" uuid,"handoff_type" text,"handoff_status" text DEFAULT 'none'::text,"handoff_note" text,"escalation_level" text DEFAULT 'none'::text,"escalated_at" timestamp with time zone,"supervisor_caught" boolean DEFAULT false,"created_on_behalf_of" uuid,"outcome_type" text,"final_communication_sent" boolean DEFAULT false,"closure_evidence" text,"late_reason" text,"closure_qa_result" text DEFAULT 'not_reviewed'::text,"reopen_count" integer DEFAULT 0,"last_reopened_at" timestamp with time zone,"avoidable_reopen" boolean DEFAULT false,"priority_override_reason" text,"functional_role_code" text,"record_owner" uuid,"cross_team" boolean DEFAULT false,"guest_impact" text DEFAULT 'none'::text,"occupancy_status" text DEFAULT 'vacant'::text,"suggested_priority" text,"reclassified_at" timestamp with time zone,"ownerrez_booking_id" text,"breezeway_task_id" text,"breezeway_task_url" text,"breezeway_task_status" text,"breezeway_synced_at" timestamp with time zone,"external_source" text,"external_id" text,"external_status" text,"external_url" text,"external_synced_at" timestamp with time zone,"vendor_user_id" uuid,"vendor_brief" text,"vendor_dispatched_at" timestamp with time zone,"vendor_accepted_at" timestamp with time zone,"vendor_completed_at" timestamp with time zone,"vendor_status" text DEFAULT 'none'::text,"department_code" text,"project_id" uuid,"is_demo" boolean DEFAULT false,"archived_at" timestamp with time zone,"archive_reason" text,"archived_by" uuid,"closure_exception_reason" text,"closure_exception_by" uuid,"closure_exception_at" timestamp with time zone,"owner_participation_path" text,"owner_submitted" boolean DEFAULT false,"owner_submitted_by" uuid,"assignment_source" text,"assignment_note" text,"reservation_guest_name" text,"reservation_channel" text,"reservation_confirmation" text,"reservation_arrival" date,"reservation_departure" date,"reservation_guest_count" integer,"reservation_url" text,"reservation_snapshot_at" timestamp with time zone,"final_review_by" uuid,"final_review_at" timestamp with time zone,"final_review_note" text,"repair_reported_incomplete_at" timestamp with time zone,"guest_recovery_needed" boolean DEFAULT false,"guest_recovery_flagged_at" timestamp with time zone,"guest_recovery_flagged_by" uuid,"resolution_path" text,"resolution_path_at" timestamp with time zone,"resolution_path_by" uuid,"guest_update_at" timestamp with time zone,"guest_update_note" text,"next_guest_update_at" timestamp with time zone,"selected_vendor_org_id" uuid,"emergency_vendor_basis" text,"emergency_vendor_reason" text,"emergency_vendor_authorized_by" uuid,"emergency_vendor_authorized_at" timestamp with time zone,"entry_kind" text,"maintenance_category" text,"insurance_risk" text,"estimated_cost" numeric(12,2),"active_stay_impact" text,"guest_comm_required" text,"issue_reservation_relation" text,"guest_feedback_id" uuid,"linked_feedback_id" uuid,"departure_review_id" uuid,"import_hold" text,"checklist_playbook_id" uuid,"checklist_category" text,"unowned_since" timestamp with time zone,"due_on" date,"due_locked" boolean DEFAULT false);
CREATE TABLE public.time_off_requests("id" uuid DEFAULT gen_random_uuid(),"user_id" uuid,"starts_on" date,"ends_on" date,"note" text,"status" text DEFAULT 'pending'::text,"decided_by" uuid,"decided_at" timestamp with time zone,"decision_note" text,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.troubleshooting_guide_steps("id" uuid DEFAULT gen_random_uuid(),"guide_id" uuid,"position" integer,"prompt" text,"help" text);
CREATE TABLE public.troubleshooting_guides("id" uuid DEFAULT gen_random_uuid(),"category" text,"title" text,"active" boolean DEFAULT true,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.user_notification_preferences("user_id" uuid,"email_enabled" boolean DEFAULT true,"email_assignments" boolean DEFAULT true,"email_approvals" boolean DEFAULT true,"email_escalations" boolean DEFAULT true,"email_handoffs" boolean DEFAULT true,"email_work_orders" boolean DEFAULT true,"inapp_assignments" boolean DEFAULT true,"inapp_approvals" boolean DEFAULT true,"inapp_escalations" boolean DEFAULT true,"inapp_handoffs" boolean DEFAULT true,"inapp_work_orders" boolean DEFAULT true,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"email_notes_mentions" boolean DEFAULT true,"inapp_notes_mentions" boolean DEFAULT true,"email_team_queue" boolean DEFAULT true,"inapp_team_queue" boolean DEFAULT true);
CREATE TABLE public.user_roles("id" uuid DEFAULT gen_random_uuid(),"user_id" uuid,"role" app_role);
CREATE TABLE public.utility_accounts("id" uuid DEFAULT gen_random_uuid(),"property_id" uuid,"project_id" uuid,"utility_type" text,"provider" text DEFAULT ''::text,"account_label" text DEFAULT ''::text,"credential_id" uuid,"status" text DEFAULT 'needed'::text,"responsible" text DEFAULT 'arha'::text,"service_start_on" date,"service_end_on" date,"notes" text,"created_by" uuid,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.utility_costs("id" uuid DEFAULT gen_random_uuid(),"account_id" uuid,"property_id" uuid,"period_start" date,"period_end" date,"amount" numeric(12,2) DEFAULT 0,"invoice_ref" text,"paid_on" date,"notes" text,"created_by" uuid,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.vendor_attestations("id" uuid DEFAULT gen_random_uuid(),"org_id" uuid,"user_id" uuid,"version" text,"statement" text,"accepted_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.vendor_compliance_reminders("id" uuid DEFAULT gen_random_uuid(),"org_id" uuid,"requirement_id" uuid,"compliance_item" text,"threshold" text,"expires_on" date,"notified_at" timestamp with time zone DEFAULT now(),"recipients" uuid[] DEFAULT '{}'::uuid[],"is_demo" boolean DEFAULT false,"resolved_at" timestamp with time zone,"resolution" text);
CREATE TABLE public.vendor_contacts("id" uuid DEFAULT gen_random_uuid(),"org_id" uuid,"full_name" text,"email" text,"phone" text,"role_note" text,"legacy_departments" text[] DEFAULT '{}'::text[],"legacy_groups" text[] DEFAULT '{}'::text[],"legacy_account_state" text,"source_system" text,"match_status" text DEFAULT 'unmatched'::text,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.vendor_custom_fields("id" uuid DEFAULT gen_random_uuid(),"key" text,"label" text,"field_type" text,"options" text[] DEFAULT '{}'::text[],"sort_order" integer DEFAULT 0,"archived_at" timestamp with time zone,"archived_by" uuid,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.vendor_documents("id" uuid DEFAULT gen_random_uuid(),"org_id" uuid,"doc_type" text,"title" text,"storage_path" text,"external_url" text,"restricted" boolean DEFAULT false,"verification_status" text DEFAULT 'not_verified'::text,"verified_by" uuid,"verified_at" timestamp with time zone,"expires_on" date,"note" text,"uploaded_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.vendor_field_audit("id" uuid DEFAULT gen_random_uuid(),"org_id" uuid,"field" text,"old_value" jsonb,"new_value" jsonb,"changed_by" uuid,"changed_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.vendor_gatekeeper_results("id" uuid DEFAULT gen_random_uuid(),"org_id" uuid,"requirement_id" uuid,"result" text DEFAULT 'not_verified'::text,"note" text,"verified_by" uuid,"verified_at" timestamp with time zone,"expires_on" date,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"verification_method" text,"document_id" uuid,"evidence_reference" text,"exception_reason" text);
CREATE TABLE public.vendor_import_batches("id" uuid DEFAULT gen_random_uuid(),"source_system" text,"label" text,"note" text,"status" text DEFAULT 'open'::text,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.vendor_import_rows("id" uuid DEFAULT gen_random_uuid(),"batch_id" uuid,"source_role" text DEFAULT 'service_provider'::text,"raw" jsonb DEFAULT '{}'::jsonb,"display_name" text,"email" text,"phone" text,"departments" text[] DEFAULT '{}'::text[],"groups" text[] DEFAULT '{}'::text[],"proposed_action" text DEFAULT 'needs_review'::text,"match_org_id" uuid,"match_confidence" numeric,"match_reasons" text[] DEFAULT '{}'::text[],"decision" text DEFAULT 'pending'::text,"decided_by" uuid,"decided_at" timestamp with time zone,"decision_note" text,"created_org_id" uuid,"created_contact_id" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"source_system" text DEFAULT 'breezeway'::text,"company" text,"contact_person" text,"markets" text[] DEFAULT '{}'::text[],"specialties" text[] DEFAULT '{}'::text[],"preference" text,"website" text,"pricing" text,"comments" text,"payment_type" text,"breezeway_hint" boolean,"legacy_status" text,"tags" text[] DEFAULT '{}'::text[],"legacy_notion_id" text,"legacy_fields" jsonb DEFAULT '{}'::jsonb,"review_states" text[] DEFAULT '{}'::text[],"duplicate_candidates" uuid[] DEFAULT '{}'::uuid[],"transitional_eligible" boolean DEFAULT false,"breezeway_match_state" text,"breezeway_match_person_id" bigint,"breezeway_match_note" text);
CREATE TABLE public.vendor_job_ratings("id" uuid DEFAULT gen_random_uuid(),"ticket_id" uuid,"vendor_user_id" uuid,"rated_by" uuid,"thoroughness" smallint,"communication" smallint,"timeliness" smallint,"photos_complete" boolean DEFAULT false,"reopened" boolean DEFAULT false,"on_time" boolean DEFAULT true,"note" text,"points" integer DEFAULT 0,"overall" numeric(4,2) DEFAULT 0,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.vendor_market_coverage("id" uuid DEFAULT gen_random_uuid(),"org_id" uuid,"market" text,"service_category" text,"preference" text DEFAULT 'other'::text,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.vendor_markets("code" text,"label" text,"active" boolean DEFAULT true,"sort_order" integer DEFAULT 0);
CREATE TABLE public.vendor_org_members("id" uuid DEFAULT gen_random_uuid(),"org_id" uuid,"user_id" uuid,"vendor_role" text DEFAULT 'team_member'::text,"masked_code" text,"active" boolean DEFAULT true,"attested_at" timestamp with time zone,"attestation_version" text,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.vendor_orgs("id" uuid DEFAULT gen_random_uuid(),"legal_name" text,"display_name" text,"vendor_class" text DEFAULT 'company'::text,"status" text DEFAULT 'candidate'::text,"primary_contact_name" text,"primary_contact_email" text,"primary_contact_phone" text,"website" text,"service_categories" text[] DEFAULT '{}'::text[],"markets" text[] DEFAULT '{}'::text[],"legacy_market_hints" text[] DEFAULT '{}'::text[],"legacy_all_groups" boolean DEFAULT false,"capacity_note" text,"response_time_note" text,"emergency_available" boolean DEFAULT false,"pricing_note" text,"payment_terms" text,"insurance_status" text DEFAULT 'not_verified'::text,"insurance_expires_on" date,"license_status" text DEFAULT 'not_verified'::text,"license_expires_on" date,"w9_status" text DEFAULT 'not_verified'::text,"google_place_id" text,"google_rating" numeric,"google_review_count" integer,"google_refreshed_at" timestamp with time zone,"trial_jobs_required" integer DEFAULT 3,"trial_score" integer,"tier" text,"approval_limit" numeric,"notes" text,"last_verified_at" timestamp with time zone,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"is_demo" boolean DEFAULT false,"is_active" boolean DEFAULT true,"dispatch_method" text DEFAULT 'setup_incomplete'::text,"breezeway_person_id" text,"work_order_email" text,"tags" text[] DEFAULT '{}'::text[],"attachments" jsonb DEFAULT '[]'::jsonb,"source_system" text DEFAULT 'resolve'::text,"legacy_notion_id" text,"migration_status" text,"legacy_fields" jsonb DEFAULT '{}'::jsonb,"custom_fields" jsonb DEFAULT '{}'::jsonb,"compliance_status" text DEFAULT 'incomplete'::text,"score_capacity" integer,"score_responsiveness" integer,"score_quality" integer,"score_hospitality" integer,"score_communication" integer,"score_pricing" integer,"score_references" integer,"qualification_score" integer DEFAULT ((((((COALESCE(score_capacity, 0) + COALESCE(score_responsiveness, 0)) + COALESCE(score_quality, 0)) + COALESCE(score_hospitality, 0)) + COALESCE(score_communication, 0)) + COALESCE(score_pricing, 0)) + COALESCE(score_references, 0)),"performance_score" numeric,"jobs_90d" integer DEFAULT 0,"critical_failure" boolean DEFAULT false,"last_review_on" date,"next_review_on" date,"program_owner" uuid,"open_corrective_action" text,"corrective_action_due" date,"transitional_review" boolean DEFAULT false,"transitional_started_on" date,"transitional_deadline" date,"transitional_outcome" text,"transitional_ended_at" timestamp with time zone,"emergency_only" boolean DEFAULT false,"uses_telegram" boolean DEFAULT false,"telegram_status" text DEFAULT 'unknown'::text,"telegram_confirmed_by" uuid,"telegram_confirmed_at" timestamp with time zone,"preferred_contact" text);
CREATE TABLE public.vendor_saved_views("id" uuid DEFAULT gen_random_uuid(),"name" text,"owner_id" uuid,"shared" boolean DEFAULT false,"config" jsonb DEFAULT '{}'::jsonb,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.vendor_service_areas("id" uuid DEFAULT gen_random_uuid(),"org_id" uuid,"service_category" text,"postal_code" text,"territory_label" text,"coverage_priority" text DEFAULT 'primary'::text,"travel_note" text,"effective_from" date DEFAULT CURRENT_DATE,"effective_to" date,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.vendor_service_categories("label" text,"tier" text,"active" boolean DEFAULT true,"sort_order" integer DEFAULT 0);
CREATE TABLE public.vendor_sourcing_requests("id" uuid DEFAULT gen_random_uuid(),"ticket_id" uuid,"market" text,"service_category" text,"state" text DEFAULT 'requested'::text,"owner_id" uuid,"requested_by" uuid,"note" text,"resolved_vendor_org_id" uuid,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"closed_at" timestamp with time zone);
CREATE TABLE public.vendor_status_events("id" uuid DEFAULT gen_random_uuid(),"org_id" uuid,"from_status" text,"to_status" text,"reason" text,"actor_id" uuid,"actor_label" text,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.vendor_transitional_reminders("id" uuid DEFAULT gen_random_uuid(),"org_id" uuid,"threshold" text,"deadline" date,"recipients" uuid[] DEFAULT '{}'::uuid[],"notified_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.weekly_scorecard_drafts("due_on" date,"manual" jsonb DEFAULT '{}'::jsonb,"updated_by" uuid,"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.work_item_resources("id" uuid DEFAULT gen_random_uuid(),"work_item_id" uuid,"kind" text,"document_id" uuid,"label" text,"url" text,"sort_order" integer DEFAULT 0,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"removed_at" timestamp with time zone,"note" text,"resource_type" text);
CREATE TABLE public.work_items("id" uuid DEFAULT gen_random_uuid(),"department" text,"kind" text,"property_id" uuid,"source_table" text,"source_id" uuid,"linked_task_id" uuid,"program_id" uuid,"title" text,"owner_content" jsonb,"status" text DEFAULT 'open'::text,"functional_role" text,"assigned_to" uuid,"due_on" date,"required" boolean DEFAULT true,"blocks_handoff" boolean DEFAULT false,"completed_at" timestamp with time zone,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"source" text,"source_department" text,"source_project_id" uuid,"source_task_id" uuid,"response_types" text[] DEFAULT '{}'::text[],"sent_at" timestamp with time zone,"viewed_at" timestamp with time zone,"responded_at" timestamp with time zone,"owner_response" jsonb DEFAULT '[]'::jsonb,"library_template_id" uuid,"retired_at" timestamp with time zone,"retired_reason" text,"owner_priority" integer,"needs_owner_attention" boolean DEFAULT false,"owner_attention_set_at" timestamp with time zone,"owner_attention_set_by" uuid);
CREATE TABLE public.work_order_contact_attempts("id" uuid DEFAULT gen_random_uuid(),"candidate_id" uuid,"channel" text,"response" text,"note" text,"next_follow_up_on" date,"attempted_at" timestamp with time zone DEFAULT now(),"created_by" uuid);
CREATE TABLE public.work_order_events("id" uuid DEFAULT gen_random_uuid(),"work_order_id" uuid,"author_id" uuid,"event_type" text,"body" text,"detail" jsonb DEFAULT '{}'::jsonb,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.work_order_vendor_candidates("id" uuid DEFAULT gen_random_uuid(),"work_order_id" uuid,"vendor_org_id" uuid,"vendor_name" text,"choice" text DEFAULT 'primary'::text,"status" text DEFAULT 'candidate'::text,"next_follow_up_on" date,"accepted_at" timestamp with time zone,"accepted_by" uuid,"declined_reason" text,"is_demo" boolean DEFAULT false,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"released_reason" text);
CREATE TABLE public.work_order_visits("id" uuid DEFAULT gen_random_uuid(),"work_order_id" uuid,"candidate_id" uuid,"vendor_name" text,"visit_date" date DEFAULT CURRENT_DATE,"outcome" text,"findings" text,"work_done" text,"evidence_document_ids" uuid[] DEFAULT '{}'::uuid[],"follow_up_work_item_id" uuid,"is_demo" boolean DEFAULT false,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.work_orders("id" uuid DEFAULT gen_random_uuid(),"ticket_id" uuid,"property_id" uuid,"title" text,"scope" text,"service_category" text,"priority" text DEFAULT 'p3'::text,"phase" text DEFAULT 'permanent'::text,"emergency_reason" text,"contractual_exception" boolean DEFAULT false,"policy_version" text DEFAULT 'ARHA Maintenance Authority Policy for Resolve v3'::text,"quote_requested_at" timestamp with time zone,"quote_received_at" timestamp with time zone,"quote_amount" numeric(12,2),"second_quote_amount" numeric(12,2),"replacement_cost" numeric(12,2),"diagnosis_uncertain" boolean DEFAULT false,"owner_requested_comparison" boolean DEFAULT false,"authority_level" text,"approval_status" text DEFAULT 'not_required'::text,"approval_id" uuid,"approval_requested_at" timestamp with time zone,"approval_requested_by" uuid,"approved_amount" numeric(12,2),"approval_decided_at" timestamp with time zone,"approval_note" text,"vendor_org_id" uuid,"vendor_name" text,"vendor_contacted_at" timestamp with time zone,"vendor_acknowledged_at" timestamp with time zone,"scheduled_for" timestamp with time zone,"vendor_eta_at" timestamp with time zone,"vendor_arrived_at" timestamp with time zone,"vendor_completed_at" timestamp with time zone,"missed_commitments" integer DEFAULT 0,"warranty_may_apply" boolean DEFAULT false,"warranty_kind" text,"warranty_contact" text,"warranty_contacted_at" timestamp with time zone,"warranty_eta_at" timestamp with time zone,"warranty_override_reason" text,"warranty_override_by" uuid,"warranty_override_at" timestamp with time zone,"temporary_mitigation" text,"permanent_repair_needed" boolean DEFAULT false,"follow_up_ticket_id" uuid,"occupied_now" boolean DEFAULT false,"guest_notified_at" timestamp with time zone,"final_cost" numeric(12,2),"invoice_reference" text,"vendor_report" text,"evidence_complete" boolean DEFAULT false,"claim_id" uuid,"recovery_id" uuid,"assigned_to" uuid,"created_by" uuid,"closed_at" timestamp with time zone,"closed_by" uuid,"closure_note" text,"reopened_at" timestamp with time zone,"reopened_by" uuid,"reopen_reason" text,"is_demo" boolean DEFAULT false,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"supervisor_approval_id" uuid,"supervisor_approval_status" text DEFAULT 'not_required'::text,"supervisor_approval_requested_at" timestamp with time zone,"supervisor_approval_requested_by" uuid,"supervisor_approval_decided_at" timestamp with time zone,"supervisor_approval_note" text,"owner_fyi_at" timestamp with time zone,"owner_fyi_by" uuid,"category" text,"dispatch_reason" text,"guest_impact" text,"authorized_scope" text,"authorized_amount" numeric(12,2),"authorized_at" timestamp with time zone,"authorization_stale" boolean DEFAULT false,"dispatched_at" timestamp with time zone,"dispatched_by" uuid,"breezeway_handoff_status" text DEFAULT 'not_sent'::text,"breezeway_request_key" text,"breezeway_task_ref" text,"breezeway_handoff_at" timestamp with time zone,"breezeway_handoff_error" text,"authorized_vendor_org_id" uuid,"supervisor_approval_decided_by" uuid);
CREATE TABLE public.work_projects("id" uuid DEFAULT gen_random_uuid(),"name" text,"summary" text,"department_id" uuid,"property_id" uuid,"status" text DEFAULT 'active'::text,"owner_id" uuid,"starts_on" date,"target_on" date,"archived_at" timestamp with time zone,"created_by" uuid,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now());
CREATE TABLE public.work_types("id" uuid DEFAULT gen_random_uuid(),"name" text,"category" text,"bucket" text DEFAULT 'property_ownership'::text,"default_priority" text DEFAULT 'p3'::text,"response_minutes" integer DEFAULT 120,"action_start_minutes" integer DEFAULT 480,"completion_target" text,"clock_type" text DEFAULT 'calendar'::text,"required_closure_evidence" text,"guest_communication_required" boolean DEFAULT false,"playbook_id" uuid,"active" boolean DEFAULT true,"sort_order" integer DEFAULT 100,"created_at" timestamp with time zone DEFAULT now(),"updated_at" timestamp with time zone DEFAULT now(),"team" text DEFAULT 'property_operations'::text,"functional_role_code" text,"backup_coverage" text,"operating_standard" text,"pending_approval" boolean DEFAULT false);
CREATE TABLE auth.users(id uuid,email text); CREATE TABLE cron.job(jobid bigint,jobname text,schedule text,command text); CREATE FUNCTION cron.schedule(n text,s text,c text) RETURNS bigint LANGUAGE plpgsql AS $$BEGIN INSERT INTO cron.job VALUES(1,n,s,c); RETURN 1; END$$; CREATE FUNCTION cron.unschedule(n text) RETURNS boolean LANGUAGE plpgsql AS $$BEGIN DELETE FROM cron.job WHERE jobname=n; RETURN true; END$$;
ALTER TABLE public.app_settings ADD CONSTRAINT app_settings_pkey PRIMARY KEY (key);
ALTER TABLE public.coverage_config ADD CONSTRAINT coverage_config_id_check CHECK (id);
ALTER TABLE public.coverage_config ADD CONSTRAINT coverage_config_pkey PRIMARY KEY (id);
ALTER TABLE public.coverage_shifts ADD CONSTRAINT coverage_shifts_check CHECK ((end_minute > start_minute));
ALTER TABLE public.coverage_shifts ADD CONSTRAINT coverage_shifts_end_minute_check CHECK (((end_minute > 0) AND (end_minute <= 1440)));
ALTER TABLE public.coverage_shifts ADD CONSTRAINT coverage_shifts_lunch_chk CHECK ((((lunch_start_minute IS NULL) AND (lunch_end_minute IS NULL)) OR ((lunch_start_minute >= 0) AND (lunch_end_minute <= 1440) AND (lunch_start_minute < lunch_end_minute))));
ALTER TABLE public.coverage_shifts ADD CONSTRAINT coverage_shifts_pkey PRIMARY KEY (id);
ALTER TABLE public.coverage_shifts ADD CONSTRAINT coverage_shifts_start_minute_check CHECK (((start_minute >= 0) AND (start_minute < 1440)));
ALTER TABLE public.coverage_shifts ADD CONSTRAINT coverage_shifts_weekday_check CHECK (((weekday >= 0) AND (weekday <= 6)));
ALTER TABLE public.escalations ADD CONSTRAINT escalations_onboarding_shape_ck CHECK (((escalated_to_role <> 'onboarding_director'::text) OR ((ticket_id IS NULL) AND (property_id IS NOT NULL) AND ((onboarding_task_id IS NOT NULL) OR (work_item_id IS NOT NULL)))));
ALTER TABLE public.escalations ADD CONSTRAINT escalations_outcome_ck CHECK (((outcome IS NULL) OR (outcome = ANY (ARRAY['guidance'::text, 'takeover'::text, 'reassigned'::text]))));
ALTER TABLE public.escalations ADD CONSTRAINT escalations_pkey PRIMARY KEY (id);
ALTER TABLE public.escalations ADD CONSTRAINT escalations_role_ck CHECK ((escalated_to_role = ANY (ARRAY['supervisor'::text, 'director'::text, 'onboarding_director'::text])));
ALTER TABLE public.escalations ADD CONSTRAINT escalations_status_ck CHECK ((status = ANY (ARRAY['open'::text, 'resolved'::text, 'withdrawn'::text])));
ALTER TABLE public.escalations ADD CONSTRAINT escalations_urgency_ck CHECK ((urgency = ANY (ARRAY['normal'::text, 'high'::text, 'critical'::text])));
ALTER TABLE public.functional_roles ADD CONSTRAINT functional_roles_code_key UNIQUE (code);
ALTER TABLE public.functional_roles ADD CONSTRAINT functional_roles_pkey PRIMARY KEY (id);
ALTER TABLE public.leads ADD CONSTRAINT leads_db_outcome_check CHECK (((outcome IS NULL) OR (outcome = ANY (ARRAY['booked'::text, 'not_booked'::text]))));
ALTER TABLE public.leads ADD CONSTRAINT leads_kind_check CHECK (((kind IS NULL) OR (kind = 'direct_booking'::text)));
ALTER TABLE public.leads ADD CONSTRAINT leads_not_booked_reason_check CHECK (((not_booked_reason IS NULL) OR (not_booked_reason = ANY (ARRAY['Stayed with family'::text, 'Chose another home'::text, 'No reply from the partner'::text, 'Price was too high'::text, 'No home was available'::text, 'Other'::text]))));
ALTER TABLE public.leads ADD CONSTRAINT leads_pkey PRIMARY KEY (id);
ALTER TABLE public.leads ADD CONSTRAINT leads_portal_link_host_check CHECK (((portal_link IS NULL) OR ((length(portal_link) <= 2000) AND (portal_link ~* '^https?://([a-z0-9-]+\.)*(owlmarketplace\.com|reloquest\.com|travelershaven\.com|aleasetech\.com)(:[0-9]{1,5})?([/?#]|$)'::text))));
ALTER TABLE public.leads ADD CONSTRAINT leads_portal_note_check CHECK (((portal_answer_note IS NULL) OR (length(portal_answer_note) <= 200)));
ALTER TABLE public.leads ADD CONSTRAINT leads_preferred_bedrooms_check CHECK (((preferred_bedrooms IS NULL) OR ((preferred_bedrooms >= 0) AND (preferred_bedrooms <= 12))));
ALTER TABLE public.leads ADD CONSTRAINT leads_reply_method_check CHECK (((reply_method IS NULL) OR (reply_method = ANY (ARRAY['email'::text, 'portal'::text]))));
ALTER TABLE public.leads ADD CONSTRAINT leads_reply_via_check CHECK (((reply_sent_via IS NULL) OR (reply_sent_via = ANY (ARRAY['mailbox'::text, 'manual'::text]))));
ALTER TABLE public.routine_controls ADD CONSTRAINT routine_controls_kind_check CHECK ((kind = ANY (ARRAY['cleaning_review'::text, 'guest_review'::text, 'checkout'::text, 'guest_touch_base'::text, 'survey_review'::text, 'maintenance_review'::text])));
ALTER TABLE public.routine_controls ADD CONSTRAINT routine_controls_outcome_check CHECK (((outcome IS NULL) OR (outcome = ANY (ARRAY['looks_good'::text, 'needs_follow_up'::text, 'no_answer'::text, 'not_applicable'::text]))));
ALTER TABLE public.routine_controls ADD CONSTRAINT routine_controls_pkey PRIMARY KEY (id);
ALTER TABLE public.routine_controls ADD CONSTRAINT routine_controls_status_check CHECK ((status = ANY (ARRAY['due'::text, 'in_progress'::text, 'completed'::text, 'cancelled'::text])));
ALTER TABLE public.staff_notifications ADD CONSTRAINT staff_notifications_email_status_check CHECK ((email_status = ANY (ARRAY['none'::text, 'pending'::text, 'sent'::text, 'skipped'::text, 'failed'::text, 'held'::text])));
ALTER TABLE public.staff_notifications ADD CONSTRAINT staff_notifications_pkey PRIMARY KEY (id);
ALTER TABLE public.ticket_timed_alerts ADD CONSTRAINT ticket_timed_alerts_kind_check CHECK ((kind = ANY (ARRAY['team_queue_supervisor'::text, 'team_queue_director'::text, 'waiting_return'::text, 'handoff_receiver'::text, 'handoff_supervisor'::text])));
ALTER TABLE public.ticket_timed_alerts ADD CONSTRAINT ticket_timed_alerts_once UNIQUE (ticket_id, kind, episode_at);
ALTER TABLE public.ticket_timed_alerts ADD CONSTRAINT ticket_timed_alerts_pkey PRIMARY KEY (id);
ALTER TABLE public.tickets ADD CONSTRAINT tickets_active_stay_impact_check CHECK ((active_stay_impact = ANY (ARRAY['yes'::text, 'no'::text, 'unknown'::text])));
ALTER TABLE public.tickets ADD CONSTRAINT tickets_emergency_vendor_basis_chk CHECK (((emergency_vendor_basis IS NULL) OR (emergency_vendor_basis = ANY (ARRAY['p1'::text, 'no_routine_vendor'::text, 'after_hours'::text, 'supervisor_approval'::text, 'supervisor_override'::text]))));
ALTER TABLE public.tickets ADD CONSTRAINT tickets_entry_kind_check CHECK ((entry_kind = ANY (ARRAY['ops'::text, 'maintenance'::text])));
ALTER TABLE public.tickets ADD CONSTRAINT tickets_escalation_chk CHECK ((escalation_level = ANY (ARRAY['none'::text, 'supervisor'::text, 'director'::text, 'executive'::text])));
ALTER TABLE public.tickets ADD CONSTRAINT tickets_estimated_cost_check CHECK (((estimated_cost IS NULL) OR (estimated_cost >= (0)::numeric)));
ALTER TABLE public.tickets ADD CONSTRAINT tickets_guest_comm_required_check CHECK ((guest_comm_required = ANY (ARRAY['yes'::text, 'no'::text, 'complete'::text])));
ALTER TABLE public.tickets ADD CONSTRAINT tickets_handoff_status_chk CHECK ((handoff_status = ANY (ARRAY['none'::text, 'pending'::text, 'accepted'::text, 'rejected'::text, 'expired'::text])));
ALTER TABLE public.tickets ADD CONSTRAINT tickets_handoff_type_chk CHECK (((handoff_type IS NULL) OR (handoff_type = ANY (ARRAY['action_request'::text, 'ownership_transfer'::text, 'shift_coverage'::text, 'supervisor_intervention'::text]))));
ALTER TABLE public.tickets ADD CONSTRAINT tickets_import_hold_chk CHECK (((import_hold IS NULL) OR (import_hold = ANY (ARRAY['backlog_review'::text, 'needs_home'::text, 'in_queue'::text]))));
ALTER TABLE public.tickets ADD CONSTRAINT tickets_insurance_risk_check CHECK ((insurance_risk = ANY (ARRAY['yes'::text, 'no'::text, 'unsure'::text])));
ALTER TABLE public.tickets ADD CONSTRAINT tickets_issue_reservation_relation_check CHECK ((issue_reservation_relation = ANY (ARRAY['current'::text, 'prior'::text, 'future'::text, 'none'::text])));
ALTER TABLE public.tickets ADD CONSTRAINT tickets_outcome_chk CHECK (((outcome_type IS NULL) OR (outcome_type = ANY (ARRAY['resolved'::text, 'information_provided'::text, 'vendor_completed'::text, 'no_issue_found'::text, 'cancelled_by_requestor'::text, 'duplicate'::text, 'other'::text]))));
ALTER TABLE public.tickets ADD CONSTRAINT tickets_owner_participation_path_chk CHECK (((owner_participation_path IS NULL) OR (owner_participation_path = ANY (ARRAY['inform'::text, 'consult'::text, 'approve'::text, 'emergency'::text]))));
ALTER TABLE public.tickets ADD CONSTRAINT tickets_pkey PRIMARY KEY (id);
ALTER TABLE public.tickets ADD CONSTRAINT tickets_priority_chk CHECK ((priority = ANY (ARRAY['p1'::text, 'p2'::text, 'p3'::text])));
ALTER TABLE public.tickets ADD CONSTRAINT tickets_qa_chk CHECK ((closure_qa_result = ANY (ARRAY['not_reviewed'::text, 'pass'::text, 'fail'::text, 'corrected'::text, 'returned'::text, 'waived'::text, 'not_required'::text])));
ALTER TABLE public.tickets ADD CONSTRAINT tickets_record_type_chk CHECK ((record_type = ANY (ARRAY['completed_interaction'::text, 'active_task'::text, 'collaborative_matter'::text])));
ALTER TABLE public.tickets ADD CONSTRAINT tickets_resolution_path_check CHECK ((resolution_path = ANY (ARRAY['guest'::text, 'field'::text, 'escalate'::text, 'already_resolved'::text])));
ALTER TABLE public.tickets ADD CONSTRAINT tickets_waiting_on_chk CHECK (((waiting_on IS NULL) OR (waiting_on = ANY (ARRAY['guest'::text, 'owner'::text, 'vendor'::text, 'approval'::text, 'parts'::text, 'scheduled_date'::text, 'internal_team'::text, 'other'::text]))));
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);
CREATE OR REPLACE FUNCTION private.stamp_routine_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'completed' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'completed') THEN
    NEW.completed_at := now();
    NEW.completed_by := coalesce(auth.uid(), NEW.completed_by);
  END IF;
  RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION public.functional_role_holders(_code text)
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT current_seat_holder FROM public.functional_roles WHERE code = _code AND active AND current_seat_holder IS NOT NULL
  UNION
  SELECT user_id FROM public.functional_role_members WHERE role_code = _code;
$function$
;
CREATE OR REPLACE FUNCTION public.direct_booking_settings()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'approvalStart', '2026-11-09', 'approvalEnd', '2026-11-23',
    'requireApprovalAfterEnd', false, 'approvalWaitMinutes', 2, 'replyTargetMinutes', 3)
    || coalesce((SELECT value FROM public.app_settings WHERE key = 'direct_booking_settings'), '{}'::jsonb);
$function$
;
CREATE OR REPLACE FUNCTION private.lock_completed_routine_check()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (OLD.status = 'completed' OR OLD.completed_at IS NOT NULL) THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'A saved routine check is permanent. Add a correction instead.' USING ERRCODE = 'P0001';
  END IF;
  IF (to_jsonb(NEW) - 'updated_at' - 'follow_up_ticket_id') IS DISTINCT FROM (to_jsonb(OLD) - 'updated_at' - 'follow_up_ticket_id')
     OR (OLD.follow_up_ticket_id IS NOT NULL AND NEW.follow_up_ticket_id IS DISTINCT FROM OLD.follow_up_ticket_id) THEN
    RAISE EXCEPTION 'A saved routine check is permanent. Add a correction instead.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION public.escalate_direct_booking_approvals()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _row record; n integer := 0; _wait int := coalesce((public.direct_booking_settings()->>'approvalWaitMinutes')::int, 2);
BEGIN
  FOR _row IN SELECT id, lead_id FROM public.direct_booking_approvals
     WHERE decision IS NULL AND escalated_at IS NULL AND requested_at <= now() - make_interval(mins => _wait)
     FOR UPDATE SKIP LOCKED LOOP
    UPDATE public.direct_booking_approvals SET escalated_at = now() WHERE id = _row.id;
    PERFORM public.direct_booking_notify(ARRAY(SELECT public.functional_role_holders('director_ops')),
      'direct_booking_escalated', 'A direct booking reply is still waiting',
      'No approval after ' || _wait || ' minutes. You can approve it now.', _row.lead_id);
    n := n + 1;
  END LOOP;
  RETURN n;
END $function$
;
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$function$
;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $function$
;
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'private'
AS $function$ SELECT private.has_role(_user_id, _role) $function$
;
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'private'
AS $function$ SELECT private.is_staff(_user_id) $function$
;
CREATE OR REPLACE FUNCTION private.is_staff(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text IN ('admin','manager','tech','onboarding')
  )
$function$
;
CREATE OR REPLACE FUNCTION public.audit_ticket_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE changed text[] := '{}';
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN changed := changed || ARRAY['status']; END IF;
  IF NEW.priority IS DISTINCT FROM OLD.priority THEN changed := changed || ARRAY['priority']; END IF;
  IF NEW.assigned_to IS DISTINCT FROM OLD.assigned_to THEN changed := changed || ARRAY['assigned_to']; END IF;
  IF NEW.record_owner IS DISTINCT FROM OLD.record_owner THEN changed := changed || ARRAY['record_owner']; END IF;
  IF NEW.current_action_owner IS DISTINCT FROM OLD.current_action_owner THEN changed := changed || ARRAY['current_action_owner']; END IF;
  IF NEW.accountable_owner IS DISTINCT FROM OLD.accountable_owner THEN changed := changed || ARRAY['accountable_owner']; END IF;
  IF NEW.handoff_status IS DISTINCT FROM OLD.handoff_status THEN changed := changed || ARRAY['handoff_status']; END IF;
  IF NEW.escalation_level IS DISTINCT FROM OLD.escalation_level THEN changed := changed || ARRAY['escalation_level']; END IF;
  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN changed := changed || ARRAY['archived_at']; END IF;
  IF NEW.resolved_at IS DISTINCT FROM OLD.resolved_at THEN changed := changed || ARRAY['resolved_at']; END IF;
  IF NEW.closure_exception_reason IS DISTINCT FROM OLD.closure_exception_reason THEN changed := changed || ARRAY['closure_exception']; END IF;

  IF array_length(changed, 1) IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.audit_log (actor_id, action, entity_type, entity_id, entity_label, reason, before_value, after_value)
  VALUES (
    auth.uid(),
    'matter_' || array_to_string(changed, '+') || '_changed',
    'ticket',
    NEW.id,
    NEW.title,
    COALESCE(NEW.archive_reason, NEW.closure_exception_reason),
    jsonb_build_object('status', OLD.status, 'priority', OLD.priority, 'assigned_to', OLD.assigned_to,
      'record_owner', OLD.record_owner, 'current_action_owner', OLD.current_action_owner,
      'accountable_owner', OLD.accountable_owner, 'handoff_status', OLD.handoff_status,
      'escalation_level', OLD.escalation_level, 'archived_at', OLD.archived_at, 'resolved_at', OLD.resolved_at),
    jsonb_build_object('status', NEW.status, 'priority', NEW.priority, 'assigned_to', NEW.assigned_to,
      'record_owner', NEW.record_owner, 'current_action_owner', NEW.current_action_owner,
      'accountable_owner', NEW.accountable_owner, 'handoff_status', NEW.handoff_status,
      'escalation_level', NEW.escalation_level, 'archived_at', NEW.archived_at, 'resolved_at', NEW.resolved_at)
  );
  RETURN NEW;
END; $function$
;
CREATE OR REPLACE FUNCTION public.auto_assign_ticket()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r record;
BEGIN
  IF NEW.status IN ('resolved', 'closed') THEN
    RETURN NEW;
  END IF;

  -- Automated sources stay unowned (Emily, Nov 7, 2026; register T15): the info inbox,
  -- OwnerRez and Breezeway. They wait in the Team Queue for their team to take them.
  IF lower(coalesce(NEW.external_source, '')) IN ('email', 'ownerrez', 'breezeway') THEN
    NEW.assignment_note := 'Waiting in the Team Queue for the team to take it.';
    RETURN NEW;
  END IF;

  SELECT * INTO r FROM public.ticket_route_at(NEW.functional_role_code, NEW.work_type_id, now());
  NEW.current_action_owner := r.user_id;
  NEW.assigned_to := r.user_id;
  NEW.assignment_source := r.source;
  NEW.assignment_note := r.note;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.notify_staff(_user_id uuid, _kind text, _title text, _body text, _entity_type text, _entity_id uuid, _link_path text, _priority text, _actor_id uuid, _email boolean, _is_demo boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _id uuid;
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF _actor_id IS NOT NULL AND _actor_id = _user_id THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.staff_notifications (
    user_id, kind, title, body, entity_type, entity_id, link_path,
    priority, actor_id, email_status, is_demo
  ) VALUES (
    _user_id, _kind, _title, coalesce(_body, ''), _entity_type, _entity_id, _link_path,
    coalesce(_priority, 'normal'), _actor_id,
    CASE WHEN _email AND NOT coalesce(_is_demo, false) THEN 'pending' ELSE 'none' END,
    coalesce(_is_demo, false)
  )
  RETURNING id INTO _id;

  RETURN _id;
END;
$function$
;
CREATE OR REPLACE FUNCTION private.is_director(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  -- A Platform Owner may always act with full authority. Otherwise, only
  -- whoever currently holds (or is covering) the director_ops seat.
  SELECT public.has_role(_user_id, 'admin')
    OR public.seat_holder_at('director_ops') = _user_id
$function$
;
CREATE OR REPLACE FUNCTION public.is_director(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'private'
AS $function$ SELECT private.is_director(_user_id) $function$
;
CREATE OR REPLACE FUNCTION private.sc_is_ops_supervisor(_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT private.sc_holds(_uid, 'ops_supervisor')
$function$
;
CREATE OR REPLACE FUNCTION public.seat_eligible_now(_role_code text, _at timestamp with time zone DEFAULT now())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN (SELECT kind FROM public.seat_override_at(_role_code, _at)) = 'off' THEN false
    WHEN (SELECT kind FROM public.seat_override_at(_role_code, _at)) = 'cover' THEN true
    WHEN NOT COALESCE((SELECT r.available FROM public.functional_roles r WHERE r.code = _role_code), true) THEN false
    ELSE public.seat_on_duty(_role_code, _at)
  END
$function$
;
CREATE OR REPLACE FUNCTION public.seat_holder_at(_role_code text, _at timestamp with time zone DEFAULT now())
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT o.user_id FROM public.seat_override_at(_role_code, _at) o WHERE o.kind = 'cover'),
    (SELECT r.current_seat_holder FROM public.functional_roles r WHERE r.code = _role_code)
  )
$function$
;
CREATE OR REPLACE FUNCTION public.notify_ticket_events()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _link text := '/tickets/' || NEW.id::text;
  _ref text := coalesce('#' || NEW.ref::text || ' ', '');
  _reassigned boolean := TG_OP = 'UPDATE' AND OLD.assigned_to IS NOT NULL AND NEW.assigned_to IS DISTINCT FROM OLD.assigned_to;
BEGIN
  IF NEW.assigned_to IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.assigned_to IS DISTINCT FROM OLD.assigned_to) THEN
    PERFORM public.notify_staff(
      NEW.assigned_to,
      CASE WHEN _reassigned THEN 'ticket_reassigned' ELSE 'ticket_assigned' END,
      CASE WHEN _reassigned THEN 'Reassigned to you: ' ELSE '' END || _ref || NEW.title,
      CASE WHEN _reassigned
        THEN 'This ticket was reassigned to you. Open it to see the next action.'
        ELSE 'This ticket is now yours. Open it to see the next action.' END,
      'ticket', NEW.id, _link,
      CASE WHEN NEW.priority = 'p1' THEN 'urgent' ELSE 'normal' END,
      auth.uid(), true, NEW.is_demo
    );
  END IF;

  IF TG_OP = 'UPDATE'
     AND coalesce(NEW.reopen_count, 0) > coalesce(OLD.reopen_count, 0) THEN
    PERFORM public.notify_staff(
      NEW.assigned_to,
      'ticket_reopened',
      'Reopened: ' || _ref || NEW.title,
      'This ticket was reopened and needs another pass.',
      'ticket', NEW.id, _link, 'urgent', auth.uid(), true, NEW.is_demo
    );
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      PERFORM public.notify_staff(
        OLD.assigned_to,
        'ticket_reopened',
        'Reopened: ' || _ref || NEW.title,
        'A ticket you previously owned was reopened.',
        'ticket', NEW.id, _link, 'normal', auth.uid(), true, NEW.is_demo
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.email_delivery_allowed(_recipients text[], _entity_type text DEFAULT NULL::text, _entity_id uuid DEFAULT NULL::uuid, _ticket_id uuid DEFAULT NULL::uuid, _actor_id uuid DEFAULT NULL::uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE address text; tab text; row_data jsonb;
BEGIN
 IF cardinality(_recipients) IS NULL OR cardinality(_recipients)=0 THEN RETURN false; END IF;
 FOREACH address IN ARRAY _recipients LOOP
  IF address IS NULL OR address !~* '^[^[:space:]@]+@[^[:space:]@]+\.[a-z]{2,}$'
    OR address ~* '@([^@]*\.)?(invalid|test|example)$|@example\.com$' THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p JOIN auth.users u ON u.id=p.id
    WHERE lower(trim(p.email))=lower(trim(address))
      AND u.email ~* '@([^@]*\.)?(invalid|test|example)$|@example\.com$') THEN RETURN false; END IF;
  IF EXISTS (SELECT 1 FROM public.owner_programs p WHERE p.is_demo
    AND (lower(trim(p.owner_email))=lower(trim(address)) OR p.owner_user_id IN
      (SELECT id FROM auth.users WHERE lower(trim(email))=lower(trim(address))))) THEN RETURN false; END IF;
 END LOOP;
 IF _actor_id IS NOT NULL AND EXISTS(SELECT 1 FROM auth.users WHERE id=_actor_id
   AND email ~* '@([^@]*\.)?(invalid|test|example)$|@example\.com$') THEN RETURN false; END IF;
 IF _ticket_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.tickets WHERE id=_ticket_id AND is_demo=false) THEN RETURN false; END IF;
 IF _entity_type IS NOT NULL THEN
  tab := CASE _entity_type
    WHEN 'owner_program' THEN 'owner_programs' WHEN 'owner_notification' THEN 'owner_notifications'
    WHEN 'staff_notification' THEN 'staff_notifications' WHEN 'ticket' THEN 'tickets'
    WHEN 'property' THEN 'properties' WHEN 'work_order' THEN 'work_orders'
    WHEN 'onboarding_task' THEN 'onboarding_tasks' WHEN 'work_item' THEN 'work_items'
    WHEN 'help_ticket' THEN 'help_tickets' WHEN 'approval' THEN 'approvals'
    WHEN 'handoff' THEN 'handoffs'
    WHEN 'claim' THEN 'claims' WHEN 'vendor_org' THEN 'vendor_orgs'
    WHEN 'onboarding_project' THEN 'onboarding_projects' WHEN 'owner_review' THEN 'owner_reviews'
    WHEN 'financial_request' THEN 'financial_requests' ELSE NULL END;
  IF tab IS NULL OR _entity_id IS NULL THEN RETURN false; END IF;
  EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id=$1',tab) INTO row_data USING _entity_id;
  IF row_data IS NULL OR coalesce((row_data->>'is_demo')::boolean,false) THEN RETURN false; END IF;
  IF row_data->>'property_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.properties WHERE id=(row_data->>'property_id')::uuid AND is_demo=false) THEN RETURN false; END IF;
  IF row_data->>'program_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.owner_programs WHERE id=(row_data->>'program_id')::uuid AND is_demo=false) THEN RETURN false; END IF;
  IF row_data->>'project_id' IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.onboarding_projects WHERE id=(row_data->>'project_id')::uuid AND is_demo=false) THEN RETURN false; END IF;
  IF tab='staff_notifications' AND row_data->>'entity_id' IS NOT NULL THEN
    RETURN public.email_delivery_allowed(_recipients,
      CASE row_data->>'entity_type' WHEN 'vendor' THEN 'vendor_org' ELSE row_data->>'entity_type' END,
      (row_data->>'entity_id')::uuid,NULL,_actor_id);
  END IF;
 END IF;
 RETURN true;
END $function$
;
CREATE OR REPLACE FUNCTION public.direct_booking_notify(_users uuid[], _kind text, _title text, _body text, _lead uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE n integer;
BEGIN
  INSERT INTO public.staff_notifications(user_id, kind, title, body, entity_type, entity_id, link_path, priority, is_demo)
  SELECT DISTINCT u, _kind, _title, _body, 'lead', _lead, '/direct-bookings/' || _lead, 'high',
         coalesce((SELECT is_demo FROM public.leads WHERE id = _lead), false)
  FROM unnest(_users) u WHERE u IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $function$
;
CREATE OR REPLACE FUNCTION public.staff_assignable(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT _user_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role::text IN ('admin','manager','onboarding','tech')
  )
$function$
;
CREATE OR REPLACE FUNCTION public.seat_override_at(_role_code text, _at timestamp with time zone DEFAULT now())
 RETURNS TABLE(kind text, user_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT o.kind, o.user_id
  FROM public.coverage_overrides o
  WHERE o.role_code = _role_code AND _at >= o.starts_at AND _at < o.ends_at
  ORDER BY o.created_at DESC
  LIMIT 1
$function$
;
CREATE OR REPLACE FUNCTION public.is_onboarding_director(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.functional_roles
    WHERE code IN ('onboarding_director','director_onboarding','director_ops') AND current_seat_holder = _user_id)
$function$
;
CREATE OR REPLACE FUNCTION public.direct_booking_daily_summary(_at timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _day date := ((_at AT TIME ZONE 'America/Chicago')::date - 1); _count int; _body text;
BEGIN
  IF extract(hour FROM _at AT TIME ZONE 'America/Chicago') < 7 THEN RETURN 0; END IF;
  IF EXISTS (SELECT 1 FROM public.staff_notifications WHERE kind = 'direct_booking_daily' AND title LIKE '%' || to_char(_day, 'Mon FMDD') || '%') THEN RETURN 0; END IF;
  SELECT count(*), string_agg(coalesce(partner_name, company, 'Partner') || ': ' || coalesce(reply_subject, ''), E'\n' ORDER BY reply_sent_at)
    INTO _count, _body
    FROM public.leads WHERE kind = 'direct_booking' AND (reply_sent_at AT TIME ZONE 'America/Chicago')::date = _day;
  IF _count = 0 THEN RETURN 0; END IF;
  INSERT INTO public.staff_notifications(user_id, kind, title, body, link_path, priority)
  SELECT u, 'direct_booking_daily', 'Direct booking replies sent ' || to_char(_day, 'Mon FMDD') || ': ' || _count, _body, '/direct-bookings', 'normal'
    FROM public.functional_role_holders('ops_supervisor') u;
  RETURN _count;
END $function$
;
CREATE OR REPLACE FUNCTION public.keep_reopened_notion_ticket()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF coalesce(current_setting('resolve.import_quiet', true), '') = 'on' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION public.coordinators_on_shift(_at timestamp with time zone DEFAULT now())
 RETURNS TABLE(user_id uuid, role_code text, team text, covering boolean, at_lunch boolean, load integer, last_given timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH l AS (
    SELECT EXTRACT(dow FROM (_at AT TIME ZONE 'America/Chicago'))::int AS wd,
           (EXTRACT(hour FROM (_at AT TIME ZONE 'America/Chicago'))::int * 60
            + EXTRACT(minute FROM (_at AT TIME ZONE 'America/Chicago'))::int) AS m
  ), r AS (
    SELECT fr.code, fr.team,
           public.seat_holder_at(fr.code, _at) AS uid,
           coalesce((SELECT o.kind FROM public.seat_override_at(fr.code, _at) o) = 'cover', false) AS covering
    FROM public.functional_roles fr
    WHERE fr.active
      AND fr.code IN ('ge_day', 'ge_evening', 'ge_parttime', 'po_day', 'po_evening')
      AND public.seat_eligible_now(fr.code, _at)
  )
  SELECT r.uid, r.code, r.team, r.covering,
    EXISTS (
      SELECT 1 FROM public.coverage_shifts s, l
      WHERE s.role_code = r.code AND s.active AND s.weekday = l.wd
        AND s.lunch_start_minute IS NOT NULL
        AND l.m >= s.lunch_start_minute AND l.m < s.lunch_end_minute),
    coalesce((
      SELECT sum(CASE t.priority WHEN 'p1' THEN 5 WHEN 'p2' THEN 3 ELSE 1 END)
      FROM public.tickets t
      WHERE t.current_action_owner = r.uid
        AND t.status NOT IN ('resolved', 'closed', 'waiting')
        AND t.archived_at IS NULL
        AND NOT coalesce(t.is_demo, false)
        AND NOT (t.external_source IS NOT DISTINCT FROM 'notion'
                 AND t.external_status IS DISTINCT FROM 'reopened_in_resolve')), 0)::int,
    (SELECT max(t.created_at) FROM public.tickets t
      WHERE t.current_action_owner = r.uid
        AND t.assignment_source IN ('automatic', 'breezeway_auto_route'))
  FROM r
  WHERE public.staff_assignable(r.uid)
$function$
;
CREATE OR REPLACE FUNCTION public.coordinator_for(_team text, _at timestamp with time zone DEFAULT now())
 RETURNS TABLE(user_id uuid, role_code text, note text, path text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  c record;
  v_team_label text := public.coordinator_team_label(_team);
  v_on_team int;
  v_on_team_free int;
  v_lunch_role text;
  v_who text;
  v_cfg public.coverage_config%ROWTYPE;
  v_tz text := 'America/Chicago';
  v_local timestamp;
  v_minutes int;
  v_overnight boolean := false;
  v_oncall uuid;
  v_sup uuid;
BEGIN
  IF v_team_label IS NULL THEN
    RAISE EXCEPTION 'Unknown team.';
  END IF;

  SELECT count(*) FILTER (WHERE s.team = _team),
         count(*) FILTER (WHERE s.team = _team AND NOT s.at_lunch)
    INTO v_on_team, v_on_team_free
  FROM public.coordinators_on_shift(_at) s;

  -- Same team, not at lunch.
  SELECT s.* INTO c FROM public.coordinators_on_shift(_at) s
   WHERE s.team = _team AND NOT s.at_lunch
   ORDER BY s.load, s.last_given NULLS FIRST, s.user_id
   LIMIT 1;
  IF FOUND THEN
    SELECT s.role_code INTO v_lunch_role FROM public.coordinators_on_shift(_at) s
     WHERE s.team = _team AND s.at_lunch ORDER BY s.role_code LIMIT 1;
    v_who := CASE WHEN c.covering THEN 'the person covering for the ' ELSE 'the ' END
             || public.coordinator_role_label(c.role_code);
    user_id := c.user_id;
    role_code := c.role_code;
    path := 'team';
    note := CASE
        WHEN v_lunch_role IS NOT NULL
          THEN 'The ' || public.coordinator_role_label(v_lunch_role) || ' is at lunch, so it was sent to ' || v_who || ' on shift.'
        ELSE 'Sent to ' || v_who || ' on shift.'
      END
      || CASE WHEN v_on_team_free > 1 THEN ' They had the least open work.' ELSE '' END;
    RETURN NEXT;
    RETURN;
  END IF;

  -- The other team, not at lunch.
  SELECT s.* INTO c FROM public.coordinators_on_shift(_at) s
   WHERE s.team <> _team AND NOT s.at_lunch
   ORDER BY s.load, s.last_given NULLS FIRST, s.user_id
   LIMIT 1;
  IF FOUND THEN
    v_who := CASE WHEN c.covering THEN 'the person covering for the ' ELSE 'the ' END
             || public.coordinator_role_label(c.role_code);
    user_id := c.user_id;
    role_code := c.role_code;
    path := 'other_team';
    note := CASE
        WHEN v_on_team = 0
          THEN 'No one on ' || v_team_label || ' was on shift, so it went to ' || v_who || ', who is working.'
        ELSE 'Everyone on ' || v_team_label || ' who is on shift is at lunch, so it went to ' || v_who || ', who is working.'
      END;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Only people at lunch are working: they still get it, same team first.
  SELECT s.* INTO c FROM public.coordinators_on_shift(_at) s
   ORDER BY (s.team <> _team), s.load, s.last_given NULLS FIRST, s.user_id
   LIMIT 1;
  IF FOUND THEN
    v_who := CASE WHEN c.covering THEN 'the person covering for the ' ELSE 'the ' END
             || public.coordinator_role_label(c.role_code);
    user_id := c.user_id;
    role_code := c.role_code;
    path := 'lunch_only';
    note := 'Sent to ' || v_who || ' on shift. They are at lunch, but no other coordinator is working.';
    RETURN NEXT;
    RETURN;
  END IF;

  -- No coordinator working: today's order, on call overnight, then the Operations Supervisor.
  SELECT * INTO v_cfg FROM public.coverage_config WHERE id LIMIT 1;
  IF v_cfg.timezone IS NOT NULL THEN
    v_tz := v_cfg.timezone;
  END IF;
  v_local := _at AT TIME ZONE v_tz;
  v_minutes := EXTRACT(hour FROM v_local)::int * 60 + EXTRACT(minute FROM v_local)::int;
  IF v_cfg.after_hours_start_minute IS NOT NULL AND v_cfg.after_hours_end_minute IS NOT NULL THEN
    v_overnight := CASE
      WHEN v_cfg.after_hours_start_minute > v_cfg.after_hours_end_minute
        THEN (v_minutes >= v_cfg.after_hours_start_minute OR v_minutes < v_cfg.after_hours_end_minute)
      ELSE (v_minutes >= v_cfg.after_hours_start_minute AND v_minutes < v_cfg.after_hours_end_minute)
    END;
  END IF;

  IF v_overnight THEN
    v_oncall := public.oncall_user_for_night(
      CASE WHEN v_minutes < v_cfg.after_hours_end_minute THEN v_local::date - 1 ELSE v_local::date END);
    IF v_oncall IS NOT NULL AND public.staff_assignable(v_oncall) THEN
      user_id := v_oncall;
      role_code := NULL;
      path := 'on_call';
      note := 'No coordinator was on shift overnight, so it went to the person on call tonight. Urgency is unchanged.';
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  SELECT fr.current_seat_holder INTO v_sup
  FROM public.functional_roles fr WHERE fr.code = 'ops_supervisor' AND fr.active;
  IF public.staff_assignable(v_sup)
     AND (SELECT o.kind FROM public.seat_override_at('ops_supervisor', _at) o) IS DISTINCT FROM 'off' THEN
    user_id := v_sup;
    role_code := 'ops_supervisor';
    path := 'supervisor';
    note := CASE
        WHEN v_overnight THEN 'No coordinator was on shift and no one is on call tonight, so it went to the Operations Supervisor.'
        ELSE 'No coordinator was on shift, so it went to the Operations Supervisor.'
      END
      || CASE WHEN public.seat_on_duty('ops_supervisor', _at) THEN ''
              ELSE ' The Operations Supervisor is not on shift right now; reassign it when a coordinator starts.' END;
    RETURN NEXT;
    RETURN;
  END IF;

  user_id := NULL;
  role_code := NULL;
  path := 'nobody';
  note := CASE
      WHEN public.staff_assignable(v_sup)
        THEN 'No coordinator was on shift and the Operations Supervisor is off, so it waits unassigned in its team queue.'
      ELSE 'No coordinator was on shift and no Operations Supervisor is set up, so no one has it yet. Assign it by hand.'
    END;
  RETURN NEXT;
END $function$
;
CREATE OR REPLACE FUNCTION public.ticket_route_at(_role_code text, _work_type_id uuid, _at timestamp with time zone DEFAULT now())
 RETURNS TABLE(user_id uuid, role_code text, source text, note text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
#variable_conflict use_column
DECLARE
  v_pending_approval boolean;
  v_role_code text;
  v_role_name text;
  v_backup_code text;
  v_backup_name text;
  v_holder uuid;
  v_local timestamp;
  v_minutes int;
  v_local_date date;
  v_overnight boolean := false;
  v_oncall uuid;
  v_sup_holder uuid;
  v_sup_on_duty boolean;
  v_cfg public.coverage_config%ROWTYPE;
  v_tz text := 'America/Chicago';
  v_pick record;
BEGIN
  SELECT * INTO v_cfg FROM public.coverage_config WHERE id LIMIT 1;
  IF v_cfg.timezone IS NOT NULL THEN
    v_tz := v_cfg.timezone;
  END IF;

  v_local := _at AT TIME ZONE v_tz;
  v_local_date := v_local::date;
  v_minutes := EXTRACT(hour FROM v_local)::int * 60 + EXTRACT(minute FROM v_local)::int;

  IF v_cfg.after_hours_start_minute IS NOT NULL AND v_cfg.after_hours_end_minute IS NOT NULL THEN
    v_overnight := CASE
      WHEN v_cfg.after_hours_start_minute > v_cfg.after_hours_end_minute
        THEN (v_minutes >= v_cfg.after_hours_start_minute OR v_minutes < v_cfg.after_hours_end_minute)
      ELSE (v_minutes >= v_cfg.after_hours_start_minute AND v_minutes < v_cfg.after_hours_end_minute)
    END;
  END IF;

  IF _work_type_id IS NOT NULL THEN
    SELECT wt.pending_approval INTO v_pending_approval FROM public.work_types wt WHERE wt.id = _work_type_id;
  END IF;

  IF v_pending_approval THEN
    user_id := NULL;
    role_code := NULL;
    source := NULL;
    note := 'Not sent to anyone: who owns this work type is not decided yet.';
    RETURN NEXT;
    RETURN;
  END IF;

  v_role_code := _role_code;
  IF v_role_code IS NULL AND _work_type_id IS NOT NULL THEN
    SELECT wt.functional_role_code INTO v_role_code FROM public.work_types wt WHERE wt.id = _work_type_id;
  END IF;

  -- ---------- Coordinator work: routed by the time ----------
  IF v_role_code IN ('ge_day', 'ge_evening', 'ge_parttime', 'po_day', 'po_evening') THEN
    SELECT * INTO v_pick FROM public.coordinator_for(
      CASE WHEN v_role_code LIKE 'ge\_%' THEN 'guest_experience' ELSE 'property_operations' END, _at);
    user_id := v_pick.user_id;
    role_code := v_pick.role_code;
    source := CASE WHEN v_pick.user_id IS NULL THEN NULL ELSE 'automatic' END;
    note := v_pick.note;
    RETURN NEXT;
    RETURN;
  END IF;

  -- ---------- Everything else: today's order ----------
  IF v_overnight THEN
    v_oncall := public.oncall_user_for_night(
      CASE WHEN v_minutes < v_cfg.after_hours_end_minute THEN v_local_date - 1 ELSE v_local_date END);

    IF v_oncall IS NOT NULL AND public.staff_assignable(v_oncall) THEN
      user_id := v_oncall;
      role_code := NULL;
      source := 'automatic';
      note := 'Came in overnight, so it went to the person on call tonight. Urgency is unchanged.';
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  IF NOT v_overnight AND v_role_code IS NOT NULL THEN
    SELECT fr.name, fr.backup_role_code
      INTO v_role_name, v_backup_code
    FROM public.functional_roles fr WHERE fr.code = v_role_code AND fr.active;
    v_holder := CASE WHEN FOUND THEN public.seat_holder_at(v_role_code, _at) END;

    IF public.staff_assignable(v_holder) AND public.seat_eligible_now(v_role_code, _at) THEN
      user_id := v_holder;
      role_code := v_role_code;
      source := 'automatic';
      note := CASE
        WHEN (SELECT o.kind FROM public.seat_override_at(v_role_code, _at) o) = 'cover'
          THEN 'Sent to the person covering for the ' || COALESCE(v_role_name, 'role that owns this work') || ' right now.'
        ELSE 'Sent to the ' || COALESCE(v_role_name, 'role that owns this work') || ', who owns this work.'
      END;
      RETURN NEXT;
      RETURN;
    END IF;

    IF v_backup_code IS NOT NULL THEN
      SELECT fr.name INTO v_backup_name
      FROM public.functional_roles fr WHERE fr.code = v_backup_code AND fr.active;
      v_holder := CASE WHEN FOUND THEN public.seat_holder_at(v_backup_code, _at) END;

      IF public.staff_assignable(v_holder) AND public.seat_eligible_now(v_backup_code, _at) THEN
        user_id := v_holder;
        role_code := v_backup_code;
        source := 'automatic';
        note := 'The ' || COALESCE(v_role_name, 'role that owns this work')
          || ' is not available right now, so it went to the ' || COALESCE(v_backup_name, 'backup role') || '.';
        RETURN NEXT;
        RETURN;
      END IF;
    END IF;
  ELSIF v_overnight AND v_role_code IS NOT NULL THEN
    SELECT fr.name INTO v_role_name FROM public.functional_roles fr WHERE fr.code = v_role_code AND fr.active;
  END IF;

  SELECT fr.current_seat_holder INTO v_sup_holder
  FROM public.functional_roles fr WHERE fr.code = 'ops_supervisor' AND fr.active;

  IF public.staff_assignable(v_sup_holder)
     AND (SELECT o.kind FROM public.seat_override_at('ops_supervisor', _at) o) IS DISTINCT FROM 'off' THEN
    v_sup_on_duty := public.seat_on_duty('ops_supervisor', _at);
    user_id := v_sup_holder;
    role_code := 'ops_supervisor';
    source := 'automatic';
    note := CASE
      WHEN v_overnight THEN 'Came in overnight and no one is on call tonight, so the Operations Supervisor has it. Reassign it in the morning if it belongs to someone else.'
      WHEN v_role_code IS NULL THEN 'No role owns this work, so it went to the Operations Supervisor to place.'
      ELSE 'The ' || COALESCE(v_role_name, 'role that owns this work')
        || ' and its backup are not available right now, so it went to the Operations Supervisor.'
    END
    || CASE WHEN v_sup_on_duty THEN '' ELSE ' The Operations Supervisor is not on shift right now; this only keeps it from having no owner.' END;
    RETURN NEXT;
    RETURN;
  END IF;

  user_id := NULL;
  role_code := NULL;
  source := NULL;
  note := CASE
      WHEN public.staff_assignable(v_sup_holder)
        THEN 'Not sent to anyone: nobody is available and the Operations Supervisor is off, so it waits unassigned in its team queue.'
      ELSE 'Not sent to anyone: no role owns this work and no Operations Supervisor is set up. Assign it by hand.'
    END;
  RETURN NEXT;
END $function$
;
CREATE OR REPLACE FUNCTION public.direct_booking_on_shift(_at timestamp with time zone DEFAULT now())
 RETURNS SETOF uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH c AS (SELECT * FROM public.coordinators_on_shift(_at)),
  d AS (SELECT public.direct_booking_overnight_until(_at) IS NULL AS daytime),
  k AS (
    SELECT CASE
      WHEN EXISTS (SELECT 1 FROM c WHERE c.team = 'guest_experience' AND NOT c.at_lunch) THEN 1
      WHEN EXISTS (SELECT 1 FROM c WHERE NOT c.at_lunch) THEN 2
      WHEN EXISTS (SELECT 1 FROM c WHERE c.team = 'guest_experience') THEN 3
      WHEN EXISTS (SELECT 1 FROM c) THEN 4
      ELSE 5
    END AS tier
  )
  SELECT c.user_id FROM c, k, d
   WHERE d.daytime
     AND ((k.tier = 1 AND c.team = 'guest_experience' AND NOT c.at_lunch)
      OR (k.tier = 2 AND NOT c.at_lunch)
      OR (k.tier = 3 AND c.team = 'guest_experience')
      OR k.tier = 4)
  UNION
  SELECT h.u FROM k, d,
    (SELECT public.functional_role_holders('ops_supervisor') AS u
     UNION SELECT public.functional_role_holders('director_ops')) h
   WHERE d.daytime AND k.tier = 5 AND h.u IS NOT NULL
$function$
;
CREATE OR REPLACE FUNCTION public.direct_booking_overnight_until(_at timestamp with time zone DEFAULT now())
 RETURNS timestamp with time zone
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  WITH cfg AS (
    SELECT coalesce(cc.timezone, 'America/Chicago') AS tz,
           cc.after_hours_start_minute AS s, cc.after_hours_end_minute AS e
    FROM public.coverage_config cc WHERE cc.id LIMIT 1
  ),
  n AS (
    SELECT (_at AT TIME ZONE cfg.tz) AS loc, cfg.tz, cfg.s, cfg.e,
           EXTRACT(hour FROM (_at AT TIME ZONE cfg.tz))::int * 60
             + EXTRACT(minute FROM (_at AT TIME ZONE cfg.tz))::int AS m
    FROM cfg
  )
  SELECT ((n.loc::date + CASE WHEN n.m < n.e THEN 0 ELSE 1 END) + make_interval(mins => n.e)) AT TIME ZONE n.tz
  FROM n
  WHERE n.s IS NOT NULL AND n.e IS NOT NULL
    AND CASE WHEN n.s > n.e THEN (n.m >= n.s OR n.m < n.e) ELSE (n.m >= n.s AND n.m < n.e) END
$function$
;
CREATE OR REPLACE FUNCTION public.release_overnight_direct_bookings(_at timestamp with time zone DEFAULT now())
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _r record; _users uuid[]; _n integer := 0; _start text; _clock text;
BEGIN
  IF public.direct_booking_overnight_until(_at) IS NOT NULL THEN RETURN 0; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.leads WHERE kind = 'direct_booking' AND overnight_until <= _at
                   AND morning_alerted_at IS NULL AND owned_by IS NULL AND outcome IS NULL AND reply_sent_at IS NULL) THEN
    RETURN 0;
  END IF;
  _users := ARRAY(SELECT public.direct_booking_on_shift(_at));
  -- The Overnight reply clock starts at setting (register D3), default 9:00 AM.
  _start := (SELECT value->>'overnightClockStart' FROM public.app_settings WHERE key = 'direct_booking_settings');
  IF _start IS NULL OR _start !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN _start := '09:00'; END IF;
  _clock := to_char(('2000-01-01 ' || _start)::timestamp, 'FMHH12:MI AM');
  FOR _r IN
    SELECT id, partner_name, company FROM public.leads
     WHERE kind = 'direct_booking' AND overnight_until <= _at AND morning_alerted_at IS NULL
       AND owned_by IS NULL AND outcome IS NULL AND reply_sent_at IS NULL
     ORDER BY created_at
     FOR UPDATE SKIP LOCKED
  LOOP
    PERFORM public.direct_booking_notify(
      _users,
      'direct_booking_new',
      'New direct booking request',
      coalesce(_r.partner_name, _r.company, 'A partner') || ' wrote overnight and is waiting. Press Start to own it. Reply clock starts at ' || _clock || '.',
      _r.id);
    UPDATE public.leads SET morning_alerted_at = _at WHERE id = _r.id;
    _n := _n + 1;
  END LOOP;
  RETURN _n;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'release_overnight_direct_bookings: %', SQLERRM;
  RETURN 0;
END $function$
;
CREATE OR REPLACE FUNCTION private.ticket_owner_wait_clock()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  _wait interval;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.assigned_to IS NULL THEN
      NEW.unowned_since := coalesce(NEW.unowned_since, NEW.reported_at, now());
    ELSE
      NEW.unowned_since := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.assigned_to IS NOT NULL AND NEW.assigned_to IS NULL THEN
    -- Given back: it waits for an owner again from now.
    NEW.unowned_since := now();
  ELSIF OLD.assigned_to IS NULL AND NEW.assigned_to IS NOT NULL THEN
    -- Taken: the wait never counts against the person who takes it.
    IF OLD.unowned_since IS NOT NULL THEN
      _wait := greatest(now() - OLD.unowned_since, interval '0');
      IF OLD.acknowledged_at IS NULL AND NEW.response_due_at IS NOT NULL
         AND NEW.response_due_at IS NOT DISTINCT FROM OLD.response_due_at THEN
        NEW.response_due_at := NEW.response_due_at + _wait;
      END IF;
      IF OLD.action_started_at IS NULL AND NEW.action_due_at IS NOT NULL
         AND NEW.action_due_at IS NOT DISTINCT FROM OLD.action_due_at THEN
        NEW.action_due_at := NEW.action_due_at + _wait;
      END IF;
    END IF;
    NEW.unowned_since := NULL;
  END IF;
  RETURN NEW;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.run_ticket_timed_alerts()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _cfg jsonb := coalesce((SELECT value FROM public.app_settings WHERE key = 'team_queue_timing'), '{}'::jsonb);
  _sup_min int := 10;
  _dir_min int := 15;
  _handoff_min int := 15;
  _t record;
  _to uuid;
  _log uuid;
  _ref text;
  _sent integer := 0;
BEGIN
  BEGIN
    _sup_min := coalesce(nullif(_cfg->>'supervisor_minutes', '')::int, 10);
    _dir_min := coalesce(nullif(_cfg->>'director_minutes', '')::int, 15);
  EXCEPTION WHEN others THEN
    _sup_min := 10; _dir_min := 15;
  END;
  BEGIN
    _handoff_min := coalesce(nullif(_cfg->>'handoff_minutes', '')::int, 15);
  EXCEPTION WHEN others THEN
    _handoff_min := 15;
  END;

  -- a. Right now tickets nobody has taken.
  FOR _t IN
    SELECT id, ref, title, unowned_since
      FROM public.tickets
     WHERE priority = 'p1'
       AND assigned_to IS NULL
       AND archived_at IS NULL
       AND unowned_since IS NOT NULL
       AND NOT coalesce(is_demo, false)
       AND status IN ('open','dispatched','in_progress','awaiting_guest')
       AND NOT (coalesce(external_source, '') = 'notion' AND external_status IS DISTINCT FROM 'reopened_in_resolve')
       AND unowned_since <= now() - make_interval(mins => _sup_min)
  LOOP
    _ref := coalesce('#' || _t.ref::text || ' ', '');

    _to := public.seat_holder_at('ops_supervisor', now());
    IF _to IS NOT NULL THEN
      _log := NULL;
      INSERT INTO public.ticket_timed_alerts(ticket_id, kind, episode_at, recipient)
      VALUES (_t.id, 'team_queue_supervisor', _t.unowned_since, _to)
      ON CONFLICT ON CONSTRAINT ticket_timed_alerts_once DO NOTHING
      RETURNING id INTO _log;
      IF _log IS NOT NULL THEN
        UPDATE public.ticket_timed_alerts SET notification_id = public.notify_staff(
          _to, 'team_queue_supervisor',
          'Nobody has taken this: ' || _ref || coalesce(_t.title, 'Ticket'),
          'A Right now ticket has waited ' || _sup_min || ' minutes in the Team Queue with no owner. Give it to someone on shift or take it.',
          'ticket', _t.id, '/tickets/' || _t.id::text, 'urgent', NULL, true, false)
        WHERE id = _log;
        _sent := _sent + 1;
      END IF;
    END IF;

    IF _t.unowned_since <= now() - make_interval(mins => _dir_min) THEN
      _to := public.seat_holder_at('director_ops', now());
      IF _to IS NOT NULL THEN
        _log := NULL;
        INSERT INTO public.ticket_timed_alerts(ticket_id, kind, episode_at, recipient)
        VALUES (_t.id, 'team_queue_director', _t.unowned_since, _to)
        ON CONFLICT ON CONSTRAINT ticket_timed_alerts_once DO NOTHING
        RETURNING id INTO _log;
        IF _log IS NOT NULL THEN
          UPDATE public.ticket_timed_alerts SET notification_id = public.notify_staff(
            _to, 'team_queue_director',
            'Still nobody on it: ' || _ref || coalesce(_t.title, 'Ticket'),
            'A Right now ticket has waited ' || _dir_min || ' minutes in the Team Queue with no owner. The Operations Supervisor was alerted at ' || _sup_min || ' minutes.',
            'ticket', _t.id, '/tickets/' || _t.id::text, 'urgent', NULL, true, false)
          WHERE id = _log;
          _sent := _sent + 1;
        END IF;
      END IF;
    END IF;
  END LOOP;

  -- b. Waiting tickets whose return time has come.
  FOR _t IN
    SELECT id, ref, title, next_review_at, coalesce(assigned_to, current_action_owner) AS owner, coalesce(is_demo, false) AS is_demo
      FROM public.tickets
     WHERE status = 'waiting'
       AND archived_at IS NULL
       AND next_review_at IS NOT NULL
       AND next_review_at <= now()
       AND coalesce(assigned_to, current_action_owner) IS NOT NULL
       AND NOT (coalesce(external_source, '') = 'notion' AND external_status IS DISTINCT FROM 'reopened_in_resolve')
  LOOP
    _log := NULL;
    INSERT INTO public.ticket_timed_alerts(ticket_id, kind, episode_at, recipient)
    VALUES (_t.id, 'waiting_return', _t.next_review_at, _t.owner)
    ON CONFLICT ON CONSTRAINT ticket_timed_alerts_once DO NOTHING
    RETURNING id INTO _log;
    IF _log IS NOT NULL THEN
      UPDATE public.ticket_timed_alerts SET notification_id = public.notify_staff(
        _t.owner, 'waiting_returned',
        'Back from waiting: ' || coalesce('#' || _t.ref::text || ' ', '') || coalesce(_t.title, 'Ticket'),
        'The return time you set has come. Pick it up again.',
        'ticket', _t.id, '/tickets/' || _t.id::text, 'normal', NULL, true, _t.is_demo)
      WHERE id = _log;
      _sent := _sent + 1;
    END IF;
  END LOOP;

  -- c. Right now handoffs nobody has accepted (register T6): the receiver and the
  --    Operations Supervisor, once each, after _handoff_min minutes. A handoff to a
  --    role with no person still reaches the Supervisor.
  FOR _t IN
    SELECT h.id AS handoff_id, h.ticket_id, h.to_user, h.created_at, t.ref, t.title,
           coalesce(h.is_demo, false) AS is_demo
      FROM public.handoffs h
      JOIN public.tickets t ON t.id = h.ticket_id
     WHERE h.status = 'pending'
       AND h.priority = 'p1'
       AND h.created_at <= now() - make_interval(mins => _handoff_min)
       AND t.archived_at IS NULL
       AND t.status NOT IN ('resolved', 'closed')
  LOOP
    _ref := coalesce('#' || _t.ref::text || ' ', '');

    IF _t.to_user IS NOT NULL THEN
      _log := NULL;
      INSERT INTO public.ticket_timed_alerts(ticket_id, kind, episode_at, recipient)
      VALUES (_t.ticket_id, 'handoff_receiver', _t.created_at, _t.to_user)
      ON CONFLICT ON CONSTRAINT ticket_timed_alerts_once DO NOTHING
      RETURNING id INTO _log;
      IF _log IS NOT NULL THEN
        UPDATE public.ticket_timed_alerts SET notification_id = public.notify_staff(
          _t.to_user, 'handoff_unaccepted',
          'Still waiting for you: ' || _ref || coalesce(_t.title, 'Ticket'),
          'A Right now handoff has waited ' || _handoff_min || ' minutes. Accept it or decline it with a reason now.',
          'handoff', _t.handoff_id, '/tickets/' || _t.ticket_id::text, 'urgent', NULL, true, _t.is_demo)
        WHERE id = _log;
        _sent := _sent + 1;
      END IF;
    END IF;

    _to := public.seat_holder_at('ops_supervisor', now());
    IF _to IS NOT NULL AND _to IS DISTINCT FROM _t.to_user THEN
      _log := NULL;
      INSERT INTO public.ticket_timed_alerts(ticket_id, kind, episode_at, recipient)
      VALUES (_t.ticket_id, 'handoff_supervisor', _t.created_at, _to)
      ON CONFLICT ON CONSTRAINT ticket_timed_alerts_once DO NOTHING
      RETURNING id INTO _log;
      IF _log IS NOT NULL THEN
        UPDATE public.ticket_timed_alerts SET notification_id = public.notify_staff(
          _to, 'handoff_unaccepted_supervisor',
          'Handoff not accepted: ' || _ref || coalesce(_t.title, 'Ticket'),
          'A Right now handoff has waited ' || _handoff_min || ' minutes and nobody has accepted it. Make sure someone has it.',
          'handoff', _t.handoff_id, '/tickets/' || _t.ticket_id::text, 'urgent', NULL, true, _t.is_demo)
        WHERE id = _log;
        _sent := _sent + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN _sent;
END;
$function$
;
CREATE OR REPLACE FUNCTION public.record_work_escalate(_ticket_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _t record;
  _id uuid;
  _supervisor uuid;
BEGIN
  IF NOT private.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'Only Resolve staff can escalate a ticket.';
  END IF;
  SELECT id, ref, title, property_id, is_demo, created_by, archived_at
    INTO _t FROM public.tickets WHERE id = _ticket_id FOR UPDATE;
  IF NOT FOUND OR _t.archived_at IS NOT NULL THEN
    RAISE EXCEPTION 'That ticket could not be found.';
  END IF;
  IF _t.created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Only the person who recorded this ticket can escalate it here.';
  END IF;

  SELECT e.id INTO _id FROM public.escalations e
  WHERE e.ticket_id = _ticket_id AND e.status = 'open'
  ORDER BY e.created_at DESC LIMIT 1;
  IF _id IS NOT NULL THEN
    RETURN _id;
  END IF;

  INSERT INTO public.escalations (
    ticket_id, property_id, escalated_by, escalated_to_role, reason, help_needed, urgency, is_demo
  ) VALUES (
    _ticket_id, _t.property_id, auth.uid(), 'supervisor',
    'This could be an insurance claim. Escalated before taking action.',
    'Decide what happens next. The team waits for your answer before acting.',
    'critical', _t.is_demo
  ) RETURNING id INTO _id;

  UPDATE public.tickets
  SET escalation_level = CASE WHEN escalation_level = 'none' THEN 'supervisor' ELSE escalation_level END,
      escalated_at = coalesce(escalated_at, now())
  WHERE id = _ticket_id;

  INSERT INTO public.ticket_activity (ticket_id, author_id, kind, event_type, internal, body)
  VALUES (_ticket_id, auth.uid(), 'status', 'escalated', false,
    'Escalated to the Operations Supervisor: this could be an insurance claim. Ownership is unchanged.');

  _supervisor := public.seat_holder_at('ops_supervisor', now());
  PERFORM public.notify_staff(
    _supervisor, 'ticket_escalated',
    'Escalated: #' || _t.ref::text || ' ' || _t.title,
    'This could be an insurance claim. The team is waiting for your answer before acting.',
    'ticket', _ticket_id, '/tickets/' || _ticket_id::text, 'high', auth.uid(), true, _t.is_demo
  );

  RETURN _id;
END;
$function$
;
CREATE OR REPLACE FUNCTION private.ticket_due_on_default()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  s public.guest_ready_standards;
  _today date := (now() AT TIME ZONE 'America/Chicago')::date;
  _ruled date;
BEGIN
  IF coalesce(current_setting('resolve.import_quiet', true), '') <> 'on' THEN
    s := private.guest_ready_row(NEW.work_type_id, NEW.priority);
    IF s.id IS NOT NULL THEN
      _ruled := CASE s.rule
        WHEN 'same_day' THEN _today
        WHEN 'clean_day_4pm' THEN _today
        WHEN 'days' THEN _today + coalesce(s.rule_days, 7)
        ELSE NULL END;
      IF s.locked THEN
        NEW.due_locked := true;
        IF _ruled IS NOT NULL THEN NEW.due_on := _ruled; END IF;
      ELSIF NEW.due_on IS NULL AND _ruled IS NOT NULL THEN
        NEW.due_on := _ruled;
      END IF;
    END IF;
  END IF;
  IF NEW.due_on IS NULL THEN
    NEW.due_on := CASE lower(coalesce(NEW.priority, ''))
      WHEN 'p1' THEN _today WHEN 'p2' THEN _today WHEN 'p3' THEN _today + 7 ELSE NULL END;
  END IF;
  RETURN NEW;
END $function$
;
CREATE OR REPLACE FUNCTION private.guest_ready_row(_work_type_id uuid, _priority text)
 RETURNS guest_ready_standards
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT s.* FROM public.guest_ready_standards s
  WHERE (s.work_type_id IS NOT NULL AND s.work_type_id = _work_type_id)
     OR (s.match_priority = 'p1' AND lower(coalesce(_priority,'')) = 'p1'
         AND NOT EXISTS (SELECT 1 FROM public.guest_ready_standards o WHERE o.work_type_id = _work_type_id))
  ORDER BY (s.work_type_id IS NULL), s.sort_order LIMIT 1
$function$
;
CREATE OR REPLACE FUNCTION private.arrival_fmt_time(_at timestamp with time zone, _tz text)
 RETURNS text
 LANGUAGE sql
 STABLE
AS $function$
  SELECT to_char(_at AT TIME ZONE 'America/Chicago', 'FMHH12:MI AM');
$function$
;
CREATE OR REPLACE FUNCTION private.arrival_home_label(_property_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT coalesce(nullif(public.format_property_label(to_jsonb(p)) ->> 'primary', ''),
                  nullif(btrim(p.address_line1), ''), p.nickname, p.name, 'Home')
    FROM public.properties p WHERE p.id = _property_id;
$function$
;
CREATE OR REPLACE FUNCTION private.arrival_check_create(_booking text, _check_in timestamp with time zone, _late boolean, _at timestamp with time zone)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
DECLARE
  r public.arrival_reservations;
  _tz text;
  _label text;
  _wt uuid;
  _ticket uuid;
  _check uuid;
  _deadline timestamptz := _check_in - interval '2 hours';
  _guests integer;
  _desc text;
BEGIN
  SELECT * INTO r FROM public.arrival_reservations WHERE ownerrez_booking_id = _booking FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reservation not found.'; END IF;
  SELECT coalesce(nullif(btrim(time_zone), ''), 'America/Chicago') INTO _tz FROM public.properties WHERE id = r.property_id;
  _tz := coalesce(_tz, 'America/Chicago');
  _label := coalesce(private.arrival_home_label(r.property_id), 'Home');
  SELECT id INTO _wt FROM public.work_types WHERE name = 'Arrival check' ORDER BY created_at LIMIT 1;
  _guests := nullif(coalesce(r.adults, 0) + coalesce(r.children, 0) + coalesce(r.infants, 0), 0);
  _desc := 'Guest arrives at ' || private.arrival_fmt_time(_check_in, _tz) || '. Check the home by '
           || private.arrival_fmt_time(_deadline, _tz) || ', or flag the issue with a safe backup plan.';
  INSERT INTO public.tickets
    (record_type, title, description, property_id, priority, suggested_priority, status, source_channel,
     initiator_type, external_source, external_id, reported_at, department_code, functional_role_code,
     work_type_id, is_demo, due_at, next_action, next_action_due_at, guest_in_residence,
     reservation_guest_name, reservation_arrival, reservation_departure, reservation_guest_count,
     reservation_snapshot_at, response_due_at, action_due_at)
  VALUES ('active_task', 'Arrival check: ' || _label || CASE WHEN r.is_test THEN ' (test)' ELSE '' END, _desc,
          CASE WHEN r.is_test THEN NULL ELSE r.property_id END, 'p2', 'p2', 'open', 'ownerrez', 'external',
          'ownerrez', 'arrival:' || _booking, _at, 'operations', 'po_day', _wt, r.is_test, _deadline,
          'Check the home is ready for the guest', _deadline, false, r.guest_first_name, r.arrival_on,
          r.departure_on, _guests, _at, _at + interval '30 minutes', _at + interval '60 minutes')
  RETURNING id INTO _ticket;
  PERFORM set_config('resolve.arrival_check_writing', 'on', true);
  INSERT INTO public.arrival_checks
    (ownerrez_booking_id, property_id, ticket_id, home_label, arrival_on, check_in_at, deadline_at, time_zone,
     team, owner_stay, late_booking, is_test, guest_first_name, guests, pets, created_at)
  VALUES (_booking, r.property_id, _ticket, _label, r.arrival_on, _check_in, _deadline, _tz,
          'property_operations', r.owner_stay, coalesce(_late, false), r.is_test, r.guest_first_name, _guests,
          r.pets, _at)
  RETURNING id INTO _check;
  PERFORM set_config('resolve.arrival_check_writing', '', true);
  UPDATE public.arrival_reservations SET decision = 'created', decision_reason = NULL, decided_at = _at
   WHERE ownerrez_booking_id = _booking;
  RETURN _check;
END $function$
;
CREATE OR REPLACE FUNCTION public.oncall_user_for_night(_night date)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT r.user_id FROM public.oncall_roster r
      WHERE _night BETWEEN r.starts_on AND r.ends_on
      ORDER BY (r.ends_on - r.starts_on), r.created_at DESC
      LIMIT 1),
    (SELECT NULLIF(s.value ->> EXTRACT(dow FROM _night)::int::text, '')::uuid
      FROM public.app_settings s WHERE s.key = 'oncall_weekday_pattern')
  )
$function$
;
CREATE OR REPLACE FUNCTION private.sc_holds(_uid uuid, _code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT _uid IS NOT NULL AND (
    public.holds_functional_role(_uid, _code)
    OR public.seat_holder_at(_code) IS NOT DISTINCT FROM _uid
  )
$function$
;
CREATE OR REPLACE FUNCTION public.format_property_label(_property jsonb)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
 WITH parts AS (
  SELECT coalesce(btrim(_property->>'address_line1'),'') street,
   coalesce(btrim(_property->>'unit'),'') unit,
   coalesce(nullif(btrim(_property->>'name'),''),'Home') listing,
   coalesce(btrim(_property->>'city'),'') city,
   coalesce(btrim(_property->>'state'),'') state,
   coalesce(btrim(_property->>'postal_code'),'') zip
 ), labels AS (
  SELECT CASE WHEN street<>'' THEN street || CASE WHEN unit='' THEN '' ELSE ', ' || CASE WHEN unit ~* '^unit\y' THEN unit ELSE 'Unit ' || unit END END
   ELSE listing || ' (address missing)' END primary_label,
   concat_ws(', ',nullif(city,''),nullif(state,'')) secondary_label,
   city,concat_ws(' ',nullif(state,''),nullif(zip,'')) region FROM parts
 ) SELECT jsonb_build_object('primary',primary_label,'secondary',secondary_label,
  'full',concat_ws(', ',primary_label,nullif(city,''),nullif(region,''))) FROM labels
$function$
;
CREATE OR REPLACE FUNCTION public.seat_on_duty(_role_code text, _at timestamp with time zone DEFAULT now())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM public.coverage_shifts c WHERE c.role_code = _role_code AND c.active)
      THEN NOT (_role_code LIKE 'ge\_%' OR _role_code LIKE 'po\_%')
      -- only scheduled coverage seats (ge_*, po_*) with no recurring shifts are off duty (Pass A.2);
      -- every other seat keeps the previous rule: no shifts means always on duty
    ELSE EXISTS (
      SELECT 1 FROM public.coverage_shifts c
      WHERE c.role_code = _role_code AND c.active
        AND c.weekday = EXTRACT(dow FROM (_at AT TIME ZONE 'America/Chicago'))::int
        AND (EXTRACT(hour FROM (_at AT TIME ZONE 'America/Chicago'))::int * 60
             + EXTRACT(minute FROM (_at AT TIME ZONE 'America/Chicago'))::int)
            >= c.start_minute
        AND (EXTRACT(hour FROM (_at AT TIME ZONE 'America/Chicago'))::int * 60
             + EXTRACT(minute FROM (_at AT TIME ZONE 'America/Chicago'))::int)
            < c.end_minute
    )
  END
$function$
;
CREATE OR REPLACE FUNCTION public.coordinator_role_label(_code text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE _code
    WHEN 'ge_day' THEN 'Guest Experience day and weekend coordinator'
    WHEN 'ge_evening' THEN 'Guest Experience evening coordinator'
    WHEN 'ge_parttime' THEN 'Guest Experience part time coordinator'
    WHEN 'po_day' THEN 'Property Operations weekday day coordinator'
    WHEN 'po_evening' THEN 'Property Operations evening and weekend coordinator'
  END
$function$
;
CREATE OR REPLACE FUNCTION public.coordinator_team_label(_team text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE _team
    WHEN 'guest_experience' THEN 'Guest Experience'
    WHEN 'property_operations' THEN 'Property Operations'
  END
$function$
;
CREATE OR REPLACE FUNCTION public.holds_functional_role(_user_id uuid, _code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.functional_roles WHERE code = _code AND active AND current_seat_holder = _user_id)
      OR EXISTS (SELECT 1 FROM public.functional_role_members WHERE role_code = _code AND user_id = _user_id);
$function$
;
CREATE TRIGGER notify_ticket_events_trg AFTER INSERT OR UPDATE ON public.tickets FOR EACH ROW WHEN ((current_setting('resolve.import_quiet'::text, true) IS DISTINCT FROM 'on'::text)) EXECUTE FUNCTION notify_ticket_events();
CREATE TRIGGER tickets_audit AFTER UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION audit_ticket_change();
CREATE TRIGGER tickets_auto_assign BEFORE INSERT ON public.tickets FOR EACH ROW WHEN ((current_setting('resolve.import_quiet'::text, true) IS DISTINCT FROM 'on'::text)) EXECUTE FUNCTION auto_assign_ticket();
CREATE TRIGGER tickets_keep_reopened_notion BEFORE UPDATE ON public.tickets FOR EACH ROW WHEN (((old.external_source = 'notion'::text) AND (old.external_status = 'reopened_in_resolve'::text))) EXECUTE FUNCTION keep_reopened_notion_ticket();
CREATE TRIGGER tickets_owner_wait_clock BEFORE INSERT OR UPDATE OF assigned_to ON public.tickets FOR EACH ROW WHEN ((current_setting('resolve.import_quiet'::text, true) IS DISTINCT FROM 'on'::text)) EXECUTE FUNCTION private.ticket_owner_wait_clock();
CREATE TRIGGER tickets_updated BEFORE UPDATE ON public.tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER tickets_zz_due_on_default BEFORE INSERT ON public.tickets FOR EACH ROW EXECUTE FUNCTION private.ticket_due_on_default();
CREATE TRIGGER routine_controls_lock_completed BEFORE DELETE OR UPDATE ON public.routine_controls FOR EACH ROW EXECUTE FUNCTION private.lock_completed_routine_check();
CREATE TRIGGER routine_controls_stamp_completion BEFORE INSERT OR UPDATE OF status ON public.routine_controls FOR EACH ROW EXECUTE FUNCTION private.stamp_routine_completion();
CREATE TRIGGER routine_controls_updated_at BEFORE UPDATE ON public.routine_controls FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
SET check_function_bodies=on;
