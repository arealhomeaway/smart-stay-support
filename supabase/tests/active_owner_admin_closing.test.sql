-- Isolated fixture database ONLY after loading pending 0158. Never run on the shared live database.
BEGIN;
DO $$
DECLARE admin_id uuid:='a1000000-0000-4000-8000-000000000001'; staff_id uuid:='a1000000-0000-4000-8000-000000000002';
BEGIN
 INSERT INTO public.user_roles(user_id,role) VALUES(admin_id,'admin'),(staff_id,'tech');
 IF private.can_correct_actual_closing(admin_id) IS DISTINCT FROM true THEN RAISE EXCEPTION 'Admin must be allowed to confirm/correct closing.'; END IF;
 IF private.can_correct_actual_closing(staff_id) IS DISTINCT FROM false THEN RAISE EXCEPTION 'Property Coordinator must remain refused.'; END IF;
END $$;
ROLLBACK;