-- Change 5 of 5, item 1: the in-app notification for the shift-end reminder.
-- The signed-in person may add one notice for their own shift end; repeats for the same end time do nothing.
-- In-app only (email_status 'none'); demo flag follows the caller's view.
CREATE OR REPLACE FUNCTION public.notify_my_shift_end(_ends_at timestamptz, _open_due integer, _demo boolean DEFAULT false)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me uuid := auth.uid();
  v_key text;
BEGIN
  IF v_me IS NULL OR NOT private.is_staff(v_me) THEN
    RAISE EXCEPTION 'Only the team gets shift reminders.';
  END IF;
  IF _ends_at IS NULL OR _ends_at < now() OR _ends_at > now() + interval '31 minutes' THEN
    RETURN false;
  END IF;
  v_key := to_char(_ends_at AT TIME ZONE 'America/Chicago', 'YYYY-MM-DD"T"HH24:MI');
  IF EXISTS (SELECT 1 FROM public.staff_notifications
              WHERE user_id = v_me AND kind = 'shift_end_reminder' AND body LIKE '%' || v_key || '%') THEN
    RETURN false;
  END IF;
  INSERT INTO public.staff_notifications(user_id, kind, title, body, link_path, priority, email_status, is_demo)
  VALUES (v_me, 'shift_end_reminder', 'Prepare your handoffs',
    'Your shift ends at ' || to_char(_ends_at AT TIME ZONE 'America/Chicago', 'FMHH12:MI AM') || ' and '
      || greatest(coalesce(_open_due, 0), 0) || ' open tickets have same-day due dates. [' || v_key || ']',
    '/prepare-handoffs', 'normal', 'none', coalesce(_demo, false));
  RETURN true;
END
$$;
REVOKE ALL ON FUNCTION public.notify_my_shift_end(timestamptz, integer, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.notify_my_shift_end(timestamptz, integer, boolean) TO authenticated;
