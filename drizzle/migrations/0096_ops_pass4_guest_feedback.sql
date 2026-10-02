CREATE TABLE public.guest_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_type text NOT NULL CHECK (feedback_type IN ('internal_survey','external_review')),
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  ownerrez_booking_id text,
  reservation_match text NOT NULL DEFAULT 'unknown' CHECK (reservation_match IN ('matched','unmatched','unknown')),
  guest_id text,
  guest_name text,
  rating int CHECK (rating BETWEEN 1 AND 5),
  summary text,
  response_text text,
  source text NOT NULL,
  source_review_id text,
  source_url text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  stay_start date,
  stay_end date,
  booking_platform text,
  issue_categories text[] NOT NULL DEFAULT '{}',
  follow_up_required boolean NOT NULL DEFAULT false,
  follow_up_status text NOT NULL DEFAULT 'none' CHECK (follow_up_status IN ('none','open','completed')),
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE SET NULL,
  contact_outcome text CHECK (contact_outcome IN ('spoke','voicemail','no_answer','callback','unreachable','other')),
  contact_notes text,
  followup_outcome text CHECK (followup_outcome IN ('no_issue','operational','recovery','both')),
  followup_completed_at timestamptz,
  followup_completed_by uuid,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX guest_feedback_source_review_uq ON public.guest_feedback (source, source_review_id) WHERE source_review_id IS NOT NULL;
CREATE UNIQUE INDEX guest_feedback_one_survey_per_stay ON public.guest_feedback (property_id, ownerrez_booking_id) WHERE feedback_type = 'internal_survey' AND ownerrez_booking_id IS NOT NULL;
CREATE INDEX guest_feedback_property_idx ON public.guest_feedback (property_id, submitted_at DESC);
GRANT SELECT, UPDATE ON public.guest_feedback TO authenticated;
GRANT ALL ON public.guest_feedback TO service_role;
ALTER TABLE public.guest_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read guest feedback" ON public.guest_feedback FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));
CREATE POLICY "Staff update guest feedback" ON public.guest_feedback FOR UPDATE TO authenticated USING (public.is_internal_staff(auth.uid())) WITH CHECK (public.is_internal_staff(auth.uid()));

CREATE TABLE public.guest_survey_responses (
  feedback_id uuid PRIMARY KEY REFERENCES public.guest_feedback(id) ON DELETE CASCADE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  had_issues boolean,
  follow_up_permission boolean,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.guest_survey_responses TO authenticated;
GRANT ALL ON public.guest_survey_responses TO service_role;
ALTER TABLE public.guest_survey_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read survey responses" ON public.guest_survey_responses FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));

CREATE TABLE public.guest_feedback_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feedback_id uuid NOT NULL REFERENCES public.guest_feedback(id) ON DELETE CASCADE,
  kind text NOT NULL,
  detail text,
  actor_id uuid,
  event_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX guest_feedback_events_fb_idx ON public.guest_feedback_events (feedback_id, event_at);
GRANT SELECT ON public.guest_feedback_events TO authenticated;
GRANT ALL ON public.guest_feedback_events TO service_role;
ALTER TABLE public.guest_feedback_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Staff read feedback events" ON public.guest_feedback_events FOR SELECT TO authenticated USING (public.is_internal_staff(auth.uid()));

ALTER TABLE public.tickets ADD COLUMN guest_feedback_id uuid REFERENCES public.guest_feedback(id) ON DELETE SET NULL;
CREATE INDEX tickets_guest_feedback_idx ON public.tickets (guest_feedback_id) WHERE guest_feedback_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.log_guest_feedback_event() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO guest_feedback_events (feedback_id, kind, detail) VALUES (NEW.id,
      CASE WHEN NEW.feedback_type = 'internal_survey' THEN 'survey_submitted' ELSE 'review_imported' END,
      COALESCE(NEW.rating::text || ' stars', NULL));
    RETURN NEW;
  END IF;
  NEW.updated_at := now();
  IF NEW.ticket_id IS DISTINCT FROM OLD.ticket_id AND NEW.ticket_id IS NOT NULL THEN
    INSERT INTO guest_feedback_events (feedback_id, kind, actor_id) VALUES (NEW.id, 'follow_up_ticket_created', auth.uid());
  END IF;
  IF NEW.contact_outcome IS DISTINCT FROM OLD.contact_outcome AND NEW.contact_outcome IS NOT NULL THEN
    INSERT INTO guest_feedback_events (feedback_id, kind, detail, actor_id) VALUES (NEW.id, 'prior_guest_contacted', NEW.contact_outcome, auth.uid());
  END IF;
  IF NEW.issue_categories IS DISTINCT FROM OLD.issue_categories THEN
    INSERT INTO guest_feedback_events (feedback_id, kind, detail, actor_id) VALUES (NEW.id, 'issue_categories_recorded', array_to_string(NEW.issue_categories, ', '), auth.uid());
  END IF;
  IF NEW.followup_completed_at IS NOT NULL AND OLD.followup_completed_at IS NULL THEN
    INSERT INTO guest_feedback_events (feedback_id, kind, detail, actor_id) VALUES (NEW.id, 'feedback_follow_up_completed', NEW.followup_outcome, auth.uid());
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER guest_feedback_events_ins AFTER INSERT ON public.guest_feedback FOR EACH ROW EXECUTE FUNCTION public.log_guest_feedback_event();
CREATE TRIGGER guest_feedback_events_upd BEFORE UPDATE ON public.guest_feedback FOR EACH ROW EXECUTE FUNCTION public.log_guest_feedback_event();
