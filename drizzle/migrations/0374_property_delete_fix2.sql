CREATE OR REPLACE FUNCTION public.delete_onboarding_property(_property_id uuid,_address text,_reason text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE checked jsonb; scope jsonb; tab text; ids jsonb; removed bigint; counts jsonb:='{}'; remaining jsonb; progressed boolean; actor text; audit_id uuid:=gen_random_uuid();
BEGIN
 IF NOT public.can_delete_onboarding_property() THEN RAISE EXCEPTION 'Only Admin and the Directors can delete an onboarding home.' USING ERRCODE='42501'; END IF;
 IF nullif(btrim(_reason),'') IS NULL THEN RAISE EXCEPTION 'Write a reason for deleting this home.'; END IF;
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
 LOOP
  progressed:=false; remaining:=public.property_delete_scope(_property_id);
  EXIT WHEN NOT EXISTS(SELECT 1 FROM jsonb_each(remaining) WHERE jsonb_array_length(value)>0);
  FOR tab,ids IN SELECT key,value FROM jsonb_each(remaining) WHERE jsonb_array_length(value)>0 ORDER BY CASE WHEN key='properties' THEN 1 ELSE 0 END,key LOOP
   BEGIN
    EXECUTE format('DELETE FROM public.%I WHERE ctid::text IN (SELECT jsonb_array_elements_text($1))',tab) USING ids;
    GET DIAGNOSTICS removed=ROW_COUNT;
    IF removed>0 THEN progressed:=true; END IF;
   EXCEPTION WHEN foreign_key_violation THEN NULL;
   END;
  END LOOP;
  IF NOT progressed THEN RAISE EXCEPTION 'Linked records prevented deletion. Nothing was removed. Use Offboard instead.'; END IF;
 END LOOP;
 PERFORM set_config('resolve.property_delete_id','',true);
 INSERT INTO public.audit_log(id,actor_id,actor_label,action,entity_type,entity_id,entity_label,reason,before_value,after_value)
 VALUES(audit_id,auth.uid(),coalesce(actor,'Admin or Director'),'property.deleted','property',_property_id,checked->>'address',btrim(_reason),jsonb_build_object('address',checked->>'address'),jsonb_build_object('removed',counts,'total',(SELECT sum(value::text::bigint) FROM jsonb_each(counts))));
 RETURN jsonb_build_object('auditId',audit_id,'removed',counts);
END $$;