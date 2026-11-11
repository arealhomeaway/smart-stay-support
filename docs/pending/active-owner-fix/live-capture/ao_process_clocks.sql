CREATE OR REPLACE FUNCTION public.ao_process_clocks(_now timestamp with time zone DEFAULT now())
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE r record; reminders int := 0; expiries int := 0; demo boolean;
BEGIN
  FOR r IN SELECT pc.*, c.title, c.lane, p.owner_user_id, p.is_demo prog_demo, coalesce(pr.is_demo,false) prop_demo
    FROM public.ao_home_plan_cards pc JOIN public.ao_library_cards c ON c.id = pc.card_id
    JOIN public.owner_programs p ON p.id = pc.program_id JOIN public.ao_home_plan_settings s ON s.property_id = pc.property_id AND s.automated
    LEFT JOIN public.properties pr ON pr.id = pc.property_id
    WHERE pc.unlocked_at IS NOT NULL AND pc.owner_completed_at IS NULL AND pc.expired_at IS NULL
      AND c.lane <> 'flexible' AND pc.cutoff_at IS NOT NULL
    FOR UPDATE OF pc SKIP LOCKED
  LOOP
    demo := r.prog_demo OR r.prop_demo;
    IF _now >= r.cutoff_at THEN
      UPDATE public.ao_home_plan_cards SET expired_at = _now WHERE id = r.id;
      UPDATE public.owner_reviews SET status = 'closed', closed_at = _now, outcome = 'Owner opportunity expired, ARHA completed', updated_at = _now
        WHERE id = r.owner_review_id;
      INSERT INTO public.staff_notifications(user_id, kind, title, body, entity_type, entity_id, email_status, is_demo)
        SELECT t.assigned_to, 'ao_card_expired', 'Homeowner did not complete ' || r.title || '; proceed as normal', '',
               'onboarding_task', t.id, 'none', demo
        FROM public.onboarding_tasks t WHERE t.id = r.linked_task_id AND t.assigned_to IS NOT NULL;
      expiries := expiries + 1;
    ELSIF _now >= r.reminder_at AND r.reminder_sent_at IS NULL THEN
      UPDATE public.ao_home_plan_cards SET reminder_sent_at = _now WHERE id = r.id;
      -- existing owner alert path: in-app for every member, email to the main homeowner via existing delivery rules
      INSERT INTO public.owner_notifications(program_id, owner_user_id, review_id, kind, priority, title, body, email_status, is_demo)
        VALUES (r.program_id, r.owner_user_id, r.owner_review_id, 'review_ready', 'p3', 'Reminder: ' || r.title,
                'This item closes soon.', CASE WHEN demo THEN 'skipped' ELSE 'pending' END, demo);
      reminders := reminders + 1;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('reminders', reminders, 'expired', expiries);
END $function$
;
