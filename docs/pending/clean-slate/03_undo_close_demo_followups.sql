-- Undo for 03_close_demo_followups.sql: reopens the two demo follow-ups and puts their 2 alerts
-- back exactly as captured on Nov 9, 2026 (01:05 UTC rows). Only for these ids.

UPDATE public.owner_followup_tasks
   SET status = 'open', closed_at = NULL, closed_by = NULL, close_note = NULL
 WHERE id IN ('afb3bf33-a6a3-446c-b2d0-eb149d9cbab2', 'aa1fda64-f8e5-4502-835c-0a9915175b89')
   AND status = 'closed'
   AND close_note = 'Closed in the clean slate: the assigned test account was removed';

INSERT INTO public.staff_notifications
SELECT (jsonb_populate_record(NULL::public.staff_notifications, r)).*
  FROM jsonb_array_elements('[
 {"id":"6a8f02f0-d15f-4cf6-9f83-27ed4b1069a1","user_id":"d1dafc2e-ba9a-450a-94e3-ad9c11c10ef8","kind":"owner_followup","title":"Reach out to ZZ QA OWNER — Dana Birch (test) about 1 item waiting. Email is fine.","body":"Open the home''s Active Owner section to see what is waiting.","entity_type":"owner_followup_task","entity_id":"afb3bf33-a6a3-446c-b2d0-eb149d9cbab2","link_path":"/property/a0000000-0000-4000-8000-00000000b001#active-owner","priority":"p3","actor_id":null,"read_at":null,"email_status":"skipped","email_attempts":0,"email_error":null,"delivered_at":null,"is_demo":true,"created_at":"2026-11-09T01:05:05.848987+00:00","retracted_at":null,"retracted_by":null,"retracted_reason":null},
 {"id":"a0044d1d-fe5a-4277-aa52-b2f5f5f15ca2","user_id":"d1dafc2e-ba9a-450a-94e3-ad9c11c10ef8","kind":"owner_followup","title":"Reach out to Riley Adler about 30 items waiting. Email is fine.","body":"Open the home''s Active Owner section to see what is waiting.","entity_type":"owner_followup_task","entity_id":"aa1fda64-f8e5-4502-835c-0a9915175b89","link_path":"/property/a0000000-0000-4000-8000-00000000a001#active-owner","priority":"p3","actor_id":null,"read_at":null,"email_status":"skipped","email_attempts":0,"email_error":null,"delivered_at":null,"is_demo":true,"created_at":"2026-11-09T01:05:06.116184+00:00","retracted_at":null,"retracted_by":null,"retracted_reason":null}
]'::jsonb) AS r
 ON CONFLICT (id) DO NOTHING;
