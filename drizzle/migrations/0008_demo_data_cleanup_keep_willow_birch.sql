-- Demo environment cleanup: keep only the two demo homes named in the review
-- guide (Willow, Birch); remove every other demo record. is_demo rows only.
-- Append-only guards are suspended per-trigger and restored exactly as found.

DO $$
DECLARE
  keep uuid[] := ARRAY['a0000000-0000-4000-8000-00000000a001'::uuid,
                       'a0000000-0000-4000-8000-00000000b001'::uuid];
  r record;
BEGIN
  CREATE TEMP TABLE suspended ON COMMIT DROP AS
    SELECT c.relname AS tbl, t.tgname AS trg
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND NOT t.tgisinternal AND t.tgenabled = 'O';

  FOR r IN SELECT * FROM suspended LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER %I', r.tbl, r.trg);
  END LOOP;

  CREATE TEMP TABLE del_tickets ON COMMIT DROP AS
    SELECT id FROM public.tickets WHERE is_demo AND (property_id IS NULL OR NOT (property_id = ANY(keep)));
  CREATE TEMP TABLE del_wo ON COMMIT DROP AS
    SELECT id FROM public.work_orders WHERE is_demo AND (ticket_id IN (SELECT id FROM del_tickets)
      OR property_id IS NULL OR NOT (property_id = ANY(keep)));
  CREATE TEMP TABLE del_proj ON COMMIT DROP AS
    SELECT id FROM public.onboarding_projects WHERE is_demo AND (property_id IS NULL OR NOT (property_id = ANY(keep)));
  CREATE TEMP TABLE del_prog ON COMMIT DROP AS
    SELECT id FROM public.owner_programs WHERE is_demo AND (property_id IS NULL OR NOT (property_id = ANY(keep)));
  CREATE TEMP TABLE del_tasks ON COMMIT DROP AS
    SELECT id FROM public.onboarding_tasks WHERE is_demo AND (property_id IS NULL OR NOT (property_id = ANY(keep)));
  CREATE TEMP TABLE del_reviews ON COMMIT DROP AS
    SELECT id FROM public.owner_reviews WHERE is_demo AND (program_id IS NULL
      OR program_id IN (SELECT id FROM del_prog) OR ticket_id IN (SELECT id FROM del_tickets));
  CREATE TEMP TABLE del_entries ON COMMIT DROP AS
    SELECT id FROM public.owner_time_entries WHERE is_demo AND (review_id IN (SELECT id FROM del_reviews)
      OR program_id IS NULL OR program_id IN (SELECT id FROM del_prog) OR ticket_id IN (SELECT id FROM del_tickets));
  CREATE TEMP TABLE del_appr ON COMMIT DROP AS
    SELECT id FROM public.approvals WHERE is_demo AND (property_id IS NULL OR NOT (property_id = ANY(keep)));
  CREATE TEMP TABLE del_docs ON COMMIT DROP AS
    SELECT id FROM public.documents WHERE is_demo AND (property_id IS NULL OR NOT (property_id = ANY(keep)));

  DELETE FROM public.work_order_events WHERE work_order_id IN (SELECT id FROM del_wo);
  DELETE FROM public.escalations WHERE ticket_id IN (SELECT id FROM del_tickets)
    OR work_order_id IN (SELECT id FROM del_wo);
  DELETE FROM public.handoffs WHERE ticket_id IN (SELECT id FROM del_tickets);
  DELETE FROM public.routine_controls WHERE ticket_id IN (SELECT id FROM del_tickets);
  DELETE FROM public.ticket_activity WHERE ticket_id IN (SELECT id FROM del_tickets);

  DELETE FROM public.owner_program_events WHERE entry_id IN (SELECT id FROM del_entries)
    OR review_id IN (SELECT id FROM del_reviews) OR program_id IN (SELECT id FROM del_prog);
  DELETE FROM public.owner_time_entry_properties WHERE entry_id IN (SELECT id FROM del_entries);
  UPDATE public.owner_time_entries SET amends_entry_id = NULL WHERE amends_entry_id IN (SELECT id FROM del_entries);
  DELETE FROM public.owner_time_entries WHERE id IN (SELECT id FROM del_entries);
  DELETE FROM public.owner_notifications WHERE review_id IN (SELECT id FROM del_reviews)
    OR program_id IN (SELECT id FROM del_prog);
  DELETE FROM public.owner_review_properties WHERE review_id IN (SELECT id FROM del_reviews);
  DELETE FROM public.owner_reviews WHERE id IN (SELECT id FROM del_reviews);
  DELETE FROM public.owner_badges WHERE program_id IN (SELECT id FROM del_prog);
  DELETE FROM public.owner_alert_log WHERE program_id IN (SELECT id FROM del_prog);
  DELETE FROM public.owner_contact_alerts WHERE program_id IN (SELECT id FROM del_prog);
  DELETE FROM public.owner_invite_redemptions WHERE program_id IN (SELECT id FROM del_prog);
  DELETE FROM public.owner_invites WHERE program_id IN (SELECT id FROM del_prog);
  DELETE FROM public.owner_program_properties WHERE program_id IN (SELECT id FROM del_prog);
  DELETE FROM public.owner_approval_publications WHERE program_id IN (SELECT id FROM del_prog)
    OR approval_id IN (SELECT id FROM del_appr);
  DELETE FROM public.owner_approval_receipts WHERE approval_id IN (SELECT id FROM del_appr);
  DELETE FROM public.document_recipient_events WHERE program_id IN (SELECT id FROM del_prog)
    OR document_id IN (SELECT id FROM del_docs);
  UPDATE public.documents SET owner_recipient_program_id = NULL WHERE owner_recipient_program_id IN (SELECT id FROM del_prog);
  DELETE FROM public.owner_programs WHERE id IN (SELECT id FROM del_prog);

  DELETE FROM public.handoff_reviews WHERE is_demo AND (property_id IS NULL OR NOT (property_id = ANY(keep)));
  DELETE FROM public.property_handoffs WHERE is_demo AND (property_id IS NULL OR NOT (property_id = ANY(keep)));

  DELETE FROM public.financial_requests WHERE is_demo AND (project_id IN (SELECT id FROM del_proj)
    OR task_id IN (SELECT id FROM del_tasks) OR property_id IS NULL OR NOT (property_id = ANY(keep)));
  DELETE FROM public.property_fact_proposals WHERE project_id IN (SELECT id FROM del_proj)
    OR task_id IN (SELECT id FROM del_tasks);
  DELETE FROM public.utility_accounts WHERE project_id IN (SELECT id FROM del_proj);
  DELETE FROM public.breezeway_outbound_tasks WHERE onboarding_task_id IN (SELECT id FROM del_tasks);
  DELETE FROM public.onboarding_notes WHERE task_id IN (SELECT id FROM del_tasks);
  DELETE FROM public.onboarding_task_stage_history WHERE task_id IN (SELECT id FROM del_tasks);
  UPDATE public.onboarding_tasks SET carryover_of = NULL WHERE carryover_of IN (SELECT id FROM del_tasks);
  UPDATE public.onboarding_tasks SET parent_task_id = NULL WHERE parent_task_id IN (SELECT id FROM del_tasks);
  UPDATE public.owner_reviews SET onboarding_task_id = NULL WHERE onboarding_task_id IN (SELECT id FROM del_tasks);
  DELETE FROM public.onboarding_tasks WHERE id IN (SELECT id FROM del_tasks);
  DELETE FROM public.onboarding_project_events WHERE project_id IN (SELECT id FROM del_proj);
  DELETE FROM public.work_orders WHERE id IN (SELECT id FROM del_wo);
  DELETE FROM public.tickets WHERE id IN (SELECT id FROM del_tickets);
  DELETE FROM public.onboarding_projects WHERE id IN (SELECT id FROM del_proj);

  DELETE FROM public.evidence_items WHERE document_id IN (SELECT id FROM del_docs);
  UPDATE public.documents SET fulfils_request_id = NULL WHERE fulfils_request_id IN (SELECT id FROM del_docs);
  UPDATE public.documents SET fulfilled_by_document_id = NULL WHERE fulfilled_by_document_id IN (SELECT id FROM del_docs);
  DELETE FROM public.documents WHERE id IN (SELECT id FROM del_docs);
  DELETE FROM public.approval_email_responses WHERE approval_id IN (SELECT id FROM del_appr);
  UPDATE public.financial_requests SET approval_id = NULL WHERE approval_id IN (SELECT id FROM del_appr);
  DELETE FROM public.approvals WHERE id IN (SELECT id FROM del_appr);
  DELETE FROM public.leads WHERE is_demo;
  DELETE FROM public.staff_notifications WHERE is_demo;

  DELETE FROM public.properties WHERE is_demo AND NOT (id = ANY(keep));

  UPDATE public.properties SET name = 'DEMO — Willow Creek Cottage' WHERE id = keep[1];
  UPDATE public.properties SET name = 'DEMO — Lakeside Birch Retreat' WHERE id = keep[2];

  FOR r IN SELECT * FROM suspended LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER %I', r.tbl, r.trg);
  END LOOP;
END $$;
