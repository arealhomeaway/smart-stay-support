ALTER TABLE public.routine_controls DROP CONSTRAINT routine_controls_kind_check;
ALTER TABLE public.routine_controls ADD CONSTRAINT routine_controls_kind_check CHECK (kind = ANY (ARRAY['cleaning_review','guest_review','checkout','guest_touch_base','survey_review','maintenance_review']));

CREATE OR REPLACE FUNCTION private.create_survey_review_routine()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f record;
BEGIN
  SELECT id, property_id, guest_name, reservation_confirmation, booking_platform, stay_start, stay_end, is_demo
    INTO f FROM public.guest_feedback WHERE id = NEW.feedback_id;
  INSERT INTO public.routine_controls (kind, event_key, property_id, status, title, guest_name,
    reservation_confirmation, reservation_channel, stay_arrival, stay_departure, due_at, team, is_demo)
  VALUES ('survey_review', 'survey:' || NEW.feedback_id::text, f.property_id, 'due',
    'Survey review' || COALESCE(': ' || f.guest_name, ''), f.guest_name, f.reservation_confirmation,
    f.booking_platform, f.stay_start, f.stay_end, now() + interval '1 day', 'guest_experience', COALESCE(f.is_demo, false))
  ON CONFLICT (kind, event_key) DO NOTHING;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.create_survey_review_routine() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER guest_survey_response_creates_review
AFTER INSERT ON public.guest_survey_responses
FOR EACH ROW EXECUTE FUNCTION private.create_survey_review_routine();