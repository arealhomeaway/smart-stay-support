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
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_scope((SELECT count(*) FROM owner_programs)=0,'Owner raw Program read survived');
SELECT pg_temp.assert_scope((SELECT count(*) FROM properties)=0,'Owner raw Property read survived');
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_programs())=1,'Owner program discovery incomplete');
SELECT pg_temp.assert_scope((SELECT program->>'owner_name'='Canonical Owner' AND program->>'owner_email'='canonical@example.test' AND NOT(program ? 'internal_notes') AND NOT(program ? 'completion_report') AND program::text NOT LIKE '%SECRET%' FROM read_owner_programs()),'Program projection leaked private or secondary identity');
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_programs('00000000-0000-4000-9000-000000000032'))=0,'Other program read');
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_programs(NULL,true))=0,'Owner preview escalation');
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_programs(NULL,false,'00000000-0000-4000-9000-000000000002'))=0,'Owner actor forgery');
SELECT pg_temp.assert_scope(owner_property_access('00000000-0000-4000-9000-000000000021'),'Own current Property denied');
SELECT pg_temp.assert_scope(NOT owner_property_access('00000000-0000-4000-9000-000000000022'),'Foreign Property allowed');
SELECT pg_temp.assert_scope(NOT owner_property_access('00000000-0000-4000-9000-000000000022','00000000-0000-4000-9000-000000000002'),'Property actor forgery');
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_properties(ARRAY['00000000-0000-4000-9000-000000000021','00000000-0000-4000-9000-000000000022']::uuid[]))=1,'Property scope leaked');
SELECT pg_temp.assert_scope((SELECT property->>'name'='Owner Home' AND property->>'address_line1'='1 Owner Lane' AND NOT(property ? 'private_access_note') AND property::text NOT LIKE '%SECRET%' FROM read_owner_properties(ARRAY['00000000-0000-4000-9000-000000000021']::uuid[])),'Unsafe Property columns');
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_properties(array_fill('00000000-0000-4000-9000-000000000021'::uuid,ARRAY[101])))=0,'Unbounded Property filter');
SELECT pg_temp.assert_scope((SELECT enrollment->>'current_access'='true' AND enrollment->'properties'->>'name'='Owner Home' FROM read_owner_program_properties('00000000-0000-4000-9000-000000000031')),'Current enrollment projection lost context');
SELECT pg_temp.assert_scope((SELECT final_cost=125 AND quote_amount=150 AND to_jsonb(r)::text NOT LIKE '%SECRET%' FROM read_owner_ticket_financial_context('00000000-0000-4000-9000-000000000031',ARRAY['00000000-0000-4000-9000-000000000021']::uuid[]) r),'Canonical safe actual cost unavailable');
SELECT pg_temp.assert_scope(save_owner_alert_preferences(false,false,true,'12345')='00000000-0000-4000-9000-000000000031','Preferences receipt wrong');
SELECT pg_temp.denied_scope($q$SELECT save_owner_alert_preferences(NULL,true,true,'')$q$,'valid notification preferences');
SELECT pg_temp.denied_scope($q$SELECT save_owner_alert_preferences(true,true,true,repeat('x',33))$q$,'valid notification preferences');
RESET ROLE;
SELECT pg_temp.assert_scope((SELECT notify_email=false AND notify_sms_p1=false AND notify_push=true AND owner_phone='12345' AND internal_notes='SECRET private notes' AND status='draft' AND completion_report->>'private'='SECRET report' FROM owner_programs WHERE id='00000000-0000-4000-9000-000000000031'),'Preferences modified unrelated fields');
-- Mixed/demo rows never enter the real owner's current Property projection.
RESET ROLE;
UPDATE properties SET is_demo=true WHERE id='00000000-0000-4000-9000-000000000021';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_scope(NOT owner_property_access('00000000-0000-4000-9000-000000000021'),'Demo Property leaked into real owner scope');
SELECT pg_temp.assert_scope((SELECT enrollment->'properties'='null'::jsonb FROM read_owner_program_properties('00000000-0000-4000-9000-000000000031')),'Demo home facts leaked through retained enrollment');
RESET ROLE;
UPDATE properties SET is_demo=false WHERE id='00000000-0000-4000-9000-000000000021';
SELECT pg_temp.denied_scope($q$UPDATE owner_program_properties SET is_demo=true WHERE program_id='00000000-0000-4000-9000-000000000031'$q$,'same canonical Owner and demo mode');
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_scope(owner_property_access('00000000-0000-4000-9000-000000000021'),'Rejected mixed-mode enrollment changed legitimate current access');
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_program_properties('00000000-0000-4000-9000-000000000031'))=1,'Rejected mixed-mode enrollment changed retained history');
RESET ROLE;
UPDATE owner_program_properties SET is_demo=false WHERE program_id='00000000-0000-4000-9000-000000000031';
UPDATE owner_programs SET is_demo=true WHERE id='00000000-0000-4000-9000-000000000031';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_programs())=0,'Demo Program leaked into real owner mode');
RESET ROLE;
UPDATE owner_programs SET is_demo=false WHERE id='00000000-0000-4000-9000-000000000031';
SET LOCAL ROLE authenticated;
-- No owner policy permits raw mutation; the preference endpoint remains narrow.
WITH changed AS (UPDATE owner_programs SET internal_notes='UNAUTHORIZED' WHERE id='00000000-0000-4000-9000-000000000031' RETURNING id)
SELECT pg_temp.assert_scope((SELECT count(*) FROM changed)=0,'Owner raw Program UPDATE survived');
WITH changed AS (UPDATE properties SET name='UNAUTHORIZED' WHERE id='00000000-0000-4000-9000-000000000021' RETURNING id)
SELECT pg_temp.assert_scope((SELECT count(*) FROM changed)=0,'Owner raw Property UPDATE survived');
RESET ROLE;
-- Revocation and conflicting roles are enforced by both the projections and Ticket helper.
DELETE FROM user_roles WHERE user_id='00000000-0000-4000-9000-000000000001';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_programs())=0,'Revoked role retained Program');
SELECT pg_temp.assert_scope(NOT owner_property_access('00000000-0000-4000-9000-000000000021'),'Revoked role retained Property');
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_tickets('00000000-0000-4000-9000-000000000031',ARRAY['00000000-0000-4000-9000-000000000021']::uuid[]))=0,'Revoked role retained Ticket');
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_ticket_financial_context('00000000-0000-4000-9000-000000000031',ARRAY['00000000-0000-4000-9000-000000000021']::uuid[]))=0,'Revoked role retained authority or actual costs');
SELECT pg_temp.denied_scope($q$SELECT save_owner_alert_preferences(true,true,true,'')$q$,'One current participation program');
RESET ROLE;
INSERT INTO user_roles(user_id,role) VALUES('00000000-0000-4000-9000-000000000001','owner'),('00000000-0000-4000-9000-000000000001','vendor');
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_programs())=0,'Mixed role retained owner mode');
RESET ROLE;
DELETE FROM user_roles WHERE user_id='00000000-0000-4000-9000-000000000001' AND role='vendor';
UPDATE auth.users SET banned_until=now()+interval '1 day' WHERE id='00000000-0000-4000-9000-000000000001';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_scope(NOT owner_property_access('00000000-0000-4000-9000-000000000021'),'Banned account retained Property');
RESET ROLE;
UPDATE auth.users SET banned_until=NULL,deleted_at=now() WHERE id='00000000-0000-4000-9000-000000000001';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_programs())=0,'Deleted account retained Program');
RESET ROLE;
UPDATE auth.users SET deleted_at=NULL WHERE id='00000000-0000-4000-9000-000000000001';
UPDATE property_owners SET active=false WHERE id='00000000-0000-4000-9000-000000000011';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_programs())=0,'Inactive canonical Owner retained Program');
RESET ROLE;
UPDATE property_owners SET active=true WHERE id='00000000-0000-4000-9000-000000000011';
-- Ending enrollment preserves its history row but reveals no current home facts.
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000003',true);
UPDATE owner_program_properties SET inclusion_status='excluded' WHERE program_id='00000000-0000-4000-9000-000000000031';
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_programs())=1,'Excluded home removed entire retained program');
SELECT pg_temp.assert_scope((SELECT enrollment->>'current_access'='false' AND enrollment->'properties'='null'::jsonb AND enrollment->>'property_id'='00000000-0000-4000-9000-000000000021' FROM read_owner_program_properties('00000000-0000-4000-9000-000000000031')),'Historical enrollment erased or current data leaked');
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_properties(ARRAY['00000000-0000-4000-9000-000000000021']::uuid[]))=0,'Excluded Property facts leaked');
RESET ROLE;
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000003',true);
UPDATE owner_program_properties SET inclusion_status='included' WHERE program_id='00000000-0000-4000-9000-000000000031';
UPDATE properties SET owner_record_id='00000000-0000-4000-9000-000000000012' WHERE id='00000000-0000-4000-9000-000000000021';
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_scope(NOT owner_property_access('00000000-0000-4000-9000-000000000021'),'Transferred Property retained access');
SELECT pg_temp.assert_scope((SELECT enrollment->'properties'='null'::jsonb FROM read_owner_program_properties('00000000-0000-4000-9000-000000000031')),'Transferred home facts leaked through history');
RESET ROLE;
UPDATE properties SET owner_record_id='00000000-0000-4000-9000-000000000011',archived_at=now() WHERE id='00000000-0000-4000-9000-000000000021';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_scope(NOT owner_property_access('00000000-0000-4000-9000-000000000021'),'Archived Property retained access');
RESET ROLE;
UPDATE properties SET archived_at=NULL WHERE id='00000000-0000-4000-9000-000000000021';
UPDATE owner_program_properties SET archived_at=now() WHERE program_id='00000000-0000-4000-9000-000000000031';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_scope(NOT owner_property_access('00000000-0000-4000-9000-000000000021'),'Archived enrollment retained access');
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_ticket_financial_context('00000000-0000-4000-9000-000000000031',ARRAY['00000000-0000-4000-9000-000000000021']::uuid[]))=0,'Archived enrollment retained authority or actual costs');
RESET ROLE;
UPDATE owner_program_properties SET archived_at=NULL WHERE program_id='00000000-0000-4000-9000-000000000031';
UPDATE owner_programs SET archived_at=now() WHERE id='00000000-0000-4000-9000-000000000031';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_programs())=0,'Archived program retained current access');
RESET ROLE;
UPDATE owner_programs SET archived_at=NULL,status='completed' WHERE id='00000000-0000-4000-9000-000000000031';
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_programs())=1,'Completed program history inaccessible');
RESET ROLE;
-- Elevated server checks may name a verified actor; ordinary owners may not.
SELECT set_config('test.actor','',true);
SET LOCAL ROLE service_role;
SELECT pg_temp.assert_scope(owner_property_access('00000000-0000-4000-9000-000000000021','00000000-0000-4000-9000-000000000001'),'Verified service actor unavailable');
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_programs(NULL,false,'00000000-0000-4000-9000-000000000001'))=1,'Service owner-safe discovery unavailable');
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_programs())=0,'Credential-only service read guessed an actor');
RESET ROLE;
-- Staff keep legitimate internal reads; explicit admin preview is separate.
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_scope((SELECT internal_notes='SECRET private notes' FROM owner_programs WHERE id='00000000-0000-4000-9000-000000000031'),'Staff internal Program read regressed');
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_programs('00000000-0000-4000-9000-000000000031',true))=1,'Admin safe preview unavailable');
SELECT pg_temp.assert_scope((SELECT count(*) FROM read_owner_programs())=0,'Admin silently entered owner mode');
RESET ROLE;
SELECT set_config('test.actor','00000000-0000-4000-9000-000000000004',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.assert_scope((SELECT count(*) FROM properties WHERE id='00000000-0000-4000-9000-000000000021')=1,'Real assigned vendor Property read regressed');
RESET ROLE;
SELECT pg_temp.assert_scope(NOT has_function_privilege('anon','public.read_owner_programs(uuid,boolean,uuid)','EXECUTE'),'Anonymous program execution grant');
SELECT pg_temp.assert_scope(NOT has_function_privilege('authenticated','private.owner_program_readable(uuid,uuid,boolean)','EXECUTE'),'Private reader helper exposed');
ROLLBACK;
