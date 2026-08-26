REVOKE ALL ON FUNCTION public.seed_demo_owner_program(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.archive_demo_owner_program(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_owner_program_rule_change() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_demo_owner_program(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.archive_demo_owner_program(uuid) TO service_role;