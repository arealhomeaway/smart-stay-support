-- =========================================================
-- ARHA Matter model: work-type catalog, P1-P4 SLA engine,
-- split ownership, handoffs, waiting state, closure QA
-- =========================================================

-- ---------- Work Type / Response Standards catalog ----------
CREATE TABLE public.work_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  bucket text NOT NULL DEFAULT 'property_ownership',
  default_priority text NOT NULL DEFAULT 'p3',
  response_minutes integer NOT NULL DEFAULT 120,
  action_start_minutes integer NOT NULL DEFAULT 480,
  completion_target text,
  clock_type text NOT NULL DEFAULT 'calendar',
  required_closure_evidence text,
  guest_communication_required boolean NOT NULL DEFAULT false,
  playbook_id uuid REFERENCES public.playbooks(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT work_types_priority_chk CHECK (default_priority IN ('p1','p2','p3','p4')),
  CONSTRAINT work_types_clock_chk CHECK (clock_type IN ('calendar','coverage','business_hours','event_based')),
  CONSTRAINT work_types_bucket_chk CHECK (bucket IN ('active_guest_emergency','same_day_operations','property_ownership','future_reservations','administrative'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_types TO authenticated;
GRANT ALL ON public.work_types TO service_role;
ALTER TABLE public.work_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY work_types_select ON public.work_types FOR SELECT TO authenticated USING (true);
CREATE POLICY work_types_insert ON public.work_types FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY work_types_update ON public.work_types FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY work_types_delete_admin ON public.work_types FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER work_types_updated BEFORE UPDATE ON public.work_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ---------- Tickets (Matters) ----------
ALTER TABLE public.tickets
  ADD COLUMN record_type text NOT NULL DEFAULT 'active_task',
  ADD COLUMN work_type_id uuid REFERENCES public.work_types(id) ON DELETE SET NULL,
  ADD COLUMN bucket text,
  ADD COLUMN source_channel text NOT NULL DEFAULT 'internal',
  ADD COLUMN initiator_type text NOT NULL DEFAULT 'guest',
  ADD COLUMN source_reference text,
  ADD COLUMN acknowledged_at timestamptz,
  ADD COLUMN action_started_at timestamptz,
  ADD COLUMN response_due_at timestamptz,
  ADD COLUMN action_due_at timestamptz,
  ADD COLUMN next_action text,
  ADD COLUMN next_action_due_at timestamptz,
  ADD COLUMN promised_update_due_at timestamptz,
  ADD COLUMN next_review_at timestamptz,
  ADD COLUMN waiting_on text,
  ADD COLUMN waiting_reason text,
  ADD COLUMN accountable_owner uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN current_action_owner uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN guest_comm_owner uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN pending_handoff_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN handoff_type text,
  ADD COLUMN handoff_status text NOT NULL DEFAULT 'none',
  ADD COLUMN handoff_note text,
  ADD COLUMN escalation_level text NOT NULL DEFAULT 'none',
  ADD COLUMN escalated_at timestamptz,
  ADD COLUMN supervisor_caught boolean NOT NULL DEFAULT false,
  ADD COLUMN created_on_behalf_of uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN outcome_type text,
  ADD COLUMN final_communication_sent boolean NOT NULL DEFAULT false,
  ADD COLUMN closure_evidence text,
  ADD COLUMN late_reason text,
  ADD COLUMN closure_qa_result text NOT NULL DEFAULT 'not_reviewed',
  ADD COLUMN reopen_count integer NOT NULL DEFAULT 0,
  ADD COLUMN last_reopened_at timestamptz,
  ADD COLUMN avoidable_reopen boolean NOT NULL DEFAULT false,
  ADD COLUMN priority_override_reason text;

-- Map legacy priority values onto the approved P1-P4 rubric
UPDATE public.tickets SET priority = CASE priority
  WHEN 'emergency' THEN 'p1'
  WHEN 'urgent' THEN 'p2'
  WHEN 'high' THEN 'p2'
  WHEN 'normal' THEN 'p3'
  WHEN 'low' THEN 'p4'
  ELSE 'p3' END
WHERE priority NOT IN ('p1','p2','p3','p4');

ALTER TABLE public.tickets ALTER COLUMN priority SET DEFAULT 'p3';

-- Backfill ownership from existing assignment data
UPDATE public.tickets
  SET accountable_owner = COALESCE(assigned_to, created_by),
      current_action_owner = COALESCE(assigned_to, created_by)
WHERE accountable_owner IS NULL;

ALTER TABLE public.tickets
  ADD CONSTRAINT tickets_priority_chk CHECK (priority IN ('p1','p2','p3','p4')),
  ADD CONSTRAINT tickets_record_type_chk CHECK (record_type IN ('completed_interaction','active_task','collaborative_matter')),
  ADD CONSTRAINT tickets_handoff_status_chk CHECK (handoff_status IN ('none','pending','accepted','rejected','expired')),
  ADD CONSTRAINT tickets_handoff_type_chk CHECK (handoff_type IS NULL OR handoff_type IN ('action_request','ownership_transfer','shift_coverage','supervisor_intervention')),
  ADD CONSTRAINT tickets_escalation_chk CHECK (escalation_level IN ('none','supervisor','director','executive')),
  ADD CONSTRAINT tickets_qa_chk CHECK (closure_qa_result IN ('not_reviewed','pass','fail','corrected')),
  ADD CONSTRAINT tickets_outcome_chk CHECK (outcome_type IS NULL OR outcome_type IN ('resolved','information_provided','vendor_completed','no_issue_found','cancelled_by_requestor','duplicate','other')),
  ADD CONSTRAINT tickets_waiting_on_chk CHECK (waiting_on IS NULL OR waiting_on IN ('guest','owner','vendor','approval','parts','scheduled_date','internal_team','other'));

CREATE INDEX tickets_current_action_owner_idx ON public.tickets(current_action_owner);
CREATE INDEX tickets_status_priority_idx ON public.tickets(status, priority);
CREATE INDEX tickets_response_due_idx ON public.tickets(response_due_at) WHERE acknowledged_at IS NULL;

-- ---------- Activity log becomes a typed, append-only event stream ----------
ALTER TABLE public.ticket_activity
  ADD COLUMN event_type text NOT NULL DEFAULT 'update',
  ADD COLUMN event_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN from_owner uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN to_owner uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN channel text,
  ADD COLUMN evidence_url text;

CREATE INDEX ticket_activity_ticket_event_idx ON public.ticket_activity(ticket_id, event_at DESC);

-- ---------- Seed the Work Type / Response Standards catalog ----------
INSERT INTO public.work_types
  (name, category, bucket, default_priority, response_minutes, action_start_minutes, completion_target, required_closure_evidence, guest_communication_required, sort_order, playbook_id)
VALUES
  ('Active water leak / flooding','maintenance','active_guest_emergency','p1',10,0,'Same day','Photo of repaired area plus confirmation all safety devices were checked',true,10,
    (SELECT id FROM public.playbooks WHERE category = 'water' LIMIT 1)),
  ('Fire, smoke or CO alarm','safety','active_guest_emergency','p1',10,0,'Same day - device must be operational before leaving','Photo of installed working device; serial or model noted',true,20,
    (SELECT id FROM public.playbooks WHERE category = 'safety' LIMIT 1)),
  ('Gas smell / suspected carbon monoxide','safety','active_guest_emergency','p1',10,0,'Immediate - evacuate and call 911 if suspected','Fire department or licensed tech confirmation',true,30,
    (SELECT id FROM public.playbooks WHERE category = 'safety' LIMIT 1)),
  ('No heat / no AC','maintenance','active_guest_emergency','p1',10,0,'Within 4 hours','Temperature reading after repair; vendor invoice',true,40,
    (SELECT id FROM public.playbooks WHERE category = 'hvac' LIMIT 1)),
  ('No water / no power','maintenance','active_guest_emergency','p1',10,0,'Within 4 hours','Confirmation service restored',true,50,NULL),
  ('Guest lockout / access failure','access','active_guest_emergency','p1',10,0,'Within 1 hour','Confirmation guest is inside; new code documented',true,60,
    (SELECT id FROM public.playbooks WHERE category = 'access' LIMIT 1)),
  ('Security concern / intrusion','safety','active_guest_emergency','p1',10,0,'Immediate','Incident notes; police report number when applicable',true,70,NULL),
  ('Major property damage','maintenance','active_guest_emergency','p1',10,0,'Same day mitigation','Photos before and after; mitigation vendor confirmation',true,80,NULL),
  ('Property not ready at arrival','cleaning','same_day_operations','p2',30,60,'Before guest arrival','Photos of corrected areas',true,90,NULL),
  ('Cleaning issue / re-clean needed','cleaning','same_day_operations','p2',30,60,'Same day','Photos after re-clean',true,100,NULL),
  ('Appliance not working','maintenance','property_ownership','p2',30,60,'Within 24 hours','Photo or vendor confirmation of repair',true,110,
    (SELECT id FROM public.playbooks WHERE category = 'appliance' LIMIT 1)),
  ('Pest sighting','maintenance','property_ownership','p2',30,60,'Within 24 hours','Treatment confirmation from vendor',true,120,
    (SELECT id FROM public.playbooks WHERE category = 'pests' LIMIT 1)),
  ('Guest complaint / stay impact','guest','property_ownership','p2',30,60,'Within 24 hours','Final message to guest',true,130,NULL),
  ('Wifi / TV / entertainment issue','maintenance','property_ownership','p3',120,480,'Within 1 business day','Confirmation service works',true,140,NULL),
  ('Routine maintenance request','maintenance','property_ownership','p3',120,480,'Within 3 business days','Photo of completed work',false,150,NULL),
  ('Vendor coordination / follow-up','vendor','property_ownership','p3',120,480,'Within 3 business days','Vendor confirmation or invoice',false,160,NULL),
  ('Owner request','owner','property_ownership','p3',120,480,'Same business day acknowledgement','Written reply to owner',false,170,NULL),
  ('Reservation / booking question','guest','property_ownership','p3',120,480,'Within 1 business day','Reply to guest',true,180,NULL),
  ('Claim / reimbursement','claims','property_ownership','p3',120,480,'Within 5 business days','Claim documentation and photos',false,190,NULL),
  ('Review or quality follow-up','quality','property_ownership','p3',120,480,'Within 2 business days','Response posted or sent',false,200,NULL),
  ('Preventive / scheduled maintenance','maintenance','future_reservations','p4',480,1440,'By due date','Photo of completed work',false,210,NULL),
  ('Future project planning','maintenance','future_reservations','p4',480,1440,'By due date','Written plan or quote',false,220,NULL),
  ('Documentation / admin','admin','administrative','p4',480,1440,'Within 24 hours','Document link',false,230,NULL),
  ('Invoice / billing','admin','administrative','p4',480,1440,'Within 24 hours','Invoice reference',false,240,NULL),
  ('Other - explain in summary','other','property_ownership','p3',120,480,'Within 1 business day','Written summary of outcome',false,250,NULL);
