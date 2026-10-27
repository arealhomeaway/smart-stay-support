CREATE OR REPLACE FUNCTION private.lock_owner_time_program(_program_id uuid, _actor_id uuid, _staff boolean, _new_activity boolean)
 RETURNS owner_programs
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE program public.owner_programs; arrived boolean;
BEGIN
 SELECT * INTO program FROM public.owner_programs WHERE id=_program_id FOR UPDATE NOWAIT;
 IF NOT FOUND OR _actor_id IS NULL OR program.archived_at IS NOT NULL OR program.completed_at IS NOT NULL THEN
  RAISE EXCEPTION 'This program is not open for this participation change.';
 END IF;
 SELECT EXISTS(SELECT 1 FROM public.owner_program_properties e WHERE e.program_id=program.id AND e.inclusion_status='included'
   AND e.archived_at IS NULL AND e.is_demo=program.is_demo AND e.closing_confirmed AND e.closing_date IS NOT NULL
   AND e.closing_date<=private.business_today()) INTO arrived;
 IF _new_activity AND NOT _staff THEN
  IF coalesce(program.status,'') NOT IN ('draft','active','target_reached') THEN
   RAISE EXCEPTION 'This program is not open for this participation change.';
  END IF;
  IF NOT arrived THEN
   RAISE EXCEPTION 'Hour entry opens once your property''s actual closing date is confirmed and that date has arrived.';
  END IF;
 ELSIF (program.started_on IS NULL OR NOT isfinite(program.started_on)) AND NOT (program.status='draft' AND arrived)
  OR (_new_activity AND coalesce(program.status,'') NOT IN ('active','target_reached','draft'))
  OR (NOT _new_activity AND coalesce(program.status,'') NOT IN ('active','target_reached','paused','draft')) THEN
  RAISE EXCEPTION 'This program is not open for this participation change.';
 END IF;
 PERFORM 1 FROM auth.users WHERE id=_actor_id AND deleted_at IS NULL AND (banned_until IS NULL OR banned_until<=now()) FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'An enabled account is required for participation changes.'; END IF;
 PERFORM 1 FROM public.user_roles WHERE user_id=_actor_id FOR SHARE NOWAIT;
 IF _staff THEN
  IF NOT (coalesce(public.has_role(_actor_id,'admin'),false) OR coalesce(public.has_role(_actor_id,'manager'),false))
   OR (program.is_demo AND NOT coalesce(public.has_role(_actor_id,'admin'),false)) THEN
   RAISE EXCEPTION 'Only an authorized supervisor can review or correct participation.';
  END IF;
 ELSE
  IF program.owner_user_id IS DISTINCT FROM _actor_id
   OR (program.is_demo AND NOT (_actor_id=auth.uid() AND private.is_synthetic_account()
        AND coalesce(private.demo_owner_link_ok(_actor_id, program.id),false)))
   OR NOT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor_id AND role::text='owner')
   OR EXISTS(SELECT 1 FROM public.user_roles WHERE user_id=_actor_id AND role::text<>'owner') THEN
   RAISE EXCEPTION 'That participation program is not available to you.';
  END IF;
 END IF;
 PERFORM 1 FROM public.property_owners WHERE id=program.owner_record_id AND active FOR SHARE NOWAIT;
 IF NOT FOUND THEN RAISE EXCEPTION 'Participation requires an active canonical Owner.'; END IF;
 RETURN program;
END $function$
