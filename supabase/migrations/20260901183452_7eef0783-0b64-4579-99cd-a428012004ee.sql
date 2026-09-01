REVOKE ALL ON FUNCTION public.seat_override_at(text, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.seat_eligible_now(text, timestamptz) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.seat_holder_at(text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seat_override_at(text, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.seat_eligible_now(text, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.seat_holder_at(text, timestamptz) TO authenticated, service_role;