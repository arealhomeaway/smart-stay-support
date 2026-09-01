CREATE TYPE public.lead_stage AS ENUM ('new','first_contact','follow_up_1','final_follow_up','engaged','booking_pending','converted','lost');
CREATE TYPE public.lead_source AS ENUM ('insurance','relocation','corporate','direct','referral','realtor','website','phone','email','social','other');
CREATE TYPE public.lead_loss_reason AS ENUM ('unresponsive','other_option','budget_too_low','no_properties_available','outside_coverage','requirements_not_met','expired','dates_did_not_work','other');
CREATE TYPE public.lead_channel AS ENUM ('call','email','text','other','note','stage_change','system');

CREATE TABLE public.leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_name text NOT NULL,
  company text,
  phone text,
  email text,
  preferred_channel lead_channel,
  source lead_source NOT NULL DEFAULT 'direct',
  source_detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  market text,
  desired_move_in date,
  length_of_stay_days integer,
  bedrooms integer,
  budget_monthly numeric(12,2),
  requirements text,
  pets boolean,
  date_flexible boolean,
  stage lead_stage NOT NULL DEFAULT 'new',
  assigned_to uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  last_contact_at timestamptz,
  keep_open_reason text,
  quote_sent_at timestamptz,
  quote_amount numeric(12,2),
  quote_note text,
  converted_at timestamptz,
  converted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  converted_property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  reservation_ref text,
  lost_at timestamptz,
  lost_reason lead_loss_reason,
  lost_note text,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX leads_stage_idx ON public.leads (stage);
CREATE INDEX leads_assigned_idx ON public.leads (assigned_to);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.leads TO authenticated;
GRANT ALL ON public.leads TO service_role;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view leads" ON public.leads FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Staff can create leads" ON public.leads FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff(auth.uid()) AND created_by = auth.uid());
CREATE POLICY "Owners and supervisors can update leads" ON public.leads FOR UPDATE TO authenticated
  USING (public.is_supervisor(auth.uid()) OR assigned_to = auth.uid() OR created_by = auth.uid())
  WITH CHECK (public.is_supervisor(auth.uid()) OR assigned_to = auth.uid() OR created_by = auth.uid());
CREATE POLICY "Supervisors can delete leads" ON public.leads FOR DELETE TO authenticated USING (public.is_supervisor(auth.uid()));

CREATE TRIGGER update_leads_updated_at BEFORE UPDATE ON public.leads FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.lead_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  channel lead_channel NOT NULL,
  outcome text,
  note text,
  from_stage lead_stage,
  to_stage lead_stage,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  occurred_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX lead_activity_lead_idx ON public.lead_activity (lead_id, occurred_at DESC);

GRANT SELECT, INSERT ON public.lead_activity TO authenticated;
GRANT ALL ON public.lead_activity TO service_role;
ALTER TABLE public.lead_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view lead activity" ON public.lead_activity FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Staff can add lead activity" ON public.lead_activity FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff(auth.uid()) AND actor_id = auth.uid());

CREATE TABLE public.lead_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  note text,
  presented_at timestamptz,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, property_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lead_properties TO authenticated;
GRANT ALL ON public.lead_properties TO service_role;
ALTER TABLE public.lead_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view lead properties" ON public.lead_properties FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Staff can manage lead properties" ON public.lead_properties FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "Staff can update lead properties" ON public.lead_properties FOR UPDATE TO authenticated USING (public.is_internal_staff(auth.uid())) WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "Staff can remove lead properties" ON public.lead_properties FOR DELETE TO authenticated USING (public.is_internal_staff(auth.uid()));

CREATE TABLE public.lead_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  linked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lead_id, ticket_id)
);
GRANT SELECT, INSERT, DELETE ON public.lead_tickets TO authenticated;
GRANT ALL ON public.lead_tickets TO service_role;
ALTER TABLE public.lead_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff can view lead tickets" ON public.lead_tickets FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Staff can link lead tickets" ON public.lead_tickets FOR INSERT TO authenticated WITH CHECK (public.is_internal_staff(auth.uid()));
CREATE POLICY "Staff can unlink lead tickets" ON public.lead_tickets FOR DELETE TO authenticated USING (public.is_internal_staff(auth.uid()));