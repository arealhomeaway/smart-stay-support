-- 1. Team directory of permanent role seats
CREATE TABLE public.functional_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  team text NOT NULL DEFAULT 'property_operations',
  coverage_window text,
  lunch_window text,
  lunch_coverage text,
  backup_role_code text,
  current_seat_holder uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  current_seat_name text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.functional_roles TO authenticated;
GRANT ALL ON public.functional_roles TO service_role;
ALTER TABLE public.functional_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY functional_roles_select ON public.functional_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY functional_roles_insert ON public.functional_roles FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));
CREATE POLICY functional_roles_update ON public.functional_roles FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'manager'));
CREATE POLICY functional_roles_delete ON public.functional_roles FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'admin'));
CREATE TRIGGER functional_roles_updated BEFORE UPDATE ON public.functional_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.functional_roles (code,name,team,coverage_window,lunch_window,lunch_coverage,backup_role_code,sort_order) VALUES
 ('ge_day','Guest Experience & Reservations Coordinator — Day/Weekend','guest_experience','Day / weekend','1:00–2:00 p.m., Thursday–Monday','On-duty Property Operations or Evening Guest Experience role covers new P1 and time-sensitive P2 work','ge_evening',1),
 ('ge_evening','Guest Experience & Reservations Coordinator — Evening','guest_experience','Weekday evenings','4:00–5:00 p.m., Monday–Friday','On-duty daytime or Evening/Weekend Property Operations role covers new P1 and time-sensitive P2 work','ge_day',2),
 ('po_day','Property Operations Coordinator — Weekday Day','property_operations','Weekday daytime','1:00–2:00 p.m., Monday–Friday','On-duty Guest Experience or Evening/Weekend Property Operations role covers new P1 and time-sensitive P2 work','po_evening',3),
 ('po_evening','Property Operations Coordinator — Evening/Weekend','property_operations','Evenings and weekends','Wednesday 2:00–3:00 p.m.; Thursday–Sunday 4:00–5:00 p.m.','On-duty Guest Experience or Weekday Day Property Operations role covers new P1 and time-sensitive P2 work','po_day',4),
 ('ops_supervisor','Operations Supervisor','leadership','Oversight by exception','2:00–3:00 p.m., Monday–Friday','Leadership escalation follows the established Director coverage path',NULL,5),
 ('director_ops','Director of Operations','leadership','Escalation and interdepartmental routing',NULL,NULL,NULL,6);

-- 2. Priorities are P1-P3 only
UPDATE public.tickets SET priority = 'p3' WHERE priority = 'p4';
UPDATE public.work_types SET default_priority = 'p3' WHERE default_priority = 'p4';

-- 3. Work type catalog rebuilt from the SOP ownership matrices
ALTER TABLE public.work_types
  ADD COLUMN IF NOT EXISTS team text NOT NULL DEFAULT 'property_operations',
  ADD COLUMN IF NOT EXISTS functional_role_code text,
  ADD COLUMN IF NOT EXISTS backup_coverage text,
  ADD COLUMN IF NOT EXISTS operating_standard text,
  ADD COLUMN IF NOT EXISTS pending_approval boolean NOT NULL DEFAULT false;

UPDATE public.tickets SET work_type_id = NULL;
DELETE FROM public.work_types;

INSERT INTO public.work_types
 (name,category,bucket,team,functional_role_code,default_priority,response_minutes,action_start_minutes,completion_target,operating_standard,backup_coverage,required_closure_evidence,guest_communication_required,sort_order)
VALUES
 ('Current or past guest request','guest','active_guest_emergency','guest_experience','ge_day','p2',3,5,'Same shift','P1 when active guest impact exists; acknowledge within 3 minutes and begin action within 5 minutes','Other Guest Experience role; on-duty Property Operations role during solo coverage','What the guest asked for, what was done, and the message sent back to the guest',true,1),
 ('New booking request','guest','future_reservations','guest_experience','ge_day','p1',3,5,'Same day','P1; acknowledge within 3 minutes and begin action within 5 minutes','Other Guest Experience role; on-duty Property Operations role during solo coverage','Booking outcome and confirmation sent',true,2),
 ('Arrival information','guest','same_day_operations','guest_experience','ge_day','p1',3,5,'Following-day arrivals by end of day; same-day arrivals after booking completion','P1; send following-day arrivals by end of day and same-day arrivals after booking completion','On-duty PC during solo coverage','Copy of the arrival information sent and the time it was sent',true,3),
 ('Tenant lead tracker','guest','future_reservations','guest_experience','ge_day','p3',120,480,'Same day','P1 when tied to a new booking; P3 for routine tracker maintenance','Other Guest Experience role','Tracker updated with lead status',false,4),
 ('OwnerRez booking blocks','admin','administrative','guest_experience','ge_day','p2',30,60,'Within 8 hours of the approved Two Week Block List, normally end of day Monday','P2; complete within 8 hours of receiving the approved Two Week Block List','Other Guest Experience role','Blocks applied and cross-checked against the approved list',false,5),
 ('Guest review, survey and rating logs','quality','administrative','guest_experience','ge_day','p3',120,480,'Same day unless a documented source deadline requires faster action','P3; complete the same day unless a documented source deadline requires faster action','Other Guest Experience role','Log entry completed',false,6),
 ('Claims','claims','property_ownership','guest_experience','ge_day','p3',120,480,'Per platform deadline','P3 unless platform, financial, guest, or evidence risk requires elevation; follow platform deadlines and leadership direction','Other Guest Experience role; escalate decisions beyond authority','Evidence pack, claim reference and submission date',false,7),
 ('Tone-check call','guest','administrative','guest_experience','ge_day','p3',120,480,'Same day','P3; complete the same day under the approved call process','Other Guest Experience role','Call notes and guest sentiment recorded',false,8),
 ('Property or owner information update','owner','property_ownership','guest_experience','ge_day','p2',30,60,'Same day','P2 for a documented, approved routine record update','Route owner decisions, policy changes, contract terms, financial changes, owner constraints, or unapproved listing changes to the Director of Operations','What changed, where it was changed, and who approved it',false,9),
 ('Adding homes to portals','admin','administrative','guest_experience','ge_day','p3',120,480,'Pending approval','Ownership, priority and expected response time remain pending final Operations Supervisor and Director of Operations approval','Do not treat as finalized routine work until approved','Portal listing links and approval reference',false,10),
 ('Immediate maintenance','maintenance','active_guest_emergency','property_operations','po_day','p1',3,5,'End of day, or within 12 hours when circumstances allow','P1; acknowledge within 3 minutes, begin action within 5 minutes, target closeout by end of day or within 12 hours when circumstances allow','Other Property Operations role; on-duty Guest Experience role during solo coverage','Photos before and after, what was repaired or replaced, vendor name, and confirmation every smoke, CO and security device in the home was checked and left working',true,11),
 ('Ongoing maintenance','maintenance','property_ownership','property_operations','po_day','p2',3,30,'Per vendor schedule; document barriers','P2; message response within 3 minutes and action started within 30 minutes','Other Property Operations role','Work performed, vendor, and photo of the completed work',false,12),
 ('Immediate cleaning need','cleaning','same_day_operations','property_operations','po_day','p1',3,5,'Before the next guest impact','P1; acknowledge within 3 minutes and begin action within 5 minutes','Other Property Operations role; on-duty Guest Experience role during solo coverage','Photos of the cleaned area and who completed it',true,13),
 ('Ongoing cleaning need','cleaning','property_ownership','property_operations','po_day','p2',60,60,'Per cleaning schedule','P2; expected response within 1 hour','Other Property Operations role','Cleaner assigned and completion confirmation',false,14),
 ('Cleaning Review Log','quality','administrative','property_operations','po_day','p3',30,30,'Before the next guest arrives','P3; complete before the next guest arrives and begin review within 30 minutes of the trigger when required','On-duty Guest Experience role during solo coverage','Review log completed with any findings escalated',false,15),
 ('Lock offline or low-battery alert','access','same_day_operations','property_operations','po_day','p2',120,120,'Same day','P2; respond within 2 hours and escalate immediately if access is affected','Other Property Operations role','Lock status confirmed online and batteries replaced',false,16),
 ('Breezeway task-reporting issue','admin','same_day_operations','property_operations','po_day','p2',30,30,'Same day','P1 when the reporting failure creates an urgent operational risk; expected response within 30 minutes','Other Property Operations role','Reporting restored and any missed tasks recovered',false,17),
 ('Maintenance and landscaping work-order review','maintenance','administrative','property_operations','po_day','p3',120,1440,'Within 24 hours after work completion','P3; complete within 24 hours after work completion','Other Property Operations role','Work order reviewed and approved or disputed',false,18),
 ('Quarterly inspection review','quality','administrative','property_operations','po_day','p3',120,1440,'When the inspection is scheduled and finished','P3; complete when the inspection is scheduled and finished','Designated inspection owner and the other Property Operations role','Inspection report reviewed with follow-up matters created',false,19),
 ('Internal interdepartmental communication','admin','administrative','leadership','director_ops','p3',120,480,'Per the approved rubric','Director of Operations; priority varies under the approved rubric','Director of Operations','Decision or direction documented',false,20),
 ('Escalated owner issue','owner','property_ownership','leadership','director_ops','p2',30,60,'Same day','Director of Operations retains escalation oversight while the appropriate functional role owns operational execution','Director of Operations','Owner decision documented and communicated',false,21);

-- 4. Ticket fields for the mechanical priority model and seat-based ownership
ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS functional_role_code text,
  ADD COLUMN IF NOT EXISTS record_owner uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cross_team boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guest_impact text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS occupancy_status text NOT NULL DEFAULT 'vacant',
  ADD COLUMN IF NOT EXISTS suggested_priority text,
  ADD COLUMN IF NOT EXISTS reclassified_at timestamptz;

UPDATE public.tickets SET record_type = 'one_touch' WHERE record_type = 'completed_interaction';
UPDATE public.tickets SET cross_team = true, record_type = 'ticket' WHERE record_type = 'collaborative_matter';
UPDATE public.tickets SET record_type = 'ticket' WHERE record_type = 'active_task';
UPDATE public.tickets SET record_owner = COALESCE(record_owner, accountable_owner, created_by);
ALTER TABLE public.tickets ALTER COLUMN record_type SET DEFAULT 'ticket';

-- 5. Formal handoffs
CREATE TABLE public.handoffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  from_user uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_user uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_role_code text,
  handoff_type text NOT NULL DEFAULT 'ownership_transfer',
  summary text NOT NULL,
  priority text NOT NULL DEFAULT 'p3',
  actions_completed text NOT NULL,
  current_status text NOT NULL,
  next_action text NOT NULL,
  due_at timestamptz,
  guest_comm_status text NOT NULL DEFAULT 'not_required',
  risks text,
  status text NOT NULL DEFAULT 'pending',
  responded_at timestamptz,
  response_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX handoffs_ticket_idx ON public.handoffs(ticket_id);
CREATE INDEX handoffs_status_idx ON public.handoffs(status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.handoffs TO authenticated;
GRANT ALL ON public.handoffs TO service_role;
ALTER TABLE public.handoffs ENABLE ROW LEVEL SECURITY;
CREATE POLICY handoffs_select ON public.handoffs FOR SELECT TO authenticated USING (true);
CREATE POLICY handoffs_insert ON public.handoffs FOR INSERT TO authenticated WITH CHECK (auth.uid() = from_user);
CREATE POLICY handoffs_update ON public.handoffs FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);