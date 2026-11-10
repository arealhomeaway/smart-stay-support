-- Undo Build 9 A5: the guard goes back to protecting the portal columns only (exact live text before Build 9).
CREATE OR REPLACE FUNCTION public.guard_lead_portal_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.reply_method IS NOT NULL OR NEW.portal_answered_at IS NOT NULL
       OR NEW.portal_answered_by IS NOT NULL OR NEW.portal_answer_note IS NOT NULL THEN
      RAISE EXCEPTION 'How a request was answered is recorded only by Resolve.';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.portal_link IS DISTINCT FROM OLD.portal_link
     OR NEW.reply_method IS DISTINCT FROM OLD.reply_method
     OR NEW.portal_answered_at IS DISTINCT FROM OLD.portal_answered_at
     OR NEW.portal_answered_by IS DISTINCT FROM OLD.portal_answered_by
     OR NEW.portal_answer_note IS DISTINCT FROM OLD.portal_answer_note THEN
    RAISE EXCEPTION 'How a request was answered is recorded only by Resolve.';
  END IF;
  RETURN NEW;
END $function$;
