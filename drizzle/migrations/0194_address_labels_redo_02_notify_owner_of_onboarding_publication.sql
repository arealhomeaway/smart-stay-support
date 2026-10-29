CREATE OR REPLACE FUNCTION public.notify_owner_of_onboarding_publication()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  program public.owner_programs%ROWTYPE;
BEGIN
  IF NEW.entity_type <> 'onboarding_task' THEN
    RETURN NEW;
  END IF;
  SELECT * INTO program FROM public.owner_programs WHERE id = NEW.program_id AND archived_at IS NULL;
  IF NOT FOUND OR program.owner_user_id IS NULL OR program.owner_user_id IS DISTINCT FROM NEW.recipient_id THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.owner_notifications (program_id, owner_user_id, kind, priority, title, body, action_path, email_status, sms_status, is_demo)
  VALUES (
    program.id, NEW.recipient_id, 'review_ready', 'p3',
    'New request from Your ARHA Team',
    coalesce(nullif(NEW.title,''),'A request needs your attention')||' · '||coalesce((SELECT public.format_property_label(to_jsonb(properties))->>'primary' FROM public.properties WHERE id=NEW.property_id),'Home (address missing)'),
    CASE WHEN NEW.property_id IS NOT NULL THEN '/owner?home='||NEW.property_id ELSE '/owner' END,
    CASE WHEN program.notify_email AND NOT program.is_demo THEN 'pending' ELSE 'skipped' END,
    'skipped', program.is_demo
  );
  RETURN NEW;
END;
$function$
;