-- Review fixes 2, ao_central tidy-up: same body, STABLE (time zone rules can change), fixed search_path. ACL unchanged by ALTER.
ALTER FUNCTION private.ao_central(date, integer) STABLE;
ALTER FUNCTION private.ao_central(date, integer) SET search_path = pg_catalog, public;
