CREATE OR REPLACE FUNCTION private.cleaner_person_reviews(_person bigint, _fixture boolean)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE a record; others int;
BEGIN
  SELECT * INTO a FROM cleaner_breezeway_accounts WHERE breezeway_person_id=_person;
  IF a IS NULL THEN RETURN; END IF;
  -- Only a never-classified account needs review; "Unknown" is a deliberate human decision.
  IF a.classification = 'unclassified' THEN
    PERFORM private.cleaner_open_review('unclassified_assignee', 'person:unclassified:'||_person, NULL, _person, NULL, NULL,
      NULL, jsonb_build_object('name', a.last_seen_name, 'classification', a.classification), _fixture);
    SELECT count(*) INTO others FROM cleaner_breezeway_accounts o
     WHERE o.breezeway_person_id <> _person
       AND lower(regexp_replace(btrim(coalesce(o.last_seen_name,'')), '\s+', ' ', 'g'))
         = lower(regexp_replace(btrim(coalesce(a.last_seen_name,'')), '\s+', ' ', 'g'))
       AND coalesce(a.last_seen_name,'') <> '';
    IF others > 0 THEN
      PERFORM private.cleaner_open_review('possible_duplicate_identity', 'person:dup:'||_person, NULL, _person, NULL, NULL,
        NULL, jsonb_build_object('name', a.last_seen_name, 'same_name_accounts', others), _fixture);
    ELSE
      PERFORM private.cleaner_close_review('person:dup:'||_person, 'No other account shares this name');
    END IF;
  ELSE
    PERFORM private.cleaner_close_review('person:unclassified:'||_person, 'Classified as '||a.classification);
    PERFORM private.cleaner_close_review('person:dup:'||_person, 'Classified as '||a.classification);
  END IF;
END $function$;