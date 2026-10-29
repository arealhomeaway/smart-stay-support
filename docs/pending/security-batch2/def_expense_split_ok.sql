CREATE OR REPLACE FUNCTION private.expense_split_ok(_alloc jsonb, _amount numeric)
 RETURNS boolean
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT jsonb_typeof(_alloc) = 'array' AND jsonb_array_length(_alloc) >= 2 AND _amount IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(_alloc) e
      WHERE (e->>'party') NOT IN ('owner','arha','guest','vendor','insurance') OR (e->>'amount') IS NULL OR (e->>'amount')::numeric < 0)
    AND (SELECT coalesce(sum((e->>'amount')::numeric),0) FROM jsonb_array_elements(_alloc) e) = _amount
$function$
