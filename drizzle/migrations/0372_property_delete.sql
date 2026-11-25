-- STAGED ONLY. Apply only after Approved: apply property-delete.
-- Existing director helpers, Offboard, ticket policies and all scheduled jobs stay unchanged.
CREATE FUNCTION public.can_delete_onboarding_property() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public,pg_temp AS $$
 SELECT auth.uid() IS NOT NULL AND (coalesce(public.has_role(auth.uid(),'admin'),false)
 OR coalesce(public.is_director(auth.uid()),false) OR coalesce(public.is_onboarding_director(auth.uid()),false))
$$;
REVOKE ALL ON FUNCTION public.can_delete_onboarding_property() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.can_delete_onboarding_property() TO authenticated;

-- Only rows in these property/onboarding families may be removed. Unknown dependencies fail closed.
CREATE FUNCTION public.property_delete_tables() RETURNS text[]
LANGUAGE sql IMMUTABLE SET search_path=public,pg_temp AS $$ SELECT ARRAY[
 'properties','onboarding_projects','onboarding_tasks','onboarding_notes','documents',
 'onboarding_project_stagers','onboarding_project_events','onboarding_task_batches',
 'onboarding_task_file_links','onboarding_task_stage_history','onboarding_task_reviews',
 'onboarding_task_review_events','onboarding_task_review_decisions','onboarding_task_breezeway_links',
 'onboarding_task_breezeway_events','onboarding_task_work_order_watch','onboarding_follows',
 'onboarding_stage_captures','onboarding_flag_snapshots','onboarding_daily_reminders',
 'property_owner_contacts','property_field_provenance','property_external_links',
 'property_credentials','property_label_assignments','property_label_events',
 'property_profile_photos','property_profile_edits','property_assets','property_fact_proposals',
 'property_activity_log','credential_intake_queue','credential_access_log',
 'work_items','work_item_resources','owner_reviews','owner_review_properties',
 'owner_request_messages','owner_notifications','owner_item_task_sends',
 'approvals','approval_email_responses','owner_approval_publications','owner_approval_receipts',
 'document_recipient_events','homeowner_answer_reviews','homeowner_updates',
 'owner_closing_updates','owner_closing_update_events','staff_notifications',
 'handoff_reminders','handoff_step_history','home_handoff_decisions','property_handoffs'
 ]::text[] $$;
REVOKE ALL ON FUNCTION public.property_delete_tables() FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.property_delete_scope(_property_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE scope jsonb:='{}'; tab text; ids jsonb; oldscope jsonb; fk record; pred text;
BEGIN
 -- Roots include polymorphic Task/project/file/request links, not just declared foreign keys.
 FOREACH tab IN ARRAY public.property_delete_tables() LOOP
  IF to_regclass('public.'||tab) IS NULL THEN CONTINUE; END IF;
  pred := CASE WHEN tab='properties' THEN 't.id=$1' ELSE '(to_jsonb(t)->>''property_id'')=$1::text' END;
  IF tab<>'properties' THEN
   pred:=pred||' OR (to_jsonb(t)->>''project_id'') IN (SELECT id::text FROM public.onboarding_projects WHERE property_id=$1)'
    ||' OR (to_jsonb(t)->>''task_id'') IN (SELECT id::text FROM public.onboarding_tasks WHERE property_id=$1)'
    ||' OR (to_jsonb(t)->>''entity_type'' IN (''property'',''onboarding_project'',''onboarding_task'') AND (to_jsonb(t)->>''entity_id''=$1::text OR to_jsonb(t)->>''entity_id'' IN (SELECT id::text FROM public.onboarding_projects WHERE property_id=$1 UNION SELECT id::text FROM public.onboarding_tasks WHERE property_id=$1)))';
  END IF;
  EXECUTE format('SELECT coalesce(jsonb_agg(t.ctid::text),''[]''::jsonb) FROM public.%I t WHERE %s',tab,pred) INTO ids USING _property_id;
  scope:=scope||jsonb_build_object(tab,ids);
 END LOOP;
 LOOP
  oldscope:=scope;
  FOR fk IN SELECT c.conrelid::regclass as child,c.confrelid::regclass as parent,
     ch.relname as childname,pa.relname as parentname,
     ca.attname as childcol,ra.attname as parentcol
    FROM pg_constraint c JOIN pg_class ch ON ch.oid=c.conrelid JOIN pg_class pa ON pa.oid=c.confrelid
    JOIN pg_namespace ns ON ns.oid=ch.relnamespace
    JOIN pg_attribute ca ON ca.attrelid=c.conrelid AND ca.attnum=c.conkey[1]
    JOIN pg_attribute ra ON ra.attrelid=c.confrelid AND ra.attnum=c.confkey[1]
    WHERE c.contype='f' AND ns.nspname='public' AND cardinality(c.conkey)=1
     AND ch.relname=ANY(public.property_delete_tables()) AND pa.relname=ANY(public.property_delete_tables())
  LOOP
   EXECUTE format('SELECT coalesce(jsonb_agg(DISTINCT x.v),''[]''::jsonb) FROM (SELECT jsonb_array_elements_text($1) v UNION SELECT ch.ctid::text FROM %s ch JOIN %s pa ON ch.%I=pa.%I WHERE pa.ctid::text IN (SELECT jsonb_array_elements_text($2))) x',fk.child,fk.parent,fk.childcol,fk.parentcol)
    INTO ids USING scope->fk.childname,scope->fk.parentname;
   scope:=scope||jsonb_build_object(fk.childname,ids);
  END LOOP;
  EXIT WHEN scope=oldscope;
 END LOOP;
 RETURN scope;
END $$;
REVOKE ALL ON FUNCTION public.property_delete_scope(uuid) FROM PUBLIC,anon,authenticated;

CREATE FUNCTION public.check_onboarding_property_delete(_property_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE p public.properties; reasons text[]:='{}'; n bigint; tab text; label text; scope jsonb; fk record; ids jsonb;
BEGIN
 IF NOT public.can_delete_onboarding_property() THEN RAISE EXCEPTION 'Only Admin and the Directors can delete an onboarding home.' USING ERRCODE='42501'; END IF;
 SELECT * INTO p FROM public.properties WHERE id=_property_id;
 IF NOT FOUND THEN RAISE EXCEPTION 'This home could not be found.'; END IF;
 IF p.lifecycle_status IS DISTINCT FROM 'onboarding' OR p.handoff_accepted_at IS NOT NULL
 OR EXISTS(SELECT 1 FROM public.onboarding_projects j WHERE j.property_id=p.id AND (j.handoff_state IN ('ready','ready_for_ops','handoff_requested','accepted','ops_accepted') OR j.ops_accepted_at IS NOT NULL))
 OR EXISTS(SELECT 1 FROM public.property_handoffs h WHERE h.property_id=p.id AND h.status NOT IN ('draft','corrections')) THEN
  reasons:=array_append(reasons,'The home is no longer in Onboarding.');
 END IF;
 IF nullif(btrim(p.ownerrez_property_id),'') IS NOT NULL THEN reasons:=array_append(reasons,'An OwnerRez ID is on file.'); END IF;
 IF EXISTS(SELECT 1 FROM public.tickets WHERE property_id=p.id) THEN reasons:=array_append(reasons,'Operations tickets are on file.'); END IF;
 IF EXISTS(SELECT 1 FROM public.owner_time_entry_properties WHERE property_id=p.id)
 OR EXISTS(SELECT 1 FROM public.owner_time_entries e WHERE e.review_id IN (SELECT id FROM public.owner_reviews WHERE property_id=p.id OR onboarding_task_id IN (SELECT id FROM public.onboarding_tasks WHERE property_id=p.id)))
 OR EXISTS(SELECT 1 FROM public.owner_time_entries e JOIN public.owner_programs op ON op.id=e.program_id WHERE (op.property_id=p.id OR EXISTS(SELECT 1 FROM public.owner_program_properties pp WHERE pp.program_id=op.id AND pp.property_id=p.id)) AND NOT EXISTS(SELECT 1 FROM public.owner_time_entry_properties ep WHERE ep.entry_id=e.id)) THEN
  reasons:=array_append(reasons,'Homeowner hours are on file.');
 END IF;
 IF EXISTS(SELECT 1 FROM public.owner_reviews r WHERE (r.property_id=p.id OR r.onboarding_task_id IN (SELECT id FROM public.onboarding_tasks WHERE property_id=p.id) OR EXISTS(SELECT 1 FROM public.owner_review_properties rp WHERE rp.review_id=r.id AND rp.property_id=p.id)) AND (r.responded_at IS NOT NULL OR r.owner_decision IS NOT NULL OR r.owner_response IS NOT NULL))
 OR EXISTS(SELECT 1 FROM public.approvals a WHERE (a.property_id=p.id OR a.entity_id IN (SELECT id FROM public.onboarding_tasks WHERE property_id=p.id)) AND (a.decided_at IS NOT NULL OR a.responded_at IS NOT NULL OR a.status IN ('approved','rejected','declined')))
 OR EXISTS(SELECT 1 FROM public.work_items w WHERE w.property_id=p.id AND (w.responded_at IS NOT NULL OR (to_jsonb(w)->'owner_response' IS NOT NULL AND to_jsonb(w)->'owner_response' NOT IN ('null'::jsonb,'[]'::jsonb,'{}'::jsonb,'""'::jsonb))))
 OR EXISTS(SELECT 1 FROM public.owner_request_messages m WHERE (m.property_id=p.id OR m.task_id IN (SELECT id FROM public.onboarding_tasks WHERE property_id=p.id) OR m.review_id IN (SELECT id FROM public.owner_reviews WHERE property_id=p.id)) AND m.author_type='owner') THEN
  reasons:=array_append(reasons,'Homeowner decisions or answers are on file.');
 END IF;
 FOREACH tab IN ARRAY ARRAY['expenses','financial_requests','onboarding_budgets','onboarding_budget_lines','utility_costs','statement_reconciliations','claims','guest_recovery','expense_recoveries','property_financial_statements'] LOOP
  IF to_regclass('public.'||tab) IS NULL THEN CONTINUE; END IF;
  EXECUTE format('SELECT count(*) FROM public.%I t WHERE to_jsonb(t)->>''property_id''=$1::text OR to_jsonb(t)->>''project_id'' IN (SELECT id::text FROM public.onboarding_projects WHERE property_id=$1) OR to_jsonb(t)->>''task_id'' IN (SELECT id::text FROM public.onboarding_tasks WHERE property_id=$1) OR to_jsonb(t)->>''approval_id'' IN (SELECT id::text FROM public.approvals WHERE property_id=$1)',tab) INTO n USING p.id;
  IF n>0 THEN reasons:=array_append(reasons,'Finance records are on file.'); EXIT; END IF;
 END LOOP;
 scope:=public.property_delete_scope(p.id);
 -- External file bytes cannot be deleted atomically with PostgreSQL rows. Never half-delete them.
 IF EXISTS(SELECT 1 FROM public.documents d WHERE d.ctid::text IN (SELECT jsonb_array_elements_text(scope->'documents')) AND (nullif(d.storage_path,'') IS NOT NULL OR nullif(d.external_url,'') IS NOT NULL)) THEN
  reasons:=array_append(reasons,'Stored files need a reviewed removal plan.');
 END IF;
 -- Protect records outside the permitted removal families, including shared-home rows and history.
 FOREACH tab IN ARRAY public.property_delete_tables() LOOP
  IF tab='properties' OR to_regclass('public.'||tab) IS NULL THEN CONTINUE; END IF;
  EXECUTE format('SELECT count(*) FROM public.%I t WHERE t.ctid::text IN (SELECT jsonb_array_elements_text($1)) AND to_jsonb(t)->>''property_id'' IS NOT NULL AND to_jsonb(t)->>''property_id''<>$2::text',tab) INTO n USING scope->tab,p.id;
  IF n>0 THEN reasons:=array_append(reasons,'Records shared with another home are on file.'); EXIT; END IF;
 END LOOP;
 FOR fk IN SELECT c.conrelid::regclass as child,c.confrelid::regclass as parent,ch.relname as childname,pa.relname as parentname,ca.attname as childcol,ra.attname as parentcol
 FROM pg_constraint c JOIN pg_class ch ON ch.oid=c.conrelid JOIN pg_class pa ON pa.oid=c.confrelid JOIN pg_namespace ns ON ns.oid=ch.relnamespace
 JOIN pg_attribute ca ON ca.attrelid=c.conrelid AND ca.attnum=c.conkey[1] JOIN pg_attribute ra ON ra.attrelid=c.confrelid AND ra.attnum=c.confkey[1]
 WHERE c.contype='f' AND ns.nspname='public' AND pa.relname=ANY(public.property_delete_tables()) AND NOT(ch.relname=ANY(public.property_delete_tables())) LOOP
  EXECUTE format('SELECT count(*) FROM %s ch JOIN %s pa ON ch.%I=pa.%I WHERE pa.ctid::text IN (SELECT jsonb_array_elements_text($1))',fk.child,fk.parent,fk.childcol,fk.parentcol) INTO n USING scope->fk.parentname;
  IF n>0 THEN reasons:=array_append(reasons,'Other linked records must be kept.'); EXIT; END IF;
 END LOOP;
 FOR tab IN SELECT DISTINCT c.table_name FROM information_schema.columns c JOIN pg_class t ON t.relname=c.table_name JOIN pg_namespace ns ON ns.oid=t.relnamespace WHERE c.table_schema='public' AND c.column_name='property_id' AND ns.nspname='public' AND t.relkind='r' AND NOT(c.table_name=ANY(public.property_delete_tables())) LOOP
  EXECUTE format('SELECT count(*) FROM public.%I WHERE property_id=$1',tab) INTO n USING p.id;
  IF n>0 AND NOT('Other linked records must be kept.'=ANY(reasons)) THEN reasons:=array_append(reasons,'Other linked records must be kept.'); END IF;
 END LOOP;
 label:=concat_ws(', ',nullif(btrim(p.address_line1),''),nullif(btrim(p.unit),''),nullif(btrim(p.city),''),nullif(concat_ws(' ',p.state,p.postal_code),''));
 IF nullif(btrim(p.address_line1),'') IS NULL THEN reasons:=array_append(reasons,'The home needs an address before deletion.'); END IF;
 RETURN jsonb_build_object('allowed',cardinality(reasons)=0,'address',label,'reasons',to_jsonb(reasons),'counts',(SELECT jsonb_object_agg(key,jsonb_array_length(value)) FROM jsonb_each(scope)));
END $$;
REVOKE ALL ON FUNCTION public.check_onboarding_property_delete(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.check_onboarding_property_delete(uuid) TO authenticated;

CREATE FUNCTION public.delete_onboarding_property(_property_id uuid,_address text,_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE checked jsonb; scope jsonb; tab text; ids jsonb; removed bigint; counts jsonb:='{}'; remaining jsonb; progressed boolean; actor text; audit_id uuid:=gen_random_uuid();
BEGIN
 IF NOT public.can_delete_onboarding_property() THEN RAISE EXCEPTION 'Only Admin and the Directors can delete an onboarding home.' USING ERRCODE='42501'; END IF;
 IF nullif(btrim(_reason),'') IS NULL THEN RAISE EXCEPTION 'Write a reason for deleting this home.'; END IF;
 -- Freeze the predicate sources and descendants during this short, rare transaction.
 -- Sorted locks avoid different delete calls acquiring these relations in opposite orders.
 FOR tab IN SELECT relname FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='public' AND c.relkind='r' AND (relname=ANY(public.property_delete_tables()) OR relname IN ('tickets','owner_time_entries','owner_time_entry_properties','owner_programs','owner_program_properties','expenses','financial_requests','onboarding_budgets','onboarding_budget_lines','utility_costs','statement_reconciliations','claims','guest_recovery','expense_recoveries','property_financial_statements')) ORDER BY relname LOOP
  EXECUTE format('LOCK TABLE public.%I IN SHARE ROW EXCLUSIVE MODE',tab);
 END LOOP;
 PERFORM 1 FROM public.properties WHERE id=_property_id FOR UPDATE;
 checked:=public.check_onboarding_property_delete(_property_id);
 IF NOT (checked->>'allowed')::boolean THEN RAISE EXCEPTION '% Use Offboard instead.',(SELECT string_agg(value,' ') FROM jsonb_array_elements_text(checked->'reasons')); END IF;
 IF btrim(_address) IS DISTINCT FROM checked->>'address' THEN RAISE EXCEPTION 'Type the home address exactly to confirm.'; END IF;
 SELECT coalesce(full_name,'Admin or Director') INTO actor FROM public.profiles WHERE id=auth.uid();
 scope:=public.property_delete_scope(_property_id); remaining:=scope;
 counts:=(SELECT jsonb_object_agg(key,jsonb_array_length(value)) FROM jsonb_each(scope));
 PERFORM set_config('resolve.property_delete_id',_property_id::text,true);
 -- FK failures are retried only after a child family was removed; the enclosing RPC is atomic.
 LOOP
  progressed:=false;
  FOR tab,ids IN SELECT key,value FROM jsonb_each(remaining) WHERE jsonb_array_length(value)>0 ORDER BY CASE WHEN key='properties' THEN 1 ELSE 0 END,key LOOP
   BEGIN
    EXECUTE format('DELETE FROM public.%I WHERE ctid::text IN (SELECT jsonb_array_elements_text($1))',tab) USING ids;
    GET DIAGNOSTICS removed=ROW_COUNT;
    remaining:=remaining||jsonb_build_object(tab,'[]'::jsonb); progressed:=true;
   EXCEPTION WHEN foreign_key_violation THEN NULL;
   END;
  END LOOP;
  EXIT WHEN NOT EXISTS(SELECT 1 FROM jsonb_each(remaining) WHERE jsonb_array_length(value)>0);
  IF NOT progressed THEN RAISE EXCEPTION 'Linked records prevented deletion. Nothing was removed. Use Offboard instead.'; END IF;
 END LOOP;
 PERFORM set_config('resolve.property_delete_id','',true);
 INSERT INTO public.audit_log(id,actor_id,actor_label,action,entity_type,entity_id,entity_label,reason,before_value,after_value)
 VALUES(audit_id,auth.uid(),coalesce(actor,'Admin or Director'),'property.deleted','property',_property_id,checked->>'address',btrim(_reason),jsonb_build_object('address',checked->>'address'),jsonb_build_object('removed',counts,'total',(SELECT sum(value::text::bigint) FROM jsonb_each(counts))));
 RETURN jsonb_build_object('auditId',audit_id,'removed',counts);
END $$;
REVOKE ALL ON FUNCTION public.delete_onboarding_property(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.delete_onboarding_property(uuid,text,text) TO authenticated;

-- Direct property DELETE remains unavailable even where an older broad policy grants it.
CREATE FUNCTION public.guard_onboarding_property_delete() RETURNS trigger
LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
 IF current_user IS DISTINCT FROM (SELECT pg_get_userbyid(proowner) FROM pg_proc WHERE oid='public.delete_onboarding_property(uuid,text,text)'::regprocedure)
 OR current_setting('resolve.property_delete_id',true) IS DISTINCT FROM OLD.id::text
 OR NOT public.can_delete_onboarding_property()
 THEN RAISE EXCEPTION 'Delete an onboarding home through its checked Delete property action.' USING ERRCODE='42501'; END IF;
 RETURN OLD;
END $$;
CREATE TRIGGER property_delete_checked_action BEFORE DELETE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.guard_onboarding_property_delete();
REVOKE ALL ON FUNCTION public.guard_onboarding_property_delete() FROM PUBLIC,anon,authenticated;