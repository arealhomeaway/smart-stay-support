-- Practice run of 01_reply_time_guard.sql (Build 9 A5). Cancelled at the end: nothing is kept.
CREATE TEMP TABLE practice_result(k text, v text);
GRANT ALL ON practice_result TO authenticated;
-- Build 9 A5 (APPLY): staff can no longer write the reply time or how a request was answered.
-- Only Resolve's server actions (SECURITY DEFINER functions, which run as their owner, and
-- server code using the service connection) write reply_sent_at, reply_sent_by,
-- reply_sent_via, reply_method and the portal answer columns. A signed in person's direct
-- update or insert of any of them is refused. Every other lead column is unchanged.
-- Same trigger, same name, same timing; only the function body gains three columns.
-- Undo: undo/01_reply_time_guard.sql
-- No BEGIN/COMMIT: the migration tool runs this file in one transaction.

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
    IF NEW.reply_sent_at IS NOT NULL OR NEW.reply_sent_by IS NOT NULL OR NEW.reply_sent_via IS NOT NULL THEN
      RAISE EXCEPTION 'The reply time is recorded only by Resolve.';
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
  IF NEW.reply_sent_at IS DISTINCT FROM OLD.reply_sent_at
     OR NEW.reply_sent_by IS DISTINCT FROM OLD.reply_sent_by
     OR NEW.reply_sent_via IS DISTINCT FROM OLD.reply_sent_via THEN
    RAISE EXCEPTION 'The reply time is recorded only by Resolve.';
  END IF;
  RETURN NEW;
END $function$;

-- A real lead and a real Admin, inside this cancelled step only.
CREATE TEMP TABLE practice_ids AS
SELECT (SELECT id FROM public.leads WHERE is_demo = false ORDER BY created_at DESC LIMIT 1) AS lead_id,
       (SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin' ORDER BY ur.user_id LIMIT 1) AS admin_id;
GRANT SELECT ON practice_ids TO authenticated;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', json_build_object('sub', (SELECT admin_id FROM practice_ids), 'role', 'authenticated')::text, true);
DO $p$ DECLARE n int; BEGIN
  UPDATE public.leads SET reply_sent_at = now() WHERE id = (SELECT lead_id FROM practice_ids);
  GET DIAGNOSTICS n = ROW_COUNT; INSERT INTO practice_result VALUES ('admin_direct_reply_time', 'saved ' || n);
EXCEPTION WHEN others THEN INSERT INTO practice_result VALUES ('admin_direct_reply_time', 'refused: ' || SQLERRM); END $p$;
DO $p$ DECLARE n int; BEGIN
  UPDATE public.leads SET reply_sent_by = (SELECT admin_id FROM practice_ids) WHERE id = (SELECT lead_id FROM practice_ids);
  GET DIAGNOSTICS n = ROW_COUNT; INSERT INTO practice_result VALUES ('admin_direct_reply_by', 'saved ' || n);
EXCEPTION WHEN others THEN INSERT INTO practice_result VALUES ('admin_direct_reply_by', 'refused: ' || SQLERRM); END $p$;
DO $p$ DECLARE n int; BEGIN
  UPDATE public.leads SET reply_method = 'portal' WHERE id = (SELECT lead_id FROM practice_ids);
  GET DIAGNOSTICS n = ROW_COUNT; INSERT INTO practice_result VALUES ('admin_direct_answered_how', 'saved ' || n);
EXCEPTION WHEN others THEN INSERT INTO practice_result VALUES ('admin_direct_answered_how', 'refused: ' || SQLERRM); END $p$;
DO $p$ DECLARE n int; BEGIN
  UPDATE public.leads SET updated_at = updated_at WHERE id = (SELECT lead_id FROM practice_ids);
  GET DIAGNOSTICS n = ROW_COUNT; INSERT INTO practice_result VALUES ('admin_other_column', 'saved ' || n);
EXCEPTION WHEN others THEN INSERT INTO practice_result VALUES ('admin_other_column', 'refused: ' || SQLERRM); END $p$;
RESET ROLE;
-- Resolve's own server actions run as the owner and still write it.
DO $p$ DECLARE n int; BEGIN
  UPDATE public.leads SET reply_sent_at = now() WHERE id = (SELECT lead_id FROM practice_ids);
  GET DIAGNOSTICS n = ROW_COUNT; INSERT INTO practice_result VALUES ('server_reply_time', 'saved ' || n);
EXCEPTION WHEN others THEN INSERT INTO practice_result VALUES ('server_reply_time', 'refused: ' || SQLERRM); END $p$;
DO $practice$ BEGIN
  RAISE EXCEPTION 'PRACTICE CANCELLED %', (SELECT json_object_agg(k, v) FROM practice_result);
END $practice$;
