-- Keep the existing immutable-evidence guard. Only the three archive fields join its mutable metadata list.
DO $patch$
DECLARE def text;
BEGIN
 SELECT pg_get_functiondef('public.guard_owner_time_write()'::regprocedure) INTO def;
 IF md5(def)<>'8d8f39084d56dc02f75c872b8d115a99' THEN RAISE EXCEPTION 'Owner-time write guard changed; reviewed patch not applied'; END IF;
 def:=replace(def,
  $old$ARRAY['review_status','review_note','reviewed_by','reviewed_at','flagged','review_version']$old$,
  $new$ARRAY['review_status','review_note','reviewed_by','reviewed_at','flagged','review_version','archived_at','archived_by','archive_reason']$new$);
 EXECUTE def;
END $patch$;
