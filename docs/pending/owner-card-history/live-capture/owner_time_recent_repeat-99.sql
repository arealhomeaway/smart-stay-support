CREATE OR REPLACE FUNCTION private.owner_time_recent_repeat(_program uuid, _owner uuid, _day date, _minutes integer, _activity text, _note text, _chain_of uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  WITH RECURSIVE chain(id) AS (
    SELECT _chain_of WHERE _chain_of IS NOT NULL
    UNION
    SELECT e.amends_entry_id FROM public.owner_time_entries e JOIN chain c ON e.id = c.id WHERE e.amends_entry_id IS NOT NULL
  )
  SELECT EXISTS (
    SELECT 1 FROM public.owner_time_entries d
     WHERE d.program_id = _program AND d.owner_user_id = _owner AND d.entry_date = _day AND d.minutes = _minutes
       AND d.created_at > now() - interval '10 minutes'
       AND lower(regexp_replace(btrim(d.activity), '\s+', ' ', 'g')) = lower(regexp_replace(btrim(coalesce(_activity, '')), '\s+', ' ', 'g'))
       AND (nullif(btrim(coalesce(_note, '')), '') IS NULL OR position(btrim(_note) IN coalesce(d.comments, '')) > 0)
       AND d.id NOT IN (SELECT id FROM chain))
$function$
;
