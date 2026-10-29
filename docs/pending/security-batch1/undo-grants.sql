-- UNDO for security batch 1: restores the exact owner and EXECUTE ACLs captured live on 2026-10-29.

ALTER FUNCTION public.invalidate_owner_report_version() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.invalidate_owner_report_version() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.invalidate_owner_report_version() TO anon;
GRANT EXECUTE ON FUNCTION public.invalidate_owner_report_version() TO service_role;
-- captured proacl: {postgres=X/postgres,anon=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.enforce_ticket_priority_authority() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.enforce_ticket_priority_authority() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.enforce_ticket_priority_authority() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.enforce_ticket_priority_authority() TO anon;
GRANT EXECUTE ON FUNCTION public.enforce_ticket_priority_authority() TO authenticated;
GRANT EXECUTE ON FUNCTION public.enforce_ticket_priority_authority() TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.record_onboarding_task_stage() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.record_onboarding_task_stage() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.record_onboarding_task_stage() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_onboarding_task_stage() TO anon;
GRANT EXECUTE ON FUNCTION public.record_onboarding_task_stage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_onboarding_task_stage() TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.touch_inquiry_source() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.touch_inquiry_source() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.touch_inquiry_source() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.touch_inquiry_source() TO anon;
GRANT EXECUTE ON FUNCTION public.touch_inquiry_source() TO authenticated;
GRANT EXECUTE ON FUNCTION public.touch_inquiry_source() TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.block_budget_history_mutation() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.block_budget_history_mutation() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.block_budget_history_mutation() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.block_budget_history_mutation() TO anon;
GRANT EXECUTE ON FUNCTION public.block_budget_history_mutation() TO authenticated;
GRANT EXECUTE ON FUNCTION public.block_budget_history_mutation() TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.create_correction_task_for_finding() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.create_correction_task_for_finding() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_correction_task_for_finding() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_correction_task_for_finding() TO anon;
GRANT EXECUTE ON FUNCTION public.create_correction_task_for_finding() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_correction_task_for_finding() TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.publish_onboarding_template(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.publish_onboarding_template(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.publish_onboarding_template(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.publish_onboarding_template(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.publish_onboarding_template(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_onboarding_template(uuid) TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.sync_onboarding_work_item() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sync_onboarding_work_item() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_onboarding_work_item() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_onboarding_work_item() TO anon;
GRANT EXECUTE ON FUNCTION public.sync_onboarding_work_item() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_onboarding_work_item() TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.sync_ticket_work_item() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sync_ticket_work_item() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_ticket_work_item() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_ticket_work_item() TO anon;
GRANT EXECUTE ON FUNCTION public.sync_ticket_work_item() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_ticket_work_item() TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.complete_owner_opportunity(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.complete_owner_opportunity(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.complete_owner_opportunity(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_owner_opportunity(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.complete_owner_opportunity(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_owner_opportunity(uuid) TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.seat_holder(text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.seat_holder(text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.seat_holder(text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.seat_holder(text) TO anon;
GRANT EXECUTE ON FUNCTION public.seat_holder(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.seat_holder(text) TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.instantiate_onboarding_v2(uuid,uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.instantiate_onboarding_v2(uuid,uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.instantiate_onboarding_v2(uuid,uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.instantiate_onboarding_v2(uuid,uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.instantiate_onboarding_v2(uuid,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.instantiate_onboarding_v2(uuid,uuid) TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.open_handoff_blockers(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.open_handoff_blockers(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.open_handoff_blockers(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.open_handoff_blockers(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.open_handoff_blockers(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.open_handoff_blockers(uuid) TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.mark_ready_for_operations(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mark_ready_for_operations(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_ready_for_operations(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_ready_for_operations(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.mark_ready_for_operations(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_ready_for_operations(uuid) TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.accept_into_operations(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.accept_into_operations(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.accept_into_operations(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_into_operations(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.accept_into_operations(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_into_operations(uuid) TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.log_handoff_deficiency(uuid,text,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.log_handoff_deficiency(uuid,text,text,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_handoff_deficiency(uuid,text,text,text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_handoff_deficiency(uuid,text,text,text) TO anon;
GRANT EXECUTE ON FUNCTION public.log_handoff_deficiency(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_handoff_deficiency(uuid,text,text,text) TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.is_onboarding_director(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.is_onboarding_director(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_onboarding_director(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_onboarding_director(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.is_onboarding_director(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_onboarding_director(uuid) TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.project_role_assignee(uuid,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.project_role_assignee(uuid,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.project_role_assignee(uuid,text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.project_role_assignee(uuid,text) TO anon;
GRANT EXECUTE ON FUNCTION public.project_role_assignee(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.project_role_assignee(uuid,text) TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.save_arha_opportunity(uuid,uuid,uuid,text,jsonb,text[],jsonb,boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.save_arha_opportunity(uuid,uuid,uuid,text,jsonb,text[],jsonb,boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.save_arha_opportunity(uuid,uuid,uuid,text,jsonb,text[],jsonb,boolean) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_arha_opportunity(uuid,uuid,uuid,text,jsonb,text[],jsonb,boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.save_arha_opportunity(uuid,uuid,uuid,text,jsonb,text[],jsonb,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_arha_opportunity(uuid,uuid,uuid,text,jsonb,text[],jsonb,boolean) TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.mark_owner_opportunity_viewed(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.mark_owner_opportunity_viewed(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_owner_opportunity_viewed(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_owner_opportunity_viewed(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.mark_owner_opportunity_viewed(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_owner_opportunity_viewed(uuid) TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.respond_owner_opportunity(uuid,text,text,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.respond_owner_opportunity(uuid,text,text,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.respond_owner_opportunity(uuid,text,text,text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.respond_owner_opportunity(uuid,text,text,text) TO anon;
GRANT EXECUTE ON FUNCTION public.respond_owner_opportunity(uuid,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_owner_opportunity(uuid,text,text,text) TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.cleaner_safeguard_check(uuid,uuid,text,date,numeric) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cleaner_safeguard_check(uuid,uuid,text,date,numeric) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cleaner_safeguard_check(uuid,uuid,text,date,numeric) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleaner_safeguard_check(uuid,uuid,text,date,numeric) TO anon;
GRANT EXECUTE ON FUNCTION public.cleaner_safeguard_check(uuid,uuid,text,date,numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleaner_safeguard_check(uuid,uuid,text,date,numeric) TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.cleaner_record_dispatch(uuid,uuid,text,date,boolean,uuid[],bigint) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cleaner_record_dispatch(uuid,uuid,text,date,boolean,uuid[],bigint) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cleaner_record_dispatch(uuid,uuid,text,date,boolean,uuid[],bigint) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleaner_record_dispatch(uuid,uuid,text,date,boolean,uuid[],bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.cleaner_record_dispatch(uuid,uuid,text,date,boolean,uuid[],bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleaner_record_dispatch(uuid,uuid,text,date,boolean,uuid[],bigint) TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.cleaner_safeguard_override(text,uuid,uuid,text,date,text,text,bigint) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cleaner_safeguard_override(text,uuid,uuid,text,date,text,text,bigint) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cleaner_safeguard_override(text,uuid,uuid,text,date,text,text,bigint) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleaner_safeguard_override(text,uuid,uuid,text,date,text,text,bigint) TO anon;
GRANT EXECUTE ON FUNCTION public.cleaner_safeguard_override(text,uuid,uuid,text,date,text,text,bigint) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleaner_safeguard_override(text,uuid,uuid,text,date,text,text,bigint) TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.cleaner_safeguard_request_override(uuid,uuid,text,date,text) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cleaner_safeguard_request_override(uuid,uuid,text,date,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cleaner_safeguard_request_override(uuid,uuid,text,date,text) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleaner_safeguard_request_override(uuid,uuid,text,date,text) TO anon;
GRANT EXECUTE ON FUNCTION public.cleaner_safeguard_request_override(uuid,uuid,text,date,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleaner_safeguard_request_override(uuid,uuid,text,date,text) TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.cleaner_dispatch_options() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cleaner_dispatch_options() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cleaner_dispatch_options() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleaner_dispatch_options() TO anon;
GRANT EXECUTE ON FUNCTION public.cleaner_dispatch_options() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleaner_dispatch_options() TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.cleaner_rotation(uuid,date) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cleaner_rotation(uuid,date) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cleaner_rotation(uuid,date) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleaner_rotation(uuid,date) TO anon;
GRANT EXECUTE ON FUNCTION public.cleaner_rotation(uuid,date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleaner_rotation(uuid,date) TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.cleaner_set_standard_duration(uuid,integer) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cleaner_set_standard_duration(uuid,integer) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cleaner_set_standard_duration(uuid,integer) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleaner_set_standard_duration(uuid,integer) TO anon;
GRANT EXECUTE ON FUNCTION public.cleaner_set_standard_duration(uuid,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleaner_set_standard_duration(uuid,integer) TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.cleaner_safeguard_portfolio(integer,boolean) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.cleaner_safeguard_portfolio(integer,boolean) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cleaner_safeguard_portfolio(integer,boolean) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleaner_safeguard_portfolio(integer,boolean) TO anon;
GRANT EXECUTE ON FUNCTION public.cleaner_safeguard_portfolio(integer,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleaner_safeguard_portfolio(integer,boolean) TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.auto_clear_owner_attention() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.auto_clear_owner_attention() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.auto_clear_owner_attention() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.auto_clear_owner_attention() TO anon;
GRANT EXECUTE ON FUNCTION public.auto_clear_owner_attention() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auto_clear_owner_attention() TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.log_ticket_insurance_risk() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.log_ticket_insurance_risk() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_ticket_insurance_risk() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_ticket_insurance_risk() TO anon;
GRANT EXECUTE ON FUNCTION public.log_ticket_insurance_risk() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_ticket_insurance_risk() TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.log_ticket_guest_impact() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.log_ticket_guest_impact() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_ticket_guest_impact() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_ticket_guest_impact() TO anon;
GRANT EXECUTE ON FUNCTION public.log_ticket_guest_impact() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_ticket_guest_impact() TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.log_guest_feedback_event() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.log_guest_feedback_event() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_guest_feedback_event() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_guest_feedback_event() TO anon;
GRANT EXECUTE ON FUNCTION public.log_guest_feedback_event() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_guest_feedback_event() TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.log_feedback_linked_work() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.log_feedback_linked_work() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_feedback_linked_work() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.log_feedback_linked_work() TO anon;
GRANT EXECUTE ON FUNCTION public.log_feedback_linked_work() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_feedback_linked_work() TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.trg_departure_review_on_clean() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.trg_departure_review_on_clean() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.trg_departure_review_on_clean() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.trg_departure_review_on_clean() TO anon;
GRANT EXECUTE ON FUNCTION public.trg_departure_review_on_clean() TO authenticated;
GRANT EXECUTE ON FUNCTION public.trg_departure_review_on_clean() TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.rerun_departure_review_trigger(uuid) OWNER TO postgres;
REVOKE ALL ON FUNCTION public.rerun_departure_review_trigger(uuid) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rerun_departure_review_trigger(uuid) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.rerun_departure_review_trigger(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.rerun_departure_review_trigger(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rerun_departure_review_trigger(uuid) TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.wo_contact_attempt_after() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.wo_contact_attempt_after() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wo_contact_attempt_after() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.wo_contact_attempt_after() TO anon;
GRANT EXECUTE ON FUNCTION public.wo_contact_attempt_after() TO authenticated;
GRANT EXECUTE ON FUNCTION public.wo_contact_attempt_after() TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.wo_candidate_guard() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.wo_candidate_guard() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wo_candidate_guard() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.wo_candidate_guard() TO anon;
GRANT EXECUTE ON FUNCTION public.wo_candidate_guard() TO authenticated;
GRANT EXECUTE ON FUNCTION public.wo_candidate_guard() TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.expense_duplicate_check() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.expense_duplicate_check() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expense_duplicate_check() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.expense_duplicate_check() TO anon;
GRANT EXECUTE ON FUNCTION public.expense_duplicate_check() TO authenticated;
GRANT EXECUTE ON FUNCTION public.expense_duplicate_check() TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.wo_candidate_after() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.wo_candidate_after() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.wo_candidate_after() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.wo_candidate_after() TO anon;
GRANT EXECUTE ON FUNCTION public.wo_candidate_after() TO authenticated;
GRANT EXECUTE ON FUNCTION public.wo_candidate_after() TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.guard_expense_recovery() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.guard_expense_recovery() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_expense_recovery() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_expense_recovery() TO anon;
GRANT EXECUTE ON FUNCTION public.guard_expense_recovery() TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_expense_recovery() TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.sync_claim_recovered() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.sync_claim_recovered() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.sync_claim_recovered() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_claim_recovered() TO anon;
GRANT EXECUTE ON FUNCTION public.sync_claim_recovered() TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_claim_recovered() TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.guard_claim_workflow() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.guard_claim_workflow() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.guard_claim_workflow() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.guard_claim_workflow() TO anon;
GRANT EXECUTE ON FUNCTION public.guard_claim_workflow() TO authenticated;
GRANT EXECUTE ON FUNCTION public.guard_claim_workflow() TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}

ALTER FUNCTION public.can_correct_actual_closing() OWNER TO postgres;
REVOKE ALL ON FUNCTION public.can_correct_actual_closing() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_correct_actual_closing() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_correct_actual_closing() TO anon;
GRANT EXECUTE ON FUNCTION public.can_correct_actual_closing() TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_correct_actual_closing() TO service_role;
-- captured proacl: {=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
