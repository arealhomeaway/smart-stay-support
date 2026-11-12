-- Active Owner: the owner's plan starts at enrollment (approved by the Admin, Nov 12). STAGED, NOT APPLIED.
-- One rule, private.owner_program_live: a program is live in draft, waiting_for_closing, ready_for_onboarding,
-- active and target_reached (not paused, closed, completed or archived). Every replaced function below is the exact
-- live text captured Nov 12 (live-capture/) with only the status checks changed, plus one addition in
-- ao_enrollment_changed: a plan that started before the homeowner login was linked gets its one plan-ready
-- notice when the login is linked. CREATE OR REPLACE keeps every function's owner and grants.
-- Activate (activate_owner_program) is unchanged: it still needs a closing date and still sets the clock.
-- Undo: apply.undo.sql.

CREATE FUNCTION private.owner_program_live(_status text)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT _status IN ('draft', 'waiting_for_closing', 'ready_for_onboarding', 'active', 'target_reached')
$function$;
GRANT EXECUTE ON FUNCTION private.owner_program_live(text) TO authenticated, service_role;

-- private.ao_enrollment_changed
CREATE OR REPLACE FUNCTION private.ao_enrollment_changed()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE prog public.owner_programs; h uuid; home_demo boolean; homes uuid[]; opened int;
BEGIN
  IF TG_TABLE_NAME = 'owner_program_properties' THEN
    PERFORM private.ao_label_sync(NEW.property_id, auth.uid());
    SELECT coalesce(x.is_demo, false) INTO home_demo FROM public.properties x WHERE x.id = NEW.property_id;
    IF NEW.inclusion_status = 'included' AND NEW.archived_at IS NULL AND (NOT NEW.is_demo OR coalesce(home_demo, false))
       AND (TG_OP = 'INSERT' OR OLD.inclusion_status IS DISTINCT FROM 'included' OR OLD.archived_at IS NOT NULL) THEN
      SELECT * INTO prog FROM public.owner_programs WHERE id = NEW.program_id;
      IF private.owner_program_live(prog.status) AND prog.archived_at IS NULL AND prog.is_demo = coalesce(home_demo, false) THEN
        PERFORM private.ao_start_on_enrollment(NEW.property_id, auth.uid());
      END IF;
    END IF;
  ELSE
    FOR h IN SELECT DISTINCT property_id FROM public.owner_program_properties WHERE program_id = NEW.id LOOP
      PERFORM private.ao_label_sync(h, auth.uid());
    END LOOP;
    IF private.owner_program_live(NEW.status) AND NOT coalesce(private.owner_program_live(OLD.status), false) AND OLD.status IS DISTINCT FROM 'closed'
       AND NEW.archived_at IS NULL THEN
      FOR h IN SELECT property_id FROM public.owner_program_properties
                WHERE program_id = NEW.id AND inclusion_status = 'included' AND archived_at IS NULL
                  AND coalesce((SELECT x.is_demo FROM public.properties x WHERE x.id = owner_program_properties.property_id), false) = NEW.is_demo
                ORDER BY property_id LOOP
        PERFORM private.ao_start_on_enrollment(h, auth.uid());
      END LOOP;
    END IF;
    -- A plan started before the homeowner login was linked: one plan-ready notice once the login is linked.
    IF OLD.owner_user_id IS NULL AND NEW.owner_user_id IS NOT NULL AND private.owner_program_live(NEW.status) AND NEW.archived_at IS NULL
       AND NOT EXISTS (SELECT 1 FROM public.owner_notifications n WHERE n.program_id = NEW.id AND n.kind = 'ao_plan_ready') THEN
      SELECT array_agg(DISTINCT c.property_id ORDER BY c.property_id), count(*) INTO homes, opened
        FROM public.ao_home_plan_cards c
       WHERE c.program_id = NEW.id AND c.join_outcome = 'open' AND c.owner_completed_at IS NULL AND c.expired_at IS NULL;
      IF coalesce(opened, 0) > 0 THEN PERFORM private.ao_plan_ready_notice(NEW.id, homes, opened); END IF;
    END IF;
  END IF;
  RETURN NULL;
END $function$;

-- private.ao_home_program
CREATE OR REPLACE FUNCTION private.ao_home_program(_property uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE ids uuid[]; home_demo boolean := coalesce((SELECT h.is_demo FROM public.properties h WHERE h.id = _property), false);
BEGIN
  SELECT array_agg(DISTINCT p.id ORDER BY p.id) INTO ids FROM public.owner_programs p
   WHERE private.owner_program_live(p.status) AND p.archived_at IS NULL AND p.is_demo = home_demo
     AND (p.property_id = _property OR EXISTS (
           SELECT 1 FROM public.owner_program_properties e
            WHERE e.program_id = p.id AND e.property_id = _property
              AND e.inclusion_status = 'included' AND e.archived_at IS NULL));
  IF coalesce(array_length(ids, 1), 0) = 0 THEN
    RETURN jsonb_build_object('reason', 'This home has no active Active Owner program');
  ELSIF array_length(ids, 1) > 1 THEN
    RETURN jsonb_build_object('reason', 'This home is in more than one homeowner program. Ask an Admin to fix it first.');
  END IF;
  RETURN jsonb_build_object('program_id', ids[1]);
END $function$;

-- private.ao_enrolled_rows
CREATE OR REPLACE FUNCTION private.ao_enrolled_rows()
 RETURNS TABLE(property_id uuid, home text, program_id uuid, stage text, open integer, locked integer, already_covered integer, skipped integer, reason text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE hid uuid; hp jsonb;
BEGIN
  FOR hid IN
    SELECT DISTINCT x.pid FROM (
      SELECT e.property_id AS pid FROM public.owner_program_properties e JOIN public.owner_programs p ON p.id = e.program_id
       WHERE e.inclusion_status = 'included' AND e.archived_at IS NULL AND private.owner_program_live(p.status) AND p.archived_at IS NULL AND NOT p.is_demo
      UNION SELECT p.property_id FROM public.owner_programs p WHERE private.owner_program_live(p.status) AND p.archived_at IS NULL AND NOT p.is_demo AND p.property_id IS NOT NULL
    ) x JOIN public.properties h ON h.id = x.pid
    WHERE NOT h.is_demo AND h.archived_at IS NULL
      AND NOT EXISTS (SELECT 1 FROM public.ao_home_plan_settings s WHERE s.property_id = x.pid)
  LOOP
    property_id := hid;
    SELECT public.format_property_label(to_jsonb(h)) ->> 'primary' INTO home FROM public.properties h WHERE h.id = hid;
    stage := private.ao_home_stage(hid);
    hp := private.ao_home_program(hid);
    IF hp ? 'reason' THEN
      program_id := NULL; open := NULL; locked := NULL; already_covered := NULL; skipped := NULL; reason := hp ->> 'reason';
    ELSE
      program_id := (hp ->> 'program_id')::uuid; reason := NULL;
      SELECT count(*) FILTER (WHERE o.outcome = 'open'), count(*) FILTER (WHERE o.outcome = 'locked'),
             count(*) FILTER (WHERE o.outcome = 'already_covered'), count(*) FILTER (WHERE o.outcome = 'skipped_passed')
        INTO open, locked, already_covered, skipped FROM private.ao_plan_outcomes(hid) o;
    END IF;
    RETURN NEXT;
  END LOOP;
END $function$;

-- private.lock_owner_time_program
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
  IF NOT coalesce(private.owner_program_live(program.status), false) THEN
   RAISE EXCEPTION 'This program is not open for this participation change.';
 END IF;

 ELSIF (program.started_on IS NULL OR NOT isfinite(program.started_on)) AND NOT (program.status IN ('draft','waiting_for_closing','ready_for_onboarding') AND arrived)
  OR (_new_activity AND NOT coalesce(private.owner_program_live(program.status), false))
  OR (NOT _new_activity AND NOT (coalesce(private.owner_program_live(program.status), false) OR program.status = 'paused')) THEN
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
  IF NOT coalesce(private.is_program_member(program.id,_actor_id),false)
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
END $function$;

-- public.owner_hours_eligibility
CREATE OR REPLACE FUNCTION public.owner_hours_eligibility(_program_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE p public.owner_programs;
BEGIN
 SELECT * INTO p FROM owner_programs WHERE id=_program_id;
 IF NOT FOUND OR NOT (private.is_program_member(p.id,auth.uid()) OR coalesce(public.is_internal_staff(auth.uid()),false)) THEN
  RETURN jsonb_build_object('eligible',false,'reason','unavailable');
 END IF;
 IF p.archived_at IS NOT NULL OR p.completed_at IS NOT NULL OR p.status IN ('paused','closed','completed','complete') THEN
  RETURN jsonb_build_object('eligible',false,'reason',CASE WHEN p.status='paused' THEN 'paused' ELSE 'closed' END);
 END IF;
 IF NOT coalesce(private.owner_program_live(p.status), false) OR NOT EXISTS(SELECT 1 FROM property_owners WHERE id=p.owner_record_id AND active)
 OR NOT EXISTS(SELECT 1 FROM owner_program_properties e JOIN properties h ON h.id=e.property_id
   WHERE e.program_id=p.id AND e.inclusion_status='included' AND e.archived_at IS NULL
   AND h.archived_at IS NULL AND h.owner_record_id=p.owner_record_id AND e.is_demo=p.is_demo AND h.is_demo=p.is_demo) THEN
  RETURN jsonb_build_object('eligible',false,'reason','unavailable');
 END IF;
 RETURN jsonb_build_object('eligible',true);
END $function$;

-- public.capture_owner_time_update
CREATE OR REPLACE FUNCTION public.capture_owner_time_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE original public.owner_time_entries; p public.owner_programs; u public.ticket_owner_updates;
BEGIN
 IF TG_OP='UPDATE' THEN
  IF NEW.owner_update_revision IS DISTINCT FROM OLD.owner_update_revision OR NEW.owner_update_snapshot IS DISTINCT FROM OLD.owner_update_snapshot
   OR (OLD.owner_update_revision IS NOT NULL AND (NEW.ticket_id IS DISTINCT FROM OLD.ticket_id OR NEW.program_id IS DISTINCT FROM OLD.program_id OR NEW.owner_user_id IS DISTINCT FROM OLD.owner_user_id OR NEW.review_id IS DISTINCT FROM OLD.review_id OR NEW.is_demo IS DISTINCT FROM OLD.is_demo)) THEN
   RAISE EXCEPTION 'The reviewed owner update is immutable. Preserve it through a correction.';
  END IF;
  RETURN NEW;
 END IF;
 IF NEW.amends_entry_id IS NOT NULL THEN
  SELECT * INTO original FROM public.owner_time_entries WHERE id=NEW.amends_entry_id;
  IF NOT FOUND OR NEW.program_id IS DISTINCT FROM original.program_id OR NEW.owner_user_id IS DISTINCT FROM original.owner_user_id
   OR NEW.ticket_id IS DISTINCT FROM original.ticket_id OR NEW.review_id IS DISTINCT FROM original.review_id OR NEW.is_demo IS DISTINCT FROM original.is_demo THEN
   RAISE EXCEPTION 'A correction must preserve the original participation context.';
  END IF;
  NEW.owner_update_revision:=original.owner_update_revision;
  NEW.owner_update_snapshot:=original.owner_update_snapshot;
  RETURN NEW;
 END IF;
 NEW.owner_update_snapshot:=NULL;
 IF NEW.owner_update_revision IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO p FROM public.owner_programs WHERE id=NEW.program_id FOR UPDATE;
 IF NOT FOUND OR p.owner_user_id IS DISTINCT FROM NEW.owner_user_id OR p.owner_record_id IS NULL OR p.archived_at IS NOT NULL
  OR p.is_demo IS DISTINCT FROM NEW.is_demo OR NOT coalesce(private.owner_program_live(p.status), false) THEN RAISE EXCEPTION 'The reviewed update program is no longer eligible.'; END IF;
 SELECT * INTO u FROM public.ticket_owner_updates WHERE ticket_id=NEW.ticket_id AND revision=NEW.owner_update_revision;
 IF NOT FOUND OR u.owner_record_id IS DISTINCT FROM p.owner_record_id OR u.is_demo IS DISTINCT FROM p.is_demo OR NEW.entry_date < u.reviewed_at::date THEN
  RAISE EXCEPTION 'Choose the owner update you reviewed on this participation date.';
 END IF;
 PERFORM 1 FROM public.properties h JOIN public.owner_program_properties e ON e.property_id=h.id
  WHERE h.id=u.property_id AND h.owner_record_id=p.owner_record_id AND h.is_demo=p.is_demo AND e.program_id=p.id AND e.inclusion_status='included' FOR SHARE OF h,e;
 IF NOT FOUND THEN RAISE EXCEPTION 'The reviewed update Property is no longer included for this Owner.'; END IF;
 PERFORM 1 FROM public.property_owners WHERE id=p.owner_record_id AND active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'The canonical Owner is inactive.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.owner_reviews r WHERE r.id=NEW.review_id AND r.program_id=p.id AND r.ticket_id=u.ticket_id)
 OR NOT EXISTS(SELECT 1 FROM public.tickets t WHERE t.id=u.ticket_id AND t.property_id=u.property_id AND t.is_demo=p.is_demo) THEN
  RAISE EXCEPTION 'The reviewed update does not match this opportunity and Ticket.';
 END IF;
 NEW.owner_update_snapshot:=jsonb_build_object('revision',u.revision,'issue',u.issue,'work_performed',u.work_performed,'outcome',u.outcome,'reviewed_at',u.reviewed_at,'owner_request_type',u.owner_request_type,'owner_request_why',u.owner_request_why);
 RETURN NEW;
END $function$;

-- public.can_view_owner_library_video
CREATE OR REPLACE FUNCTION public.can_view_owner_library_video(_library_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN NOT EXISTS (SELECT 1 FROM public.owner_opportunity_library l WHERE l.id = _library_id) THEN false
    WHEN public.is_internal_staff(auth.uid()) THEN true
    WHEN public.has_role(auth.uid(), 'vendor'::app_role) THEN false
    ELSE (
      EXISTS (SELECT 1 FROM public.owner_programs p WHERE private.is_program_member(p.id, auth.uid()) AND private.owner_program_live(p.status))
      AND EXISTS (SELECT 1 FROM public.owner_opportunity_library l WHERE l.id = _library_id AND l.active)
    ) OR EXISTS (
      SELECT 1 FROM public.work_items w JOIN public.owner_programs p ON p.id = w.program_id
      WHERE w.library_template_id = _library_id AND w.kind = 'opportunity'
        AND private.is_program_member(p.id, auth.uid()) AND w.retired_at IS NULL AND w.status NOT IN ('archived', 'draft')
    )
  END
$function$;

-- public.notify_owner_of_review
CREATE OR REPLACE FUNCTION public.notify_owner_of_review()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE prog record; home_id uuid;
BEGIN
 IF NEW.status<>'awaiting_owner' THEN RETURN NEW; END IF;
 IF TG_OP='UPDATE' AND OLD.status='awaiting_owner' THEN RETURN NEW; END IF;
 IF coalesce(current_setting('resolve.owner_release_batch', true),'')='on' THEN RETURN NEW; END IF;
 SELECT p.* INTO prog FROM public.owner_programs p JOIN public.property_owners o ON o.id=p.owner_record_id AND o.active
 WHERE p.id=NEW.program_id AND (p.status = 'pending' OR private.owner_program_live(p.status)) AND p.archived_at IS NULL AND p.is_demo=coalesce(NEW.is_demo,false);
 IF NOT FOUND THEN RETURN NEW; END IF;
 home_id := NEW.property_id;
 IF NEW.ticket_id IS NOT NULL THEN
    SELECT property_id INTO home_id FROM public.tickets WHERE id=NEW.ticket_id AND is_demo=prog.is_demo;
   IF NOT FOUND OR home_id IS NULL OR home_id IS DISTINCT FROM NEW.property_id THEN RETURN NEW; END IF;
 END IF;
 IF home_id IS NOT NULL AND NOT EXISTS(
   SELECT 1 FROM public.properties h JOIN public.owner_program_properties e ON e.property_id=h.id
   WHERE h.id=home_id AND h.owner_record_id=prog.owner_record_id AND h.is_demo=prog.is_demo
     AND e.program_id=prog.id AND e.inclusion_status='included'
 ) THEN RETURN NEW; END IF;
 INSERT INTO public.owner_notifications(program_id,owner_user_id,review_id,ticket_id,kind,priority,title,body,action_path,email_status,sms_status,is_demo)
 VALUES(prog.id,prog.owner_user_id,NEW.id,NEW.ticket_id,'review_ready','p3','Participation opportunity ready',
    'Open your owner portal to review the opportunity and whether an owner response is required.',
   '/owner',CASE WHEN prog.notify_email AND NOT prog.is_demo THEN 'pending' ELSE 'skipped' END,'skipped',prog.is_demo);
 RETURN NEW;
END $function$;

-- public.record_owner_work_order_response
CREATE OR REPLACE FUNCTION public.record_owner_work_order_response(_approval_id uuid, _owner_id uuid, _approved boolean, _note text)
 RETURNS timestamp with time zone
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE request public.approvals%ROWTYPE; wo public.work_orders%ROWTYPE;
 home public.properties%ROWTYPE; program public.owner_programs%ROWTYPE;
 decided timestamptz := now(); outcome text;
BEGIN
 IF _owner_id IS NULL OR _approved IS NULL OR length(coalesce(_note,''))>2000 THEN RAISE EXCEPTION 'Enter a valid owner response.'; END IF;
 IF NOT _approved AND length(trim(coalesce(_note,'')))=0 THEN RAISE EXCEPTION 'Explain what you would like changed.'; END IF;
 SELECT * INTO request FROM public.approvals WHERE id=_approval_id;
 IF NOT FOUND OR request.entity_type IS DISTINCT FROM 'work_order' OR request.approver_id IS DISTINCT FROM _owner_id THEN
  RAISE EXCEPTION 'That Work Order approval is not addressed to this owner.';
 END IF;
 SELECT * INTO wo FROM public.work_orders WHERE id=request.entity_id FOR UPDATE;
 IF NOT FOUND OR wo.closed_at IS NOT NULL OR wo.is_demo IS DISTINCT FROM false OR wo.approval_id IS DISTINCT FROM _approval_id THEN
  RAISE EXCEPTION 'That Work Order no longer accepts this owner response.';
 END IF;
 SELECT * INTO request FROM public.approvals WHERE id=_approval_id FOR UPDATE;
 IF NOT FOUND OR request.status IS DISTINCT FROM 'pending' OR request.approver_role IS DISTINCT FROM 'owner'
  OR request.approver_id IS DISTINCT FROM _owner_id OR request.is_demo IS DISTINCT FROM false
  OR request.entity_type IS DISTINCT FROM 'work_order' OR request.entity_id IS DISTINCT FROM wo.id
  OR request.property_id IS DISTINCT FROM wo.property_id THEN RAISE EXCEPTION 'The approval changed. Refresh before responding.'; END IF;
 IF request.amount IS NULL OR request.amount<0 OR request.amount::text IN ('NaN','Infinity','-Infinity')
  OR request.amount IS DISTINCT FROM wo.quote_amount THEN RAISE EXCEPTION 'The quoted amount changed. Ask the team to prepare a new approval.'; END IF;
 SELECT * INTO home FROM public.properties WHERE id=wo.property_id FOR SHARE;
 IF NOT FOUND OR home.is_demo IS DISTINCT FROM false OR home.owner_record_id IS NULL THEN RAISE EXCEPTION 'This Property is no longer available to this owner.'; END IF;
 PERFORM id FROM public.property_owners WHERE id=home.owner_record_id AND active FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'The canonical Owner is no longer active.'; END IF;
 SELECT * INTO program FROM public.owner_programs WHERE owner_record_id=home.owner_record_id
  AND owner_user_id=_owner_id AND is_demo=false AND archived_at IS NULL AND (status = 'pending' OR private.owner_program_live(status)) FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This Property is no longer enrolled for this owner.'; END IF;
 PERFORM property_id FROM public.owner_program_properties WHERE program_id=program.id
  AND property_id=home.id AND inclusion_status='included' FOR SHARE;
 IF NOT FOUND THEN RAISE EXCEPTION 'This Property is no longer enrolled for this owner.'; END IF;
 IF wo.ticket_id IS NOT NULL THEN
  PERFORM id FROM public.tickets WHERE id=wo.ticket_id AND property_id=home.id AND is_demo=false FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'The Work Order Ticket no longer matches this Property.'; END IF;
 END IF;
 outcome := CASE WHEN _approved THEN 'approved' ELSE 'declined' END;
 UPDATE public.approvals SET status=outcome,decision_note=nullif(trim(_note),''),decided_at=decided WHERE id=request.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'The approval response could not be recorded.'; END IF;
 UPDATE public.work_orders SET approval_status=outcome,approved_amount=CASE WHEN _approved THEN request.amount ELSE NULL END,
  approval_decided_at=decided,approval_note=nullif(trim(_note),'') WHERE id=wo.id;
 IF NOT FOUND THEN RAISE EXCEPTION 'The Work Order response could not be recorded.'; END IF;
 INSERT INTO public.work_order_events(work_order_id,author_id,event_type,body,detail,is_demo)
 VALUES(wo.id,_owner_id,'owner_approval_' || outcome,'Owner response recorded',
  jsonb_build_object('approval_id',request.id,'previous_status',wo.approval_status,'status',outcome,
   'previous_approved_amount',wo.approved_amount,'approved_amount',CASE WHEN _approved THEN request.amount ELSE NULL END,'note',nullif(trim(_note),'')),false);
 INSERT INTO public.audit_log(actor_id,action,entity_type,entity_id,reason,before_value,after_value)
 VALUES(_owner_id,'owner_approval_' || outcome,'approval',request.id,nullif(trim(_note),''),
  jsonb_build_object('status',request.status),jsonb_build_object('status',outcome,'decidedAt',decided,'workOrderId',wo.id));
 RETURN decided;
END $function$;

-- public.owner_release_summary
CREATE OR REPLACE FUNCTION public.owner_release_summary(_program_id uuid, _count integer, _property_ids uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE prog record; names text[]; homes text; nid uuid;
BEGIN
 PERFORM set_config('resolve.owner_release_batch','off',true);
 IF auth.uid() IS NULL OR NOT (public.has_role(auth.uid(),'admin') OR public.is_onboarding_director(auth.uid())) THEN
  RAISE EXCEPTION 'Only an Admin or Onboarding Director can release Opportunities.';
 END IF;
 IF coalesce(_count,0)<=0 THEN RETURN NULL; END IF;
 SELECT p.* INTO prog FROM owner_programs p JOIN property_owners o ON o.id=p.owner_record_id AND o.active
 WHERE p.id=_program_id AND (p.status = 'pending' OR private.owner_program_live(p.status)) AND p.archived_at IS NULL AND NOT p.is_demo;
 IF NOT FOUND OR prog.owner_user_id IS NULL THEN RETURN NULL; END IF;  -- demo/test or unlinked: no alert at all
 SELECT array_agg(public.format_property_label(to_jsonb(h))->>'primary' ORDER BY h.name) INTO names
 FROM properties h JOIN owner_program_properties e ON e.property_id=h.id AND e.program_id=prog.id AND e.inclusion_status='included'
 WHERE NOT h.is_demo AND (_property_ids IS NULL OR h.id=ANY(_property_ids));
 homes := CASE WHEN coalesce(array_length(names,1),0)=0 THEN 'your home'
               WHEN array_length(names,1)=1 THEN names[1]
               ELSE array_to_string(names[1:array_length(names,1)-1],', ')||' and '||names[array_length(names,1)] END;
 INSERT INTO owner_notifications(program_id,owner_user_id,review_id,ticket_id,kind,priority,title,body,action_path,email_status,sms_status)
 VALUES(prog.id,prog.owner_user_id,NULL,NULL,'review_batch_ready','p3','Your Active Owner activities are ready',
   format('We added %s %s to your portal for %s. Open your portal to see what''s next. You can work them anytime.',
           _count, CASE WHEN _count=1 THEN 'activity' ELSE 'activities' END, homes),
   '/owner',CASE WHEN prog.notify_email THEN 'pending' ELSE 'skipped' END,'skipped')
 RETURNING id INTO nid;
 RETURN nid;
END $function$;

-- The program trigger also fires when the homeowner login is linked.
DROP TRIGGER ao_program_changed ON public.owner_programs;
CREATE TRIGGER ao_program_changed AFTER UPDATE OF status, archived_at, owner_user_id ON public.owner_programs
  FOR EACH ROW EXECUTE FUNCTION private.ao_enrollment_changed();
