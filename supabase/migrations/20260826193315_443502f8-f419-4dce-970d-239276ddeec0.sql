-- 1. Notifications can never be produced by demo records.
CREATE OR REPLACE FUNCTION public.notify_owner_of_ticket()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  prog record;
  is_p1 boolean;
  k text;
  t text;
  b text;
BEGIN
  IF NEW.property_id IS NULL THEN RETURN NEW; END IF;
  IF COALESCE(NEW.is_demo, false) THEN RETURN NEW; END IF;

  SELECT * INTO prog FROM public.owner_programs
   WHERE property_id = NEW.property_id AND status IN ('pending','active')
   LIMIT 1;
  IF prog.id IS NULL THEN RETURN NEW; END IF;

  is_p1 := lower(coalesce(NEW.priority,'')) = 'p1';

  IF TG_OP = 'INSERT' THEN
    k := CASE WHEN is_p1 THEN 'ticket_p1' ELSE 'ticket_opened' END;
    t := CASE WHEN is_p1 THEN 'Urgent at your home: ' ELSE 'New at your home: ' END || NEW.title;
    b := coalesce(NEW.description, 'A new matter was opened at your home.');
  ELSIF NEW.status IN ('resolved','closed') AND OLD.status IS DISTINCT FROM NEW.status THEN
    k := 'ticket_resolved';
    t := 'Resolved: ' || NEW.title;
    b := coalesce(NEW.resolution_notes, 'This matter is now closed.');
  ELSIF is_p1 AND lower(coalesce(OLD.priority,'')) <> 'p1' THEN
    k := 'ticket_p1';
    t := 'Urgent at your home: ' || NEW.title;
    b := coalesce(NEW.description, 'This matter was raised to urgent.');
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO public.owner_notifications
    (program_id, owner_user_id, ticket_id, kind, priority, title, body, action_path, email_status, sms_status)
  VALUES (
    prog.id, prog.owner_user_id, NEW.id, k, lower(coalesce(NEW.priority,'p3')), t, left(b, 800), '/owner',
    CASE WHEN prog.notify_email THEN 'pending' ELSE 'skipped' END,
    CASE WHEN is_p1 AND prog.notify_sms_p1 THEN 'pending' ELSE 'skipped' END
  );

  RETURN NEW;
END; $function$;

CREATE OR REPLACE FUNCTION public.notify_owner_of_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE prog record;
BEGIN
  IF NEW.status <> 'awaiting_owner' THEN RETURN NEW; END IF;
  IF COALESCE(NEW.is_demo, false) THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'awaiting_owner' THEN RETURN NEW; END IF;

  SELECT * INTO prog FROM public.owner_programs WHERE id = NEW.program_id;
  IF prog.id IS NULL THEN RETURN NEW; END IF;

  INSERT INTO public.owner_notifications
    (program_id, owner_user_id, review_id, ticket_id, kind, priority, title, body, action_path, email_status, sms_status)
  VALUES (
    prog.id, prog.owner_user_id, NEW.id, NEW.ticket_id, 'review_ready', 'p3',
    'Ready for you: ' || NEW.title,
    left(coalesce(NEW.recommendation, NEW.impact, 'This review is ready for your decision.'), 800),
    '/owner',
    CASE WHEN prog.notify_email THEN 'pending' ELSE 'skipped' END,
    'skipped'
  );

  RETURN NEW;
END; $function$;

-- 2. Archive (never delete) demo work.
CREATE OR REPLACE FUNCTION public.archive_demo_environment(_reason text DEFAULT 'Demo environment archived by admin')
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only a Platform Admin can manage the demo environment.';
  END IF;

  UPDATE public.tickets
     SET archived_at = COALESCE(archived_at, now()),
         archive_reason = COALESCE(archive_reason, _reason),
         archived_by = COALESCE(archived_by, auth.uid())
   WHERE is_demo AND archived_at IS NULL;

  UPDATE public.demo_environment
     SET seeded_at = NULL, scenario_count = 0
   WHERE id = 'default';
END; $function$;

REVOKE ALL ON FUNCTION public.archive_demo_environment(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.archive_demo_environment(text) TO authenticated, service_role;

-- Reset now archives rather than deletes.
CREATE OR REPLACE FUNCTION public.reset_demo_environment()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only a Platform Admin can reset the demo environment.';
  END IF;
  PERFORM public.archive_demo_environment('Demo environment reset by admin');
END; $function$;

-- 3. Full-workflow demo seed.
CREATE OR REPLACE FUNCTION public.seed_demo_environment()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  wt_immediate uuid;
  wt_ongoing uuid;
  wt_cleaning uuid;
  wt_review uuid;
  p_birch uuid;
  p_maple uuid;
  p_cedar uuid;
  p_oak uuid;
  t_ac uuid;
  t_heat uuid;
  t_lock uuid;
  t_reopen uuid;
  actor uuid := auth.uid();
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only a Platform Admin can seed the demo environment.';
  END IF;

  -- Previous demo run is archived, never deleted.
  PERFORM public.archive_demo_environment('Superseded by a newer demo seed');

  SELECT id INTO wt_immediate FROM public.work_types WHERE name = 'Immediate maintenance' LIMIT 1;
  SELECT id INTO wt_ongoing  FROM public.work_types WHERE name = 'Ongoing maintenance' LIMIT 1;
  SELECT id INTO wt_cleaning FROM public.work_types WHERE name = 'Immediate cleaning need' LIMIT 1;
  SELECT id INTO wt_review   FROM public.work_types WHERE name = 'Cleaning Review Log' LIMIT 1;

  -- Demo homes are demo-only: never linked to OwnerRez, owners or real addresses.
  SELECT id INTO p_birch FROM public.properties WHERE is_demo AND name = 'DEMO — Lakeside Birch Retreat' LIMIT 1;
  IF p_birch IS NULL THEN
    INSERT INTO public.properties (name, nickname, address_line1, city, state, postal_code, market, active, lifecycle_status, onboarding_stage, quarterly_review_due_on, is_demo)
    VALUES ('DEMO — Lakeside Birch Retreat','DEMO Birch','1 Sample Way','Nashville','TN','37209','demo',true,'live','',current_date + 41, true)
    RETURNING id INTO p_birch;
  END IF;

  SELECT id INTO p_maple FROM public.properties WHERE is_demo AND name = 'DEMO — Maple Grove Hideaway' LIMIT 1;
  IF p_maple IS NULL THEN
    INSERT INTO public.properties (name, nickname, address_line1, city, state, postal_code, market, active, lifecycle_status, onboarding_stage, quarterly_review_due_on, is_demo)
    VALUES ('DEMO — Maple Grove Hideaway','DEMO Maple','2 Sample Way','Nashville','TN','37212','demo',true,'live','',current_date + 3, true)
    RETURNING id INTO p_maple;
  END IF;

  SELECT id INTO p_cedar FROM public.properties WHERE is_demo AND name = 'DEMO — Cedar View Cottage' LIMIT 1;
  IF p_cedar IS NULL THEN
    INSERT INTO public.properties (name, nickname, address_line1, city, state, postal_code, market, active, lifecycle_status, onboarding_stage, quarterly_review_due_on, is_demo)
    VALUES ('DEMO — Cedar View Cottage','DEMO Cedar','3 Sample Way','Franklin','TN','37064','demo',true,'live','',current_date + 80, true)
    RETURNING id INTO p_cedar;
  END IF;

  SELECT id INTO p_oak FROM public.properties WHERE is_demo AND name = 'DEMO — Oak & Ivy Townhome' LIMIT 1;
  IF p_oak IS NULL THEN
    INSERT INTO public.properties (name, nickname, address_line1, city, state, postal_code, market, active, lifecycle_status, onboarding_stage, quarterly_review_due_on, is_demo)
    VALUES ('DEMO — Oak & Ivy Townhome','DEMO Oak','4 Sample Way','Murfreesboro','TN','37130','demo',false,'onboarding','awaiting_handoff',current_date + 30, true)
    RETURNING id INTO p_oak;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.vendor_orgs WHERE is_demo AND display_name = 'DEMO — Music City Air & Heat') THEN
    INSERT INTO public.vendor_orgs
      (legal_name, display_name, vendor_class, status, service_categories, markets, insurance_status, w9_status, license_status, primary_contact_name, primary_contact_email, primary_contact_phone, trial_jobs_required, is_demo)
    VALUES
      ('DEMO — Music City Air & Heat','DEMO — Music City Air & Heat','maintenance','active',ARRAY['HVAC','Plumbing'],ARRAY['demo'],'valid','on_file','valid','Demo Contact','demo-vendor@example.invalid','(000) 000-0000',0,true),
      ('DEMO — Sparkle & Shine Cleaning','DEMO — Sparkle & Shine Cleaning','cleaning','active',ARRAY['Housekeeping'],ARRAY['demo'],'valid','on_file','not_required','Demo Contact','demo-cleaning@example.invalid','(000) 000-0000',0,true);
  END IF;

  -- Scenario 1 — intake to escalation, guest in residence, vendor dispatched.
  INSERT INTO public.tickets
    (title, description, category, bucket, priority, status, record_type, source_channel, guest_impact, occupancy_status,
     guest_in_residence, guest_name, property_id, work_type_id, vendor_name, assigned_to, current_action_owner,
     accountable_owner, record_owner, created_by, reported_at, response_due_at, due_at, acknowledged_at,
     escalated_at, escalation_level, handoff_status, initiator_type, ref, is_demo)
  VALUES
    ('DEMO — AC not cooling, guest mid-stay','Fictional demo matter. A demo guest reports the bedroom will not cool below 80. Shows a P1 clock, vendor dispatch and escalation.','maintenance','active_guest_emergency','p1','in_progress','ticket','guest_call','active_guest','occupied',
     true,'Demo Guest (not a real person)',p_birch,wt_immediate,'DEMO — Music City Air & Heat',actor,actor,
     actor,actor,actor,
     now() - interval '1 day', now() - interval '1 day' + interval '10 min', now() + interval '4 hours', now() - interval '1 day' + interval '13 min',
     now() - interval '20 hours','p2','accepted','guest',900000,true)
  RETURNING id INTO t_ac;

  -- Scenario 2 — unassigned intake waiting to be picked up.
  INSERT INTO public.tickets
    (title, description, category, bucket, priority, status, record_type, source_channel, guest_impact, occupancy_status,
     guest_in_residence, guest_name, property_id, work_type_id, created_by, reported_at, response_due_at, due_at,
     handoff_status, initiator_type, ref, is_demo)
  VALUES
    ('DEMO — Cleaning quality complaint','Fictional demo matter. Shows what an unassigned matter looks like in the queue before a coordinator takes it.','cleaning','same_day_operations','p2','open','ticket','guest_message','minor','occupied',
     true,'Demo Guest (not a real person)',p_maple,wt_cleaning,actor,
     now() - interval '5 hours', now() - interval '5 hours' + interval '1 hour', now() + interval '6 hours',
     'not_started','guest',900001,true);

  -- Scenario 3 — onboarding matter awaiting supervisor handoff review.
  INSERT INTO public.tickets
    (title, description, category, bucket, priority, status, record_type, source_channel, guest_impact, occupancy_status,
     guest_in_residence, property_id, work_type_id, assigned_to, current_action_owner, accountable_owner, record_owner, created_by,
     reported_at, response_due_at, due_at, acknowledged_at, handoff_status, initiator_type, ref, is_demo)
  VALUES
    ('DEMO — Home ready for handoff review','Fictional demo matter. Readiness checklist is complete and the home is waiting on a supervisor decision.','admin','administrative','p3','awaiting_owner','onboarding','internal','none','vacant',
     false,p_oak,wt_review,actor,actor,actor,actor,actor,
     now() - interval '2 days', now() - interval '2 days' + interval '8 hours', now() + interval '1 day', now() - interval '2 days' + interval '1 hour',
     'pending','internal',900002,true);

  -- Scenario 4 — closed properly, with the evidence the work type requires.
  INSERT INTO public.tickets
    (title, description, category, bucket, priority, status, record_type, source_channel, guest_impact, occupancy_status,
     guest_in_residence, property_id, work_type_id, assigned_to, current_action_owner, accountable_owner, record_owner, created_by,
     reported_at, response_due_at, due_at, acknowledged_at, action_started_at, resolved_at, outcome_type,
     resolution_notes, closure_evidence, final_communication_sent, guest_confirmed, handoff_status, initiator_type, ref, is_demo)
  VALUES
    ('DEMO — No hot water, vacant home','Fictional demo matter. Shows a clean closure: required steps done, photo evidence attached, guest confirmation recorded.','maintenance','same_day_operations','p2','resolved','ticket','staff','none','vacant',
     false,p_cedar,wt_ongoing,actor,actor,actor,actor,actor,
     now() - interval '6 days', now() - interval '6 days' + interval '1 hour', now() - interval '5 days', now() - interval '6 days' + interval '20 min',
     now() - interval '6 days' + interval '2 hours', now() - interval '5 days', 'resolved',
     'Pilot assembly replaced by the demo vendor. Hot water confirmed at every fixture.',
     'Demo evidence: 3 photos of the replaced assembly and the vendor invoice.', true, true, 'not_started','internal',900003,true)
  RETURNING id INTO t_heat;

  -- Scenario 5 — supervisor exception recorded, then closed.
  INSERT INTO public.tickets
    (title, description, category, bucket, priority, status, record_type, source_channel, guest_impact, occupancy_status,
     guest_in_residence, guest_name, property_id, work_type_id, assigned_to, current_action_owner, accountable_owner, record_owner, created_by,
     reported_at, response_due_at, due_at, acknowledged_at, action_started_at, resolved_at, outcome_type,
     resolution_notes, closure_exception_reason, closure_exception_by, closure_exception_at,
     escalated_at, escalation_level, handoff_status, initiator_type, ref, is_demo)
  VALUES
    ('DEMO — Guest locked out after midnight','Fictional demo matter. Shows a supervisor authorising a closure exception when the required photo evidence genuinely could not be produced.','maintenance','active_guest_emergency','p1','resolved','ticket','guest_call','active_guest','occupied',
     true,'Demo Guest (not a real person)',p_maple,wt_immediate,actor,actor,actor,actor,actor,
     now() - interval '9 days', now() - interval '9 days' + interval '8 min', now() - interval '9 days' + interval '2 hours', now() - interval '9 days' + interval '6 min',
     now() - interval '9 days' + interval '12 min', now() - interval '9 days' + interval '90 min', 'resolved',
     'Backup code issued and the guest was inside within 40 minutes. Lock battery replaced the next morning.',
     'Photo evidence waived: resolved by phone at 01:10 with no one on site. Supervisor authorised closure.',
     actor, now() - interval '9 days' + interval '95 min',
     now() - interval '9 days' + interval '20 min','p2','not_started','guest',900004,true)
  RETURNING id INTO t_lock;

  -- Scenario 6 — closed, reopened because the fix did not hold.
  INSERT INTO public.tickets
    (title, description, category, bucket, priority, status, record_type, source_channel, guest_impact, occupancy_status,
     guest_in_residence, property_id, work_type_id, assigned_to, current_action_owner, accountable_owner, record_owner, created_by,
     reported_at, response_due_at, due_at, acknowledged_at, action_started_at, reopen_count, last_reopened_at,
     avoidable_reopen, handoff_status, initiator_type, ref, is_demo)
  VALUES
    ('DEMO — Dishwasher leak returned after repair','Fictional demo matter. Shows a reopen: the first repair was signed off, the leak came back, and the record picks up where it left off.','maintenance','same_day_operations','p3','in_progress','ticket','staff','minor','vacant',
     false,p_cedar,wt_ongoing,actor,actor,actor,actor,actor,
     now() - interval '12 days', now() - interval '12 days' + interval '4 hours', now() + interval '2 days', now() - interval '12 days' + interval '35 min',
     now() - interval '12 days' + interval '3 hours', 1, now() - interval '2 days',
     'true','not_started','internal',900005,true)
  RETURNING id INTO t_reopen;

  -- Guided steps on the cleanly-closed scenario.
  INSERT INTO public.ticket_steps (ticket_id, position, instruction, detail, required, photo_required, completed, completed_by, completed_at)
  VALUES
    (t_heat,1,'Confirm the water heater breaker and pilot','Look before you dispatch — half of these are a tripped breaker.',true,false,true,actor,now() - interval '6 days' + interval '30 min'),
    (t_heat,2,'Dispatch the demo HVAC partner with a written brief','Say what is wrong, who is on site, and what "done" looks like.',true,false,true,actor,now() - interval '6 days' + interval '2 hours'),
    (t_heat,3,'Collect photo evidence and the invoice','Required closure evidence for this work type.',true,true,true,actor,now() - interval '5 days'),
    (t_heat,4,'Confirm hot water at every fixture','Run each tap for a minute before you sign off.',true,false,true,actor,now() - interval '5 days');

  -- Accepted handoff on the live P1.
  INSERT INTO public.handoffs
    (ticket_id, from_user, to_user, handoff_type, summary, priority, actions_completed, current_status, next_action,
     due_at, guest_comm_status, risks, status, responded_at, is_demo)
  VALUES
    (t_ac, actor, actor, 'shift_change',
     'Demo handoff: P1 cooling issue with a guest in the home.','p1',
     'Thermostat and filter checked. Demo HVAC partner dispatched and en route.',
     'Vendor scheduled for a 2-hour window. Guest given two fans and a status update.',
     'Meet the vendor, confirm the repair, then message the guest before close of shift.',
     now() + interval '4 hours','sent',
     'If the compressor is dead, the guest cannot stay a second night — start a relocation option early.',
     'accepted', now() - interval '18 hours', true);

  -- Activity history for each scenario.
  INSERT INTO public.ticket_activity (ticket_id, kind, event_type, event_at, created_at, author_id, body, internal, is_demo)
  VALUES
    (t_ac,'event','created', now() - interval '1 day', now() - interval '1 day', actor,'Matter created from a demo guest call about the AC.',false,true),
    (t_ac,'event','assigned', now() - interval '1 day' + interval '15 min', now() - interval '1 day' + interval '15 min', actor,'Assigned to the property coordinator on shift.',false,true),
    (t_ac,'event','vendor_dispatched', now() - interval '22 hours', now() - interval '22 hours', actor,'Demo HVAC partner dispatched with a written brief.',false,true),
    (t_ac,'note','internal_note', now() - interval '21 hours', now() - interval '21 hours', actor,'Internal: if the compressor is dead we need a relocation option tonight.',true,true),
    (t_ac,'event','escalated', now() - interval '20 hours', now() - interval '20 hours', actor,'Escalated — guest still without cooling past the P1 action target.',false,true),
    (t_ac,'event','handoff_accepted', now() - interval '18 hours', now() - interval '18 hours', actor,'Handoff accepted by the incoming coordinator.',false,true),

    (t_heat,'event','created', now() - interval '6 days', now() - interval '6 days', actor,'Reported during a demo turnover inspection.',false,true),
    (t_heat,'event','step_completed', now() - interval '6 days' + interval '30 min', now() - interval '6 days' + interval '30 min', actor,'Breaker and pilot checked before dispatch.',false,true),
    (t_heat,'event','completion_verified', now() - interval '5 days', now() - interval '5 days', actor,'Photo evidence and invoice received and verified.',false,true),
    (t_heat,'event','closed', now() - interval '5 days', now() - interval '5 days', actor,'Closed with full evidence.',false,true),

    (t_lock,'event','created', now() - interval '9 days', now() - interval '9 days', actor,'Guest locked out after midnight — demo scenario.',false,true),
    (t_lock,'event','escalated', now() - interval '9 days' + interval '20 min', now() - interval '9 days' + interval '20 min', actor,'Escalated to the supervisor on call.',false,true),
    (t_lock,'event','closure_exception', now() - interval '9 days' + interval '95 min', now() - interval '9 days' + interval '95 min', actor,'Supervisor authorised a closure exception: no one on site to photograph.',false,true),
    (t_lock,'event','closed', now() - interval '9 days' + interval '96 min', now() - interval '9 days' + interval '96 min', actor,'Closed under the recorded exception.',false,true),

    (t_reopen,'event','created', now() - interval '12 days', now() - interval '12 days', actor,'Leak reported by the demo cleaning team.',false,true),
    (t_reopen,'event','closed', now() - interval '10 days', now() - interval '10 days', actor,'Closed after the first repair.',false,true),
    (t_reopen,'event','reopened', now() - interval '2 days', now() - interval '2 days', actor,'Reopened — the leak came back. Counted as an avoidable reopen.',false,true),
    (t_reopen,'note','internal_note', now() - interval '2 days' + interval '10 min', now() - interval '2 days' + interval '10 min', actor,'Internal: ask the partner for the part number before the next visit.',true,true);

  INSERT INTO public.demo_environment (id, active, seeded_at, scenario_count)
  VALUES ('default', true, now(), 6)
  ON CONFLICT (id) DO UPDATE SET active = true, seeded_at = now(), scenario_count = 6;
END; $function$;