-- Expect: function absent; staff_notifications has kind, title, body, link_path, email_status, is_demo.
SELECT count(*) AS existing FROM pg_proc WHERE proname = 'notify_my_shift_end';
SELECT column_name FROM information_schema.columns WHERE table_name = 'staff_notifications'
 AND column_name IN ('kind','title','body','link_path','email_status','is_demo') ORDER BY 1;
SELECT count(*) AS private_is_staff FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'private' AND proname = 'is_staff';
