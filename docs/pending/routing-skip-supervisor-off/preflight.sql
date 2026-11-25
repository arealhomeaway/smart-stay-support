-- Expect coordinator_for md5 = d8606f0a706f423469eb7e3b3dd06615 (captured), seat_override_at present.
SELECT proname, md5(pg_get_functiondef(oid)) FROM pg_proc WHERE proname IN ('coordinator_for','ticket_route_at');
SELECT count(*) FROM pg_proc WHERE proname='seat_override_at';
