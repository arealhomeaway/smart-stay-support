CREATE OR REPLACE FUNCTION public.remove_vendor_custom_field(_field_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE f public.vendor_custom_fields; used boolean;
BEGIN
  IF NOT private.is_supervisor(auth.uid()) THEN RAISE EXCEPTION 'Only managers and supervisors can change vendor columns.'; END IF;
  SELECT * INTO f FROM public.vendor_custom_fields WHERE id = _field_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Column not found.'; END IF;
  SELECT EXISTS (SELECT 1 FROM public.vendor_orgs WHERE custom_fields ? f.key AND custom_fields->f.key <> 'null'::jsonb AND custom_fields->>f.key <> '') INTO used;
  IF used OR NOT public.has_role(auth.uid(),'admin') THEN
    UPDATE public.vendor_custom_fields SET archived_at = now(), archived_by = auth.uid() WHERE id = _field_id;
    RETURN 'archived';
  END IF;
  DELETE FROM public.vendor_custom_fields WHERE id = _field_id;
  RETURN 'deleted';
END $function$
