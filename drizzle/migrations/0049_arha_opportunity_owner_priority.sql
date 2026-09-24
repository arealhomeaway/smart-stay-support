ALTER TABLE public.work_items ADD COLUMN IF NOT EXISTS owner_priority integer;
COMMENT ON COLUMN public.work_items.owner_priority IS 'Owner-facing presentation order for ARHA Opportunities within one property (1 = first). Presentation only — never used for Task logic.';

WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY property_id ORDER BY created_at DESC) AS rn
  FROM public.work_items
  WHERE kind='opportunity' AND source='arha' AND status NOT IN ('draft','complete','archived')
)
UPDATE public.work_items w SET owner_priority = ranked.rn FROM ranked WHERE w.id = ranked.id;

CREATE OR REPLACE FUNCTION public.reorder_arha_opportunities(_property_id uuid, _ids uuid[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE _n int; _home text;
BEGIN
  IF NOT (is_onboarding_staff(auth.uid()) OR is_staff(auth.uid())) THEN RAISE EXCEPTION 'Only ARHA staff can reorder Opportunities.'; END IF;
  IF _ids IS NULL OR array_length(_ids,1) IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO _n FROM work_items
   WHERE id = ANY(_ids) AND property_id=_property_id AND kind='opportunity' AND source='arha' AND status NOT IN ('draft','complete','archived');
  IF _n <> array_length(_ids,1) OR _n <> (SELECT count(DISTINCT x) FROM unnest(_ids) x) THEN
    RAISE EXCEPTION 'Only sent ARHA Opportunities on this home can be reordered.'; END IF;
  UPDATE work_items w SET owner_priority = o.ord, updated_at = w.updated_at
    FROM unnest(_ids) WITH ORDINALITY AS o(id, ord) WHERE w.id = o.id;
  SELECT coalesce(nickname, name, address_line1) INTO _home FROM properties WHERE id=_property_id;
  INSERT INTO audit_log(actor_id, action, entity_type, entity_id, entity_label, after_value)
  VALUES (auth.uid(), 'arha_opportunity_order.updated', 'property', _property_id, 'ARHA Opportunity order updated · '||coalesce(_home,''), to_jsonb(_ids));
END $function$;
REVOKE ALL ON FUNCTION public.reorder_arha_opportunities(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reorder_arha_opportunities(uuid, uuid[]) TO authenticated;