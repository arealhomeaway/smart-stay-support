CREATE OR REPLACE FUNCTION private.ticket_automated_type()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.work_type_id IS NULL AND NEW.source_channel = 'breezeway' THEN
    SELECT id INTO NEW.work_type_id FROM public.work_types WHERE name = 'Reported issue' AND active LIMIT 1;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION private.ticket_automated_type() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER tickets_aa_automated_type BEFORE INSERT ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION private.ticket_automated_type();