CREATE OR REPLACE FUNCTION public.notify_onboarding_handoff_ready()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _home text; _demo boolean; _u uuid;
BEGIN
  IF NEW.handoff_state = 'ready' AND OLD.handoff_state IS DISTINCT FROM 'ready' THEN
    SELECT coalesce(nickname, name, address_line1, 'A home'), coalesce(is_demo, false) INTO _home, _demo
      FROM public.properties WHERE id = NEW.property_id;
    FOR _u IN
      SELECT DISTINCT v.u FROM (
        SELECT public.seat_holder('director_ops') AS u
        UNION ALL
        SELECT o.user_id FROM public.seat_override_at('director_ops', now()) o WHERE o.kind = 'cover'
      ) v WHERE v.u IS NOT NULL
    LOOP
      IF NOT EXISTS (
        SELECT 1 FROM public.staff_notifications n
         WHERE n.user_id = _u AND n.kind = 'handoff_ready' AND n.entity_type = 'onboarding_project'
           AND n.entity_id = NEW.id AND n.read_at IS NULL AND n.retracted_at IS NULL
      ) THEN
        PERFORM public.notify_staff(
          _u, 'handoff_ready', 'Home ready for handoff: ' || _home,
          'Onboarding marked this home ready for Operations. Review it and accept the carry-over items.',
          'onboarding_project', NEW.id, '/property/' || NEW.property_id::text || '?tab=handoff',
          'normal', NEW.ready_for_ops_by, true, _demo
        );
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END $function$
;