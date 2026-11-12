CREATE OR REPLACE FUNCTION private.ao_guard_owner_item()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE prop uuid; task uuid; tmpl uuid; ttl text; actor uuid; hit record; conf uuid;
BEGIN
  IF coalesce(current_setting('app.ao_engine', true), '') = 'on' THEN RETURN NEW; END IF;
  IF TG_TABLE_NAME = 'owner_reviews' THEN
    prop := coalesce(NEW.property_id, (SELECT p.property_id FROM public.owner_programs p WHERE p.id = NEW.program_id));
    task := NEW.onboarding_task_id; tmpl := NEW.template_id; ttl := NEW.title; actor := coalesce(auth.uid(), NEW.created_by);
  ELSE
    IF NEW.kind IS DISTINCT FROM 'opportunity' OR NEW.source_table = 'owner_reviews' THEN RETURN NEW; END IF;
    prop := NEW.property_id; task := coalesce(NEW.source_task_id, NEW.linked_task_id);
    tmpl := NEW.library_template_id; ttl := NEW.title; actor := auth.uid();
  END IF;
  IF prop IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO hit FROM private.ao_live_card_match(prop, task, tmpl, ttl);
  IF NOT FOUND THEN RETURN NEW; END IF;
  UPDATE public.ao_one_off_confirmations SET used_at = now()
  WHERE id = (SELECT k.id FROM public.ao_one_off_confirmations k
    WHERE k.property_id = prop AND k.used_at IS NULL AND k.created_at > now() - interval '30 minutes'
      AND (actor IS NULL OR k.confirmed_by = actor)
      AND ((task IS NOT NULL AND k.task_id = task) OR (k.title_key <> '' AND k.title_key = private.ao_title_key(ttl)))
    ORDER BY k.created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
  RETURNING id INTO conf;
  IF conf IS NOT NULL THEN
    INSERT INTO public.ao_dedupe_events(subject, subject_id, action, detail, actor)
    VALUES ('one_off', conf, 'used', jsonb_build_object('plan_card_id', hit.plan_card_id, 'card_code', hit.code, 'title', ttl), actor);
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'This home already has "%" on its Active Owner plan. Open that card on the home page instead, or confirm that you are sending a different one-off.', hit.title
    USING ERRCODE = 'P0001', HINT = 'ao_card_exists:' || hit.plan_card_id::text;
END $function$
;

