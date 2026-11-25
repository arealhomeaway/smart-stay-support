-- Apply only on: Approved: apply property-delete-fix
-- onboarding_stage_captures is a view, not a table. Views have no rows of their own to remove,
-- and listing it made the safety check fail for every home. Removes it from the list only.
CREATE OR REPLACE FUNCTION public.property_delete_tables() RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$ SELECT ARRAY[
 'properties','onboarding_projects','onboarding_tasks','onboarding_notes','documents',
 'onboarding_project_stagers','onboarding_project_events','onboarding_task_batches',
 'onboarding_task_file_links','onboarding_task_stage_history','onboarding_task_reviews',
 'onboarding_task_review_events','onboarding_task_review_decisions','onboarding_task_breezeway_links',
 'onboarding_task_breezeway_events','onboarding_task_work_order_watch','onboarding_follows',
'onboarding_flag_snapshots','onboarding_daily_reminders',
 'property_owner_contacts','property_field_provenance','property_external_links',
 'property_credentials','property_label_assignments','property_label_events',
 'property_profile_photos','property_profile_edits','property_assets','property_fact_proposals',
 'property_activity_log','credential_intake_queue','credential_access_log',
 'work_items','work_item_resources','owner_reviews','owner_review_properties',
 'owner_request_messages','owner_notifications','owner_item_task_sends',
 'approvals','approval_email_responses','owner_approval_publications','owner_approval_receipts',
 'document_recipient_events','homeowner_answer_reviews','homeowner_updates',
 'owner_closing_updates','owner_closing_update_events','staff_notifications',
 'handoff_reminders','handoff_step_history','home_handoff_decisions','property_handoffs'
 ]::text[] $$;
