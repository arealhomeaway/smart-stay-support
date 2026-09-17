BEGIN;
CREATE FUNCTION pg_temp.assert_scope(ok boolean,message text) RETURNS void LANGUAGE plpgsql AS $$ BEGIN IF NOT coalesce(ok,false) THEN RAISE EXCEPTION '%',message; END IF; END $$;
CREATE FUNCTION pg_temp.denied_scope(statement text,expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN BEGIN EXECUTE statement; EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%'||expected||'%' THEN RETURN; ELSE RAISE; END IF; END; RAISE EXCEPTION 'Expected denial: %',statement; END $$;
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('00000000-0000-4000-9000-000000000001','owner@example.test',now()),
 ('00000000-0000-4000-9000-000000000002','other@example.test',now()),
 ('00000000-0000-4000-9000-000000000003','admin@example.test',now()),
 ('00000000-0000-4000-9000-000000000004','vendor@example.test',now());
INSERT INTO user_roles(user_id,role) VALUES
 ('00000000-0000-4000-9000-000000000001','owner'),('00000000-0000-4000-9000-000000000002','owner'),
 ('00000000-0000-4000-9000-000000000003','admin'),('00000000-0000-4000-9000-000000000004','vendor');
INSERT INTO property_owners(id,name,email,active) VALUES
 ('00000000-0000-4000-9000-000000000011','Canonical Owner','canonical@example.test',true),
 ('00000000-0000-4000-9000-000000000012','Other Owner','other@example.test',true);
INSERT INTO properties(id,name,owner_record_id,is_demo,address_line1,private_access_note) VALUES
 ('00000000-0000-4000-9000-000000000021','Owner Home','00000000-0000-4000-9000-000000000011',false,'1 Owner Lane','SECRET access credential'),
 ('00000000-0000-4000-9000-000000000022','Other Home','00000000-0000-4000-9000-000000000012',false,'2 Other Lane','SECRET other credential');
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000003',true);
INSERT INTO owner_programs(id,property_id,owner_record_id,owner_user_id,status,is_demo,owner_name,internal_notes,completion_report) VALUES
 ('00000000-0000-4000-9000-000000000031','00000000-0000-4000-9000-000000000021','00000000-0000-4000-9000-000000000011','00000000-0000-4000-9000-000000000001','draft',false,'Noncanonical free text','SECRET private notes','{"private":"SECRET report"}'),
 ('00000000-0000-4000-9000-000000000032','00000000-0000-4000-9000-000000000022','00000000-0000-4000-9000-000000000012','00000000-0000-4000-9000-000000000002','draft',false,'Other cached name','SECRET other notes',NULL);
INSERT INTO owner_program_properties(program_id,property_id,inclusion_status,closing_date,closing_confirmed) VALUES
 ('00000000-0000-4000-9000-000000000031','00000000-0000-4000-9000-000000000021','included',current_date,true),
 ('00000000-0000-4000-9000-000000000032','00000000-0000-4000-9000-000000000022','included',current_date,true);
INSERT INTO tickets(id,property_id,title,is_demo,vendor_user_id) VALUES
 ('00000000-0000-4000-9000-000000000041','00000000-0000-4000-9000-000000000021','SECRET operational Ticket',false,'00000000-0000-4000-9000-000000000004');
INSERT INTO work_orders(id,ticket_id,property_id,title,scope,quote_amount,final_cost,approval_status,emergency_reason)
 VALUES('00000000-0000-4000-9000-000000000051','00000000-0000-4000-9000-000000000041','00000000-0000-4000-9000-000000000021','SECRET work title','SECRET access',150,125,'not_required','SECRET emergency');

-- Published opportunity, private staff-only fields, genuine retained history and legacy alert text.
INSERT INTO owner_reviews(id,program_id,property_id,status,is_demo,title,staff_context,business_question)
 VALUES('00000000-0000-4000-9000-000000000061','00000000-0000-4000-9000-000000000031','00000000-0000-4000-9000-000000000021','awaiting_owner',false,'Owner reviewed request','SECRET staff note','Explain your preference');
INSERT INTO owner_reviews(id,program_id,property_id,status,is_demo,title,staff_context)
 VALUES('00000000-0000-4000-9000-000000000062','00000000-0000-4000-9000-000000000031','00000000-0000-4000-9000-000000000021','prepared',false,'SECRET unpublished draft','SECRET staff note');
INSERT INTO owner_review_properties(review_id,property_id) VALUES('00000000-0000-4000-9000-000000000061','00000000-0000-4000-9000-000000000021');
INSERT INTO owner_time_entries(id,program_id,owner_user_id,phase,entry_date,minutes,activity,review_status,attested,is_demo)
 VALUES('00000000-0000-4000-9000-000000000071','00000000-0000-4000-9000-000000000031','00000000-0000-4000-9000-000000000001','ongoing',current_date,60,'Reviewed work','approved',true,false);
INSERT INTO owner_time_entry_properties(entry_id,property_id) VALUES('00000000-0000-4000-9000-000000000071','00000000-0000-4000-9000-000000000021');
INSERT INTO owner_badges(program_id,code,trigger_rule,supporting) VALUES('00000000-0000-4000-9000-000000000031','first_step','SECRET staff rule','{"private":"SECRET financial"}');
INSERT INTO owner_program_events(program_id,kind,summary,detail) VALUES('00000000-0000-4000-9000-000000000031','program_created','SECRET internal event','{"private":"SECRET guest"}');
INSERT INTO owner_notifications(id,program_id,owner_user_id,kind,priority,title,body,action_path,email_status,ticket_id)
 VALUES('00000000-0000-4000-9000-000000000081','00000000-0000-4000-9000-000000000031','00000000-0000-4000-9000-000000000001','ticket_opened','p3','SECRET guest','SECRET private note','/internal/secret','SECRET error','00000000-0000-4000-9000-000000000041');
INSERT INTO staff_notifications(user_id,title,body) VALUES('00000000-0000-4000-9000-000000000001','SECRET previous staff notification','SECRET guest details'),('00000000-0000-4000-9000-000000000003','Staff notification','Current staff work');
INSERT INTO onboarding_tasks(id,property_id,title,stage,status,requires_owner_approval,is_demo) VALUES('00000000-0000-4000-9000-000000000091','00000000-0000-4000-9000-000000000021','SECRET internal owner-approval task','intake','ready',true,false);
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_scope((SELECT count(*) FROM staff_notifications)=0,'Former staff notification leaked to owner');
UPDATE staff_notifications SET title='FORGED';
SELECT pg_temp.assert_scope((SELECT count(*) FROM onboarding_tasks)=0,'Raw approval task narrative survived');
SELECT pg_temp.assert_scope((SELECT count(*) FROM owner_reviews)=0,'Raw review read survived');
SELECT pg_temp.assert_scope((SELECT count(*) FROM owner_time_entries)=0,'Raw time read survived');
SELECT pg_temp.assert_scope((SELECT count(*) FROM owner_program_properties)=0,'Raw enrollment read survived');
SELECT pg_temp.assert_scope((SELECT count(*) FROM owner_review_properties)=0,'Raw review Property read survived');
SELECT pg_temp.assert_scope((SELECT count(*) FROM owner_time_entry_properties)=0,'Raw time Property read survived');
SELECT pg_temp.assert_scope((SELECT count(*) FROM owner_badges)=0,'Raw badge read survived');
SELECT pg_temp.assert_scope((SELECT count(*) FROM owner_program_events)=0,'Raw event read survived');
SELECT pg_temp.assert_scope((SELECT count(*) FROM owner_notifications)=0,'Raw alert read survived');
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_participation('reviews','00000000-0000-4000-9000-000000000031') WHERE id='00000000-0000-4000-9000-000000000061')=1,'Published own review unavailable');
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_participation('reviews','00000000-0000-4000-9000-000000000031') WHERE id='00000000-0000-4000-9000-000000000062')=0,'Unpublished draft exposed');
SELECT pg_temp.assert_scope(NOT EXISTS(SELECT 1 FROM unnest(ARRAY['reviews','entries','badges','events','alerts']) section CROSS JOIN LATERAL read_owner_participation(section,'00000000-0000-4000-9000-000000000031') r WHERE r.item::text LIKE '%SECRET%'),'Private content exposed through projection');
SELECT pg_temp.assert_scope((SELECT item->'property_ids' FROM read_owner_participation('entries','00000000-0000-4000-9000-000000000031'))='["00000000-0000-4000-9000-000000000021"]'::jsonb,'Entry evidence Property links lost');
SELECT pg_temp.assert_scope(NOT EXISTS(SELECT 1 FROM unnest(ARRAY['reviews','entries','badges','events','alerts']) section CROSS JOIN LATERAL read_owner_participation(section,'00000000-0000-4000-9000-000000000032') r),'Cross-owner record read');
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_participation('entries','00000000-0000-4000-9000-000000000031',true))=0,'Owner preview escalation');
SELECT pg_temp.assert_scope(mark_owner_alerts_read(ARRAY['00000000-0000-4000-9000-000000000081']::uuid[])=1,'Safe read marker failed');
SELECT pg_temp.assert_scope(mark_owner_alerts_read(ARRAY['00000000-0000-4000-9000-000000000081']::uuid[])=0,'Read marker replay changed rows');
SELECT pg_temp.denied_scope($q$INSERT INTO owner_program_events(program_id,kind,summary) VALUES('00000000-0000-4000-9000-000000000031','program_completed','FORGED')$q$,'row-level security');
RESET ROLE;
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_scope((SELECT count(*) FROM onboarding_tasks WHERE id='00000000-0000-4000-9000-000000000091')=1,'Staff task access was lost');
SELECT pg_temp.assert_scope((SELECT count(*) FROM staff_notifications)=1,'Current staff notification unavailable');
UPDATE staff_notifications SET read_at=now();
RESET ROLE;
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000001',true);
SELECT pg_temp.assert_scope(NOT EXISTS(SELECT 1 FROM staff_notifications WHERE title='FORGED'),'Owner altered a former staff notification');
-- A transfer hides current opportunities and alerts without rewriting participation history.
UPDATE properties SET owner_record_id='00000000-0000-4000-9000-000000000012' WHERE id='00000000-0000-4000-9000-000000000021';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_participation('reviews','00000000-0000-4000-9000-000000000031'))=0,'Transferred Property review exposed');
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_participation('alerts','00000000-0000-4000-9000-000000000031'))=0,'Transferred Property alert exposed');
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_participation('entries','00000000-0000-4000-9000-000000000031'))=1,'Retained participation was erased');
SELECT pg_temp.denied_scope($q$SELECT respond_owner_review('00000000-0000-4000-9000-000000000061',(SELECT updated_at FROM owner_reviews WHERE false),'acknowledged','reviewed',NULL)$q$,'scope is no longer available');
RESET ROLE;
UPDATE properties SET owner_record_id='00000000-0000-4000-9000-000000000011' WHERE id='00000000-0000-4000-9000-000000000021';
UPDATE auth.users SET banned_until=now()+interval '1 day' WHERE id='00000000-0000-4000-9000-000000000001';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_scope(NOT EXISTS(SELECT 1 FROM unnest(ARRAY['reviews','entries','badges','events','alerts']) section CROSS JOIN LATERAL read_owner_participation(section,'00000000-0000-4000-9000-000000000031') r),'Banned account retained access');
RESET ROLE;
UPDATE auth.users SET banned_until=NULL WHERE id='00000000-0000-4000-9000-000000000001';
DELETE FROM user_roles WHERE user_id='00000000-0000-4000-9000-000000000001';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_participation('entries','00000000-0000-4000-9000-000000000031'))=0,'Revoked owner retained history');
RESET ROLE;
SELECT pg_temp.assert_scope(NOT has_function_privilege('anon','public.read_owner_participation(text,uuid,boolean,uuid)','EXECUTE'),'Anonymous read grant');
SELECT pg_temp.assert_scope(NOT has_function_privilege('authenticated','private.owner_review_readable(uuid,uuid,boolean)','EXECUTE'),'Private helper grant');

INSERT INTO user_roles(user_id,role) VALUES('00000000-0000-4000-9000-000000000001','owner');
UPDATE owner_programs SET status='active',started_on=current_date,ends_on=current_date+89 WHERE id='00000000-0000-4000-9000-000000000031';
UPDATE auth.users SET deleted_at=now() WHERE id='00000000-0000-4000-9000-000000000001';
SET LOCAL ROLE authenticated;
SELECT pg_temp.denied_scope($q$SELECT log_owner_time_entry('{"programId":"00000000-0000-4000-9000-000000000031","confirmed":true}',ARRAY[]::uuid[])$q$,'enabled account');
SELECT pg_temp.denied_scope($q$SELECT create_owner_matter('00000000-0000-4000-9000-000000000031','00000000-0000-4000-9000-000000000021','inform','Review property work','Owner question','maintenance')$q$,'enabled owner account');
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_participation('entries','00000000-0000-4000-9000-000000000031'))=0,'Deleted account retained history');
RESET ROLE;
UPDATE auth.users SET deleted_at=NULL,banned_until=now()+interval '1 day' WHERE id='00000000-0000-4000-9000-000000000001';
SET LOCAL ROLE authenticated;
SELECT pg_temp.denied_scope($q$SELECT log_owner_time_entry('{"programId":"00000000-0000-4000-9000-000000000031","confirmed":true}',ARRAY[]::uuid[])$q$,'enabled account');
SELECT pg_temp.denied_scope($q$SELECT create_owner_matter('00000000-0000-4000-9000-000000000031','00000000-0000-4000-9000-000000000021','inform','Review property work','Owner question','maintenance')$q$,'enabled owner account');
RESET ROLE;
UPDATE auth.users SET banned_until=NULL WHERE id='00000000-0000-4000-9000-000000000001';
INSERT INTO user_roles(user_id,role) VALUES('00000000-0000-4000-9000-000000000001','vendor');
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_participation('entries','00000000-0000-4000-9000-000000000031'))=0,'Mixed account roles retained owner history');
SELECT pg_temp.denied_scope($q$SELECT create_owner_matter('00000000-0000-4000-9000-000000000031','00000000-0000-4000-9000-000000000021','inform','Review property work','Owner question','maintenance')$q$,'enabled owner account');
RESET ROLE;
DELETE FROM user_roles WHERE user_id='00000000-0000-4000-9000-000000000001' AND role='vendor';
UPDATE owner_programs SET status='completed',completed_at=now() WHERE id='00000000-0000-4000-9000-000000000031';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_participation('entries','00000000-0000-4000-9000-000000000031'))=1,'Completed program history disappeared');
RESET ROLE;
UPDATE owner_programs SET archived_at=now() WHERE id='00000000-0000-4000-9000-000000000031';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_participation('entries','00000000-0000-4000-9000-000000000031'))=0,'Archived program remained readable');
RESET ROLE;
ROLLBACK;
