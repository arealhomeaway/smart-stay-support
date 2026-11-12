-- Nov 12 completion build, items 5 and 2. NOT APPLIED.
-- 5. Approve on a staff-created Opportunity marks its linked Task approved the same way Approve on a
--    sent Task does (owner_item_approve): the Task needs the owner's approval OR is a Business
--    Decision; the open approval record is closed; an audit row is written. Every other branch of the
--    live function (captured in live-capture/respond_owner_opportunity.sql) is unchanged.
CREATE OR REPLACE FUNCTION public.respond_owner_opportunity(_id uuid, _kind text, _decision text, _text text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE w record; t record; _appr uuid; _result text := null; _owner text; _note text;
BEGIN
  SELECT wi.* INTO w FROM work_items wi JOIN owner_programs p ON p.id=wi.program_id
   WHERE wi.id=_id AND wi.kind='opportunity' AND wi.status NOT IN ('draft','archived') AND private.is_program_member(p.id,auth.uid())
   FOR UPDATE OF wi;
  IF w IS NULL THEN RAISE EXCEPTION 'This Opportunity is not available to you.'; END IF;
  IF _kind NOT IN ('acknowledge','feedback','decision') OR NOT (_kind = ANY (w.response_types)) THEN
    RAISE EXCEPTION 'This Opportunity does not take that kind of response.'; END IF;
  IF _kind='feedback' AND coalesce(trim(_text),'')='' THEN RAISE EXCEPTION 'Type your feedback before submitting.'; END IF;
  IF _kind='decision' AND coalesce(_decision,'') NOT IN ('authorize','changes') THEN RAISE EXCEPTION 'Choose a decision.'; END IF;
  IF length(coalesce(_text,'')) > 5000 THEN RAISE EXCEPTION 'Please keep your response under 5,000 characters.'; END IF;
  SELECT coalesce(pr.full_name,'The homeowner') INTO _owner FROM profiles pr WHERE pr.id=auth.uid();
  _owner := coalesce(_owner,'The homeowner');

  -- Specific business action <-> specific owner business decision.
  -- Only an ARHA Business Decision linked to a Task of the SAME property that is
  -- itself waiting on a legitimate owner approval. Nothing else is touched.
  IF _kind='decision' AND w.source='arha' AND w.source_task_id IS NOT NULL THEN
    SELECT * INTO t FROM onboarding_tasks WHERE id=w.source_task_id AND property_id=w.property_id AND archived_at IS NULL FOR UPDATE;
    IF t.id IS NOT NULL AND (coalesce(t.requires_owner_approval,false) OR coalesce(t.owner_dependency,'')='business_decision') AND t.owner_approval_status='approved' THEN
      RAISE EXCEPTION 'This decision was already answered by an owner on this program.';
    END IF;
    IF t.id IS NOT NULL AND (coalesce(t.requires_owner_approval,false) OR coalesce(t.owner_dependency,'')='business_decision') AND t.owner_approval_status IN ('awaiting_owner','changes_requested','pending','not_required') THEN
      SELECT id INTO _appr FROM approvals WHERE entity_type='onboarding_task' AND entity_id=t.id AND property_id=t.property_id AND status IN ('pending','awaiting_owner') ORDER BY created_at DESC LIMIT 1 FOR UPDATE;
      _note := _owner||' '||CASE WHEN _decision='authorize' THEN 'authorized this work' ELSE 'requested changes' END
               ||' in Opportunity "'||w.title||'"'||coalesce(': '||nullif(trim(coalesce(_text,'')),''),'');
      IF _decision='authorize' THEN
        IF _appr IS NOT NULL THEN
          UPDATE approvals SET status='approved', decision_note=_note, decided_at=now(), responded_at=now(), response_channel='owner_portal' WHERE id=_appr;
        END IF;
        UPDATE onboarding_tasks SET owner_approval_status='approved' WHERE id=t.id;
        -- Same record as Approve on a sent Task (owner_item_approve).
        INSERT INTO audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
          VALUES (auth.uid(), 'owner_item_approved', 'onboarding_task', t.id, t.title, jsonb_build_object('opportunity', w.id, 'at', now()));
        _result := 'approved';
      ELSE
        -- Request stays pending; the Task keeps waiting on this one authorization.
        IF _appr IS NOT NULL THEN UPDATE approvals SET decision_note=_note WHERE id=_appr; END IF;
        _result := 'still_waiting';
      END IF;
    END IF;
  END IF;

  UPDATE work_items SET responded_at=now(), viewed_at=coalesce(viewed_at, now()),
    owner_response = owner_response || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'kind',_kind,'decision',_decision,'text',nullif(trim(coalesce(_text,'')),''),'at',now(),
      'by',_owner,'task_id',CASE WHEN _result IS NOT NULL THEN w.source_task_id END,'task_approval',_result)))
   WHERE id=_id;
  PERFORM private.notify_opportunity_staff(_id, CASE WHEN _kind<>'decision' THEN 'responded'
    WHEN _decision='authorize' THEN 'authorized this work' ELSE 'requested changes' END);
END $function$;
;

-- 2. Done outside Resolve: which owner cards (plan cards, sent items, staff Opportunities) belong to a
--    Task done outside Resolve, and where it happens. Ids and the place code only; members and staff.
CREATE OR REPLACE FUNCTION public.owner_outside_resolve_lines(_program uuid)
RETURNS TABLE(source text, item_id uuid, where_code text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'private' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (coalesce(private.is_program_member(_program, auth.uid()), false) OR coalesce(private.is_staff(auth.uid()), false)) THEN
    RAISE EXCEPTION 'Not available.';
  END IF;
  RETURN QUERY
    SELECT 'plan'::text, pc.id, nullif(t.kind_settings->>'where', '')
      FROM public.ao_home_plan_cards pc JOIN public.onboarding_tasks t ON t.id = pc.linked_task_id
     WHERE pc.program_id = _program AND t.task_kind = 'outside_resolve' AND t.archived_at IS NULL
    UNION ALL
    SELECT 'review'::text, r.id, nullif(t.kind_settings->>'where', '')
      FROM public.owner_reviews r
      LEFT JOIN public.owner_item_task_sends s ON s.review_id = r.id
      JOIN public.onboarding_tasks t ON t.id = coalesce(s.task_id, r.onboarding_task_id)
     WHERE r.program_id = _program AND r.archived_at IS NULL AND t.task_kind = 'outside_resolve' AND t.archived_at IS NULL
    UNION ALL
    SELECT 'work'::text, w.id, nullif(t.kind_settings->>'where', '')
      FROM public.work_items w JOIN public.onboarding_tasks t ON t.id = w.source_task_id
     WHERE w.program_id = _program AND t.task_kind = 'outside_resolve' AND t.archived_at IS NULL;
END $$;
REVOKE ALL ON FUNCTION public.owner_outside_resolve_lines(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_outside_resolve_lines(uuid) TO authenticated, service_role;
