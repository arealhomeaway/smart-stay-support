-- Cumulative regression after migrations 01-55. All rows are local and rolled back.
BEGIN;
CREATE FUNCTION pg_temp.initial_request_assert(ok boolean,message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF NOT coalesce(ok,false) THEN RAISE EXCEPTION '%',message; END IF; END $$;
CREATE FUNCTION pg_temp.initial_request_denied(statement text,expected text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN BEGIN EXECUTE statement;
 EXCEPTION WHEN OTHERS THEN IF SQLERRM LIKE '%'||expected||'%' THEN RETURN; ELSE RAISE; END IF;
 END; RAISE EXCEPTION 'Expected denial: %',statement;
END $$;
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
 ('00000000-0000-4000-9055-000000000001','owner-a@example.test',now()),
 ('00000000-0000-4000-9055-000000000002','owner-b@example.test',now()),
 ('00000000-0000-4000-9055-000000000003','staff@example.test',now());
INSERT INTO user_roles(user_id,role) VALUES
 ('00000000-0000-4000-9055-000000000001','owner'),
 ('00000000-0000-4000-9055-000000000002','owner'),
 ('00000000-0000-4000-9055-000000000003','admin');
SELECT set_config('test.actor','00000000-0000-4000-9055-000000000003',true);
INSERT INTO property_owners(id,name,active) VALUES('00000000-0000-4000-9055-000000000011','Canonical QA Owner',true);
INSERT INTO properties(id,name,owner_record_id,is_demo,actual_closing_on) VALUES
 ('00000000-0000-4000-9055-000000000021','Synthetic repair property','00000000-0000-4000-9055-000000000011',false,current_date-1);
INSERT INTO owner_programs(id,property_id,owner_record_id,owner_user_id,status,is_demo) VALUES
 ('00000000-0000-4000-9055-000000000031','00000000-0000-4000-9055-000000000021','00000000-0000-4000-9055-000000000011','00000000-0000-4000-9055-000000000001','draft',false);
INSERT INTO owner_program_properties(program_id,property_id,inclusion_status,closing_date,closing_confirmed) VALUES
 ('00000000-0000-4000-9055-000000000031','00000000-0000-4000-9055-000000000021','included',current_date-1,true);
UPDATE owner_programs SET status='active',started_on=current_date-1,ends_on=current_date+88
 WHERE id='00000000-0000-4000-9055-000000000031';
INSERT INTO tickets(id,property_id,title,description,status,is_demo) VALUES
 ('00000000-0000-4000-9055-000000000041','00000000-0000-4000-9055-000000000021','PRIVATE guest name','PRIVATE access code','open',false);

-- Match TicketWorkOrderPanel's ordinary above-$350 creation state: $500 quote,
-- owner authority, pending flag/request timestamp, but no approval exists yet.
INSERT INTO work_orders(id,ticket_id,property_id,title,scope,quote_amount,authority_level,
 approval_status,approval_requested_at,approval_requested_by) VALUES
 ('00000000-0000-4000-9055-000000000051','00000000-0000-4000-9055-000000000041','00000000-0000-4000-9055-000000000021','PRIVATE title','PRIVATE credentials',500,'owner','pending',now(),'00000000-0000-4000-9055-000000000003'),
 ('00000000-0000-4000-9055-000000000052','00000000-0000-4000-9055-000000000041','00000000-0000-4000-9055-000000000021','Already approved','Private scope',500,'owner','approved',now(),'00000000-0000-4000-9055-000000000003'),
 ('00000000-0000-4000-9055-000000000053','00000000-0000-4000-9055-000000000041','00000000-0000-4000-9055-000000000021','Pending canonical conflict','Private scope',500,'owner','pending',now(),'00000000-0000-4000-9055-000000000003'),
 ('00000000-0000-4000-9055-000000000054','00000000-0000-4000-9055-000000000041','00000000-0000-4000-9055-000000000021','Linked prior decision','Private scope',500,'owner','declined',now(),'00000000-0000-4000-9055-000000000003'),
 ('00000000-0000-4000-9055-000000000055','00000000-0000-4000-9055-000000000041','00000000-0000-4000-9055-000000000021','Rollback repair','Private scope',500,'owner','pending',now(),'00000000-0000-4000-9055-000000000003');

-- Owners remain unable to prepare staff approval requests.
SELECT set_config('test.actor','00000000-0000-4000-9055-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.initial_request_denied($q$SELECT prepare_work_order_owner_approval('00000000-0000-4000-9055-000000000051','2026-09-15T00:00:00Z','Please approve this synthetic repair at the quoted amount.')$q$,'do not have access');
RESET ROLE;
SELECT set_config('test.actor','00000000-0000-4000-9055-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT prepare_work_order_owner_approval('00000000-0000-4000-9055-000000000051',updated_at,'Please approve this synthetic repair at the quoted amount.')
 FROM work_orders WHERE id='00000000-0000-4000-9055-000000000051';
RESET ROLE;
SELECT pg_temp.initial_request_assert((SELECT count(*) FROM approvals WHERE entity_type='work_order' AND entity_id='00000000-0000-4000-9055-000000000051')=1,'Initial pending request did not create exactly one canonical approval');
SELECT pg_temp.initial_request_assert((SELECT w.approval_status='pending' AND a.status='pending' AND a.amount=500
 AND a.approver_id='00000000-0000-4000-9055-000000000001' AND a.property_id=w.property_id
 FROM work_orders w JOIN approvals a ON a.id=w.approval_id WHERE w.id='00000000-0000-4000-9055-000000000051'),'Request lost canonical Work Order, Property, recipient or quote');
SELECT pg_temp.initial_request_assert((SELECT count(*) FROM owner_approval_publications WHERE entity_id='00000000-0000-4000-9055-000000000051')=1,'First request was not published exactly once');
SELECT pg_temp.initial_request_assert((SELECT count(*) FROM work_order_events WHERE work_order_id='00000000-0000-4000-9055-000000000051' AND event_type='owner_approval_requested')=1,'Initial request history missing');

-- Retrying with the current version must reject rather than duplicate the request.
SET LOCAL ROLE authenticated;
SELECT pg_temp.initial_request_denied($q$SELECT prepare_work_order_owner_approval(id,updated_at,'Please approve this synthetic repair at the quoted amount.') FROM work_orders WHERE id='00000000-0000-4000-9055-000000000051'$q$,'An owner approval already exists');
RESET ROLE;
SELECT pg_temp.initial_request_assert((SELECT count(*) FROM approvals WHERE entity_id='00000000-0000-4000-9055-000000000051')=1
 AND (SELECT count(*) FROM owner_approval_publications WHERE entity_id='00000000-0000-4000-9055-000000000051')=1
 AND (SELECT count(*) FROM work_order_events WHERE work_order_id='00000000-0000-4000-9055-000000000051')=1,'Retry duplicated request, publication or history');

-- The eligible owner sees only the reviewed summary and canonical amount.
SELECT set_config('test.actor','00000000-0000-4000-9055-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.initial_request_assert((SELECT count(*) FROM approvals)=0,'Raw staff approval rows exposed');
SELECT pg_temp.initial_request_assert((SELECT approval->>'can_respond'='true' AND approval->>'amount'='500'
 AND approval->>'detail'='Please approve this synthetic repair at the quoted amount.' AND approval::text NOT LIKE '%PRIVATE%'
 FROM read_owner_approvals()),'Initial request is not actionable or exposed staff-only context');
RESET ROLE;
SELECT set_config('test.actor','00000000-0000-4000-9055-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT pg_temp.initial_request_assert((SELECT count(*) FROM read_owner_approvals())=0,'Unrelated owner can read the request');
RESET ROLE;
SELECT set_config('test.actor','00000000-0000-4000-9055-000000000003',true);

-- Pending canonical requests and every existing approval_id remain conflicts,
-- including an already-decided link; an approved state cannot be re-requested.
INSERT INTO approvals(id,entity_type,entity_id,property_id,kind,title,detail,amount,requested_by,approver_role,approver_id,status,is_demo) VALUES
 ('00000000-0000-4000-9055-000000000061','work_order','00000000-0000-4000-9055-000000000053','00000000-0000-4000-9055-000000000021','maintenance_owner_approval','Existing pending decision','Previously prepared owner request',500,'00000000-0000-4000-9055-000000000003','owner','00000000-0000-4000-9055-000000000001','pending',false),
 ('00000000-0000-4000-9055-000000000062','work_order','00000000-0000-4000-9055-000000000054','00000000-0000-4000-9055-000000000021','maintenance_owner_approval','Existing declined decision','Previously prepared owner request',500,'00000000-0000-4000-9055-000000000003','owner','00000000-0000-4000-9055-000000000001','declined',false);
UPDATE work_orders SET approval_id='00000000-0000-4000-9055-000000000062' WHERE id='00000000-0000-4000-9055-000000000054';
SET LOCAL ROLE authenticated;
SELECT pg_temp.initial_request_denied(format('SELECT prepare_work_order_owner_approval(%L,%L,%L)',id,updated_at,
 'Please approve this synthetic repair at the quoted amount.'),'An owner approval already exists')
 FROM work_orders WHERE id IN('00000000-0000-4000-9055-000000000052','00000000-0000-4000-9055-000000000053','00000000-0000-4000-9055-000000000054');
SELECT pg_temp.initial_request_denied($q$SELECT prepare_work_order_owner_approval('00000000-0000-4000-9055-000000000055','2026-09-14T00:00:00Z','Please approve this synthetic repair at the quoted amount.')$q$,'Work Order changed');
RESET ROLE;
SELECT pg_temp.initial_request_assert((SELECT count(*) FROM approvals)=3
 AND (SELECT count(*) FROM owner_approval_publications)=1,'Conflicting or stale calls wrote a request');

-- Publication/audit failure still rolls back the newly linked request and event.
CREATE FUNCTION pg_temp.fail_initial_publication() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced initial publication failure'; END $$;
CREATE TRIGGER fail_initial_publication BEFORE INSERT ON audit_log FOR EACH ROW EXECUTE FUNCTION pg_temp.fail_initial_publication();
SET LOCAL ROLE authenticated;
SELECT pg_temp.initial_request_denied($q$SELECT prepare_work_order_owner_approval(id,updated_at,'Please approve this synthetic repair at the quoted amount.') FROM work_orders WHERE id='00000000-0000-4000-9055-000000000055'$q$,'forced initial publication failure');
RESET ROLE;
SELECT pg_temp.initial_request_assert((SELECT approval_id IS NULL AND approval_status='pending' FROM work_orders WHERE id='00000000-0000-4000-9055-000000000055')
 AND NOT EXISTS(SELECT 1 FROM approvals WHERE entity_id='00000000-0000-4000-9055-000000000055')
 AND NOT EXISTS(SELECT 1 FROM owner_approval_publications WHERE entity_id='00000000-0000-4000-9055-000000000055')
 AND NOT EXISTS(SELECT 1 FROM work_order_events WHERE work_order_id='00000000-0000-4000-9055-000000000055'),'Publication failure left a partial initial request');
SELECT pg_temp.initial_request_assert(NOT has_function_privilege('anon','public.prepare_work_order_owner_approval(uuid,timestamptz,text)','EXECUTE')
 AND has_function_privilege('authenticated','public.prepare_work_order_owner_approval(uuid,timestamptz,text)','EXECUTE')
 AND NOT (SELECT prosecdef FROM pg_proc WHERE oid='public.prepare_work_order_owner_approval(uuid,timestamptz,text)'::regprocedure),'Request RPC permissions changed');
ROLLBACK;
