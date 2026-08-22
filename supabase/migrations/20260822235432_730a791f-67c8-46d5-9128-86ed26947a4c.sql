REVOKE EXECUTE ON FUNCTION public.seed_demo_environment() FROM authenticated, public, anon;
REVOKE EXECUTE ON FUNCTION public.reset_demo_environment() FROM authenticated, public, anon;
GRANT EXECUTE ON FUNCTION public.seed_demo_environment() TO service_role;
GRANT EXECUTE ON FUNCTION public.reset_demo_environment() TO service_role;

CREATE OR REPLACE FUNCTION public.seed_demo_environment()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  wt_immediate uuid;
  wt_ongoing uuid;
  wt_cleaning uuid;
  wt_review uuid;
  p_birch uuid;
  p_maple uuid;
  p_cedar uuid;
  p_oak uuid;
  v_ac uuid;
BEGIN
  -- Admin-only: the caller must hold the admin role in their own RLS client.
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only a Platform Admin can seed the demo environment.';
  END IF;

  DELETE FROM public.ticket_activity WHERE is_demo;
  DELETE FROM public.handoffs WHERE is_demo;
  DELETE FROM public.ticket_visits WHERE is_demo;
  DELETE FROM public.tickets WHERE is_demo;
  DELETE FROM public.approvals WHERE is_demo;
  DELETE FROM public.owner_programs WHERE is_demo;
  DELETE FROM public.vendor_orgs WHERE is_demo;
  DELETE FROM public.properties WHERE is_demo;

  SELECT id INTO wt_immediate FROM public.work_types WHERE name = 'Immediate maintenance' LIMIT 1;
  SELECT id INTO wt_ongoing  FROM public.work_types WHERE name = 'Ongoing maintenance' LIMIT 1;
  SELECT id INTO wt_cleaning FROM public.work_types WHERE name = 'Immediate cleaning need' LIMIT 1;
  SELECT id INTO wt_review   FROM public.work_types WHERE name = 'Cleaning Review Log' LIMIT 1;

  INSERT INTO public.properties
    (name, nickname, address_line1, city, state, postal_code, market, active, lifecycle_status, onboarding_stage, quarterly_review_due_on, is_demo)
  VALUES
    ('Lakeside Birch Retreat','Birch','120 Birchwood Lane','Nashville','TN','37209','nashville',true,'live','',current_date + interval '41 days', true)
    RETURNING id INTO p_birch;
  INSERT INTO public.properties
    (name, nickname, address_line1, city, state, postal_code, market, active, lifecycle_status, onboarding_stage, quarterly_review_due_on, is_demo)
  VALUES
    ('Maple Grove Hideaway','Maple','48 Maple Street','Nashville','TN','37212','nashville',true,'live','',current_date + interval '3 days', true)
    RETURNING id INTO p_maple;
  INSERT INTO public.properties
    (name, nickname, address_line1, city, state, postal_code, market, active, lifecycle_status, onboarding_stage, quarterly_review_due_on, is_demo)
  VALUES
    ('Cedar View Cottage','Cedar','9 Cedar Court','Franklin','TN','37064','franklin',true,'live','',current_date + interval '80 days', true)
    RETURNING id INTO p_cedar;
  INSERT INTO public.properties
    (name, nickname, address_line1, city, state, postal_code, market, active, lifecycle_status, onboarding_stage, quarterly_review_due_on, is_demo)
  VALUES
    ('Oak & Ivy Townhome','Oak','301 Oak Ridge Ave','Murfreesboro','TN','37130','murfreesboro',false,'onboarding','awaiting_handoff',current_date + interval '30 days', true)
    RETURNING id INTO p_oak;

  INSERT INTO public.vendor_orgs
    (legal_name, display_name, vendor_class, status, service_categories, markets, insurance_status, w9_status, license_status, primary_contact_name, primary_contact_email, primary_contact_phone, trial_jobs_required, is_demo)
  VALUES
    ('Music City Air & Heat','Music City Air & Heat','maintenance','active',ARRAY['HVAC','Plumbing'],ARRAY['nashville','franklin'],'valid','on_file','valid','Danny Reeves','danny@musiccityair.example','(615) 555-0134',0,true)
    RETURNING id INTO v_ac;
  INSERT INTO public.vendor_orgs
    (legal_name, display_name, vendor_class, status, service_categories, markets, insurance_status, w9_status, license_status, primary_contact_name, primary_contact_email, primary_contact_phone, trial_jobs_required, is_demo)
  VALUES
    ('Sparkle & Shine Cleaning Co.','Sparkle & Shine','cleaning','active',ARRAY['Housekeeping','Deep clean'],ARRAY['nashville','franklin'],'valid','on_file','not_required','Tanya Brooks','tanya@sparkleshine.example','(615) 555-0177',0,true);

  INSERT INTO public.tickets
    (title, description, category, bucket, priority, status, record_type, source_channel, guest_impact, occupancy_status,
     guest_in_residence, guest_name, property_id, work_type_id, vendor_name, vendor_user_id, assigned_to,
     accountable_owner, record_owner, created_by, reported_at, response_due_at, due_at, acknowledged_at,
     escalated_at, escalation_level, handoff_status, final_communication_sent, closure_qa_result,
     initiator_type, cross_team, avoidable_reopen, reopen_count, ref, is_demo)
  VALUES
    ('AC not cooling — guest discomfort, mid-stay','Guest at Birch reports the air conditioner has not cooled the master bedroom below 80 since arrival. P1 due to active guest impact. Property Coordinator dispatched Music City Air & Heat after confirming the thermostat and filters looked fine.','maintenance','active_guest_emergency','p1','in_progress','ticket','guest_call','active_guest','occupied',
     true,'Maya Chen',p_birch,wt_immediate,'Music City Air & Heat',NULL,'00000000-0000-4000-8000-00000000000a',
     '00000000-0000-4000-8000-000000000009','00000000-0000-4000-8000-000000000009','00000000-0000-4000-8000-000000000009',
     now() - interval '1 day', now() - interval '1 day' + interval '10 min', now() + interval '4 hours', now() - interval '1 day' + interval '3 min',
     now() - interval '20 hours', 'p2','accepted','false','pending',
     'guest','true','false',0,900000,true);

  INSERT INTO public.tickets
    (title, description, category, bucket, priority, status, record_type, source_channel, guest_impact, occupancy_status,
     guest_in_residence, guest_name, property_id, work_type_id, vendor_name, assigned_to,
     accountable_owner, record_owner, created_by, reported_at, response_due_at, due_at, acknowledged_at,
     handoff_status, final_communication_sent, closure_qa_result, initiator_type, cross_team,
     avoidable_reopen, reopen_count, ref, is_demo)
  VALUES
    ('Cleaning quality complaint — kitchen and bath','Guest at Maple reported sticky counters and soap scum on the bath fixtures from the last turnover. Supervisor flagged the cleaning provider for a touch-up before the next guest.','cleaning','same_day_operations','p2','open','ticket','guest_message','minor','occupied',
     true,'Sam Rivera',p_maple,wt_cleaning,'Sparkle & Shine','00000000-0000-4000-8000-00000000000b',
     '00000000-0000-4000-8000-000000000009','00000000-0000-4000-8000-000000000009','00000000-0000-4000-8000-000000000009',
     now() - interval '5 hours', now() - interval '5 hours' + interval '1 hour', now() + interval '6 hours', now() - interval '5 hours' + interval '30 min',
     'not_started','false','pending','guest','false',
     'false',0,900001,true);

  INSERT INTO public.tickets
    (title, description, category, bucket, priority, status, record_type, source_channel, guest_impact, occupancy_status,
     guest_in_residence, property_id, work_type_id, assigned_to, accountable_owner, record_owner, created_by,
     reported_at, response_due_at, due_at, acknowledged_at, handoff_status, final_communication_sent,
     closure_qa_result, initiator_type, cross_team, avoidable_reopen, reopen_count, ref, is_demo)
  VALUES
    ('Onboarding — Oak & Ivy ready for handoff review','Onboarding team completed readiness checklist for Oak & Ivy Townhome. Pending supervisor review and handoff acceptance before launch.','admin','administrative','p3','awaiting_owner','onboarding','internal','none','vacant',
     false,p_oak,wt_review,'00000000-0000-4000-8000-00000000000c',
     '00000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000008',
     now() - interval '2 days', now() - interval '2 days' + interval '8 hours', now() + interval '1 day', now() - interval '2 days' + interval '1 hour',
     'pending','false','pending','internal','false','false',0,900002,true);

  INSERT INTO public.ticket_activity (ticket_id, kind, event_type, event_at, created_at, author_id, body, is_demo)
  SELECT id,
         'event',
         CASE WHEN x.i = 1 THEN 'created' WHEN x.i = 2 THEN 'assigned' WHEN x.i = 3 THEN 'vendor_dispatched'
              WHEN x.i = 4 THEN 'estimate_submitted' WHEN x.i = 5 THEN 'approval_requested' WHEN x.i = 6 THEN 'approval_received'
              WHEN x.i = 7 THEN 'work_completed' WHEN x.i = 8 THEN 'completion_submitted' WHEN x.i = 9 THEN 'completion_verified' ELSE 'closed' END,
         now() - interval '1 day' + (x.i * interval '35 minutes'),
         now() - interval '1 day' + (x.i * interval '35 minutes'),
         CASE WHEN x.i IN (1,2,4,6,9,10) THEN '00000000-0000-4000-8000-000000000009'
              WHEN x.i = 5 THEN '00000000-0000-4000-8000-000000000008'
              ELSE '00000000-0000-4000-8000-000000000009' END,
         CASE WHEN x.i = 1 THEN 'Matter created from guest call about AC cooling.'
              WHEN x.i = 2 THEN 'Assigned to Property Coordinator for dispatch.'
              WHEN x.i = 3 THEN 'Dispatched to Music City Air & Heat; vendor brief sent.'
              WHEN x.i = 4 THEN 'Vendor submitted estimate of $185 to service compressor.'
              WHEN x.i = 5 THEN 'Approval requested from supervisor for the estimate.'
              WHEN x.i = 6 THEN 'Supervisor approved; vendor authorized to proceed.'
              WHEN x.i = 7 THEN 'Vendor reported work completed.'
              WHEN x.i = 8 THEN 'Completion proof (photos + invoice) submitted.'
              WHEN x.i = 9 THEN 'Property Coordinator verified completion.'
              ELSE 'Matter closed; guest notified.' END,
         true
  FROM (SELECT id FROM public.tickets WHERE is_demo AND ref = 900000) t
  CROSS JOIN generate_series(1,10) AS x(i);

  INSERT INTO public.ticket_activity (ticket_id, kind, event_type, event_at, created_at, author_id, body, is_demo)
  SELECT id, 'event', CASE WHEN x.i=1 THEN 'created' ELSE 'cleaning_scheduled' END,
         now() - interval '5 hours' + (x.i * interval '2 hours'),
         now() - interval '5 hours' + (x.i * interval '2 hours'),
         '00000000-0000-4000-8000-000000000009',
         CASE WHEN x.i=1 THEN 'Matter created from guest message about cleaning quality.'
              ELSE 'Touch-up cleaning scheduled with Sparkle & Shine before next arrival.' END,
         true
  FROM (SELECT id FROM public.tickets WHERE is_demo AND ref = 900001) t
  CROSS JOIN generate_series(1,2) AS x(i);

  INSERT INTO public.ticket_activity (ticket_id, kind, event_type, event_at, created_at, author_id, body, is_demo)
  SELECT id, 'event', CASE WHEN x.i=1 THEN 'onboarding_started' WHEN x.i=2 THEN 'readiness_complete' ELSE 'handoff_requested' END,
         now() - interval '2 days' + (x.i * interval '6 hours'),
         now() - interval '2 days' + (x.i * interval '6 hours'),
         '00000000-0000-4000-8000-00000000000c',
         CASE WHEN x.i=1 THEN 'Onboarding checklist started for Oak & Ivy.'
              WHEN x.i=2 THEN 'Readiness checklist complete; all steps done.'
              ELSE 'Handoff requested — awaiting supervisor review and acceptance.' END,
         true
  FROM (SELECT id FROM public.tickets WHERE is_demo AND ref = 900002) t
  CROSS JOIN generate_series(1,3) AS x(i);

  INSERT INTO public.demo_environment (id, active, seeded_at, scenario_count)
  VALUES ('default', true, now(), 3)
  ON CONFLICT (id) DO UPDATE SET seeded_at = now(), scenario_count = 3;
END;
$$;

CREATE OR REPLACE FUNCTION public.reset_demo_environment()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Admin-only: the caller must hold the admin role in their own RLS client.
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only a Platform Admin can reset the demo environment.';
  END IF;

  DELETE FROM public.ticket_activity WHERE is_demo;
  DELETE FROM public.handoffs WHERE is_demo;
  DELETE FROM public.ticket_visits WHERE is_demo;
  DELETE FROM public.tickets WHERE is_demo;
  DELETE FROM public.approvals WHERE is_demo;
  DELETE FROM public.owner_programs WHERE is_demo;
  DELETE FROM public.owner_notifications WHERE is_demo;
  DELETE FROM public.vendor_orgs WHERE is_demo;
  DELETE FROM public.properties WHERE is_demo;
  UPDATE public.demo_environment SET seeded_at = NULL, scenario_count = 0 WHERE id = 'default';
END;
$$;