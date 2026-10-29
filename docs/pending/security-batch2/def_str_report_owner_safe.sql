CREATE OR REPLACE FUNCTION private.str_report_owner_safe(_built jsonb, _excluded boolean)
 RETURNS jsonb
 LANGUAGE sql
 IMMUTABLE
AS $function$
  SELECT (_built - 'blockers' - 'rows')
    || jsonb_build_object('rows', coalesce((SELECT jsonb_agg(r - 'internal') FROM jsonb_array_elements(_built->'rows') r), '[]'::jsonb))
    || CASE WHEN _excluded OR (_built->'totals'->>'underReview')::int > 0
            THEN jsonb_build_object('underReviewNote','Some operational activity records remain under review and are not included in finalized time totals.')
            ELSE '{}'::jsonb END
$function$
