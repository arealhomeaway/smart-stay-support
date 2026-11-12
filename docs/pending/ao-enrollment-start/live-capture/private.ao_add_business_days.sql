CREATE OR REPLACE FUNCTION private.ao_add_business_days(_d date, _n integer)
 RETURNS date
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE d date := _d; left_n int := abs(_n); step int := CASE WHEN _n >= 0 THEN 1 ELSE -1 END;
BEGIN
  WHILE left_n > 0 LOOP
    d := d + step;
    IF extract(isodow FROM d) < 6 AND NOT EXISTS (SELECT 1 FROM public.ao_business_holidays h WHERE h.day = d) THEN
      left_n := left_n - 1;
    END IF;
  END LOOP;
  RETURN d;
END $function$
;

