BEGIN;
INSERT INTO auth.users(id) VALUES('88888888-8888-4888-8888-888888888888'),('99999999-9999-4999-8999-999999999999'),('77777777-7777-4777-8777-777777777777');
INSERT INTO user_roles(user_id,role) VALUES('88888888-8888-4888-8888-888888888888','owner'),('99999999-9999-4999-8999-999999999999','manager'),('77777777-7777-4777-8777-777777777777','admin');
SELECT set_config('test.actor','88888888-8888-4888-8888-888888888888',true);
SELECT set_config('test.staff','true',true);
INSERT INTO property_owners(id) VALUES('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
INSERT INTO properties(id,owner_record_id,is_demo) VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',false);
INSERT INTO owner_programs(id,property_id,owner_record_id,owner_user_id,status,started_on,is_demo) VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','88888888-8888-4888-8888-888888888888','draft',NULL,false);
INSERT INTO owner_program_properties(program_id,property_id,inclusion_status,closing_date,closing_confirmed,is_demo) VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','included',current_date-5,true,false);
UPDATE owner_programs SET status='active',started_on=current_date-5,ends_on=current_date+84 WHERE id='55555555-5555-4555-8555-555555555555';
INSERT INTO tickets(id,property_id,title,description,status,is_demo) VALUES('66666666-6666-4666-8666-666666666666','33333333-3333-4333-8333-333333333333','PRIVATE guest','PRIVATE credential','open',false);
INSERT INTO approvals(id,entity_type,entity_id,property_id,approver_role,status,amount,is_demo,title,detail)
 VALUES('22222222-2222-4222-8222-222222222223','work_order','77777777-7777-4777-8777-777777777778','33333333-3333-4333-8333-333333333333','owner','pending',650,false,'PRIVATE title','PRIVATE approval');
INSERT INTO work_orders(id,ticket_id,property_id,title,scope,quote_amount,approval_id,approval_status)
 VALUES('77777777-7777-4777-8777-777777777778','66666666-6666-4666-8666-666666666666','33333333-3333-4333-8333-333333333333','PRIVATE title','PRIVATE code',650,'22222222-2222-4222-8222-222222222223','pending');
-- Simulate a historical revision; 48 deliberately leaves both new fields NULL.
INSERT INTO ticket_owner_updates(ticket_id,property_id,owner_record_id,revision,issue,work_performed,outcome,reviewed_by,source_updated_at,is_demo)
 VALUES('66666666-6666-4666-8666-666666666666','33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',1,'Original issue.','Original work.','Original outcome.','99999999-9999-4999-8999-999999999999','2026-09-15',false);
CREATE FUNCTION intent_save(_type text,_why text,_expected integer DEFAULT NULL) RETURNS uuid LANGUAGE sql AS $$
 SELECT save_ticket_owner_update('66666666-6666-4666-8666-666666666666','99999999-9999-4999-8999-999999999999','2026-09-15T00:00:00Z',coalesce(_expected,(SELECT max(revision) FROM ticket_owner_updates)),'11111111-1111-4111-8111-111111111111','A reviewed property issue.','Staff checked the property work.','Owner participation is welcome.',true,_type,_why)
$$;
CREATE FUNCTION expect_intent_failure(_sql text,_message text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE before_updates integer; before_events integer; before_entries integer;
BEGIN
 SELECT count(*) INTO before_updates FROM ticket_owner_updates;
 SELECT count(*) INTO before_events FROM owner_program_events;
 SELECT count(*) INTO before_entries FROM owner_time_entries;
 BEGIN EXECUTE _sql; RAISE EXCEPTION 'Expected rejection but operation succeeded';
 EXCEPTION WHEN OTHERS THEN IF SQLERRM NOT LIKE _message THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM ticket_owner_updates)<>before_updates OR (SELECT count(*) FROM owner_program_events)<>before_events OR (SELECT count(*) FROM owner_time_entries)<>before_entries THEN RAISE EXCEPTION 'Rejected request left partial writes'; END IF;
END $$;
SELECT expect_intent_failure($q$SELECT intent_save('approve_only','Pretend this approves work.')$q$,'Choose the owner request%');
SELECT expect_intent_failure($q$SELECT intent_save(NULL,'Missing request category.')$q$,'Choose the owner request%');
SELECT expect_intent_failure($q$SELECT intent_save('research_recommend',NULL)$q$,'Choose the owner request%');
SELECT expect_intent_failure($q$SELECT intent_save('review_comment','short')$q$,'Choose the owner request%');
SELECT expect_intent_failure($q$SELECT intent_save('review_comment',repeat('x',1001))$q$,'Choose the owner request%');
CREATE FUNCTION fail_intent_publication() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced request publication failure'; END $$;
CREATE TRIGGER fail_intent_publication BEFORE INSERT ON ticket_owner_updates FOR EACH ROW EXECUTE FUNCTION fail_intent_publication();
SELECT expect_intent_failure($q$SELECT intent_save('review_comment','A rejected publication must not alter the current request.')$q$,'forced request publication failure');
DROP TRIGGER fail_intent_publication ON ticket_owner_updates;
SET LOCAL ROLE service_role;
DO $$ DECLARE request_type text; revision_id uuid; BEGIN
 FOREACH request_type IN ARRAY ARRAY['review_comment','review_decide','provide_information','attend_respond','action_payment','information_only','research_recommend'] LOOP
  revision_id:=intent_save(request_type,'Reviewed explanation for '||request_type||'.');
  IF NOT EXISTS(SELECT 1 FROM ticket_owner_updates WHERE id=revision_id AND owner_request_type=request_type AND owner_request_why='Reviewed explanation for '||request_type||'.') THEN RAISE EXCEPTION 'request not retained'; END IF;
 END LOOP;
END $$;
RESET ROLE;
SELECT expect_intent_failure($q$SELECT intent_save('information_only','Stale draft must not overwrite the request.',1)$q$,'Another owner update%');
SELECT expect_intent_failure($q$UPDATE ticket_owner_updates SET owner_request_type='information_only',owner_request_why='Rewrite old reviewed instructions.'$q$,'Reviewed Ticket updates are immutable%');
SELECT expect_intent_failure($q$DELETE FROM ticket_owner_updates$q$,'Reviewed Ticket updates are immutable%');
DO $$ BEGIN
 IF to_regprocedure('public.save_ticket_owner_update(uuid,uuid,timestamptz,integer,uuid,text,text,text,boolean)') IS NOT NULL THEN RAISE EXCEPTION 'old writer can omit request'; END IF;
 IF has_function_privilege('authenticated','save_ticket_owner_update(uuid,uuid,timestamptz,integer,uuid,text,text,text,boolean,text,text)','EXECUTE') OR has_function_privilege('anon','save_ticket_owner_update(uuid,uuid,timestamptz,integer,uuid,text,text,text,boolean,text,text)','EXECUTE') THEN RAISE EXCEPTION 'owner can forge publication'; END IF;
 IF (SELECT count(*) FROM owner_reviews WHERE ticket_id='66666666-6666-4666-8666-666666666666')<>1 THEN RAISE EXCEPTION 'publication duplicated opportunity'; END IF;
END $$;
SELECT set_config('test.staff','false',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r owner_reviews; e uuid; snapshot jsonb; BEGIN
 SELECT * INTO r FROM owner_reviews WHERE ticket_id='66666666-6666-4666-8666-666666666666';
 snapshot:=read_owner_review_update(r.id,1);
 IF snapshot->>'revision'<>'1' OR snapshot->>'owner_request_type' IS NOT NULL OR snapshot->>'owner_request_why' IS NOT NULL THEN RAISE EXCEPTION 'legacy request invented'; END IF;
 snapshot:=read_owner_review_update(r.id,6);
 IF snapshot->>'owner_request_type'<>'action_payment' OR snapshot->>'owner_request_why'<>'Reviewed explanation for action_payment.' THEN RAISE EXCEPTION 'exact request revision missing'; END IF;
 PERFORM respond_owner_review(r.id,r.updated_at,'acknowledged','I report completing the action; please verify.',6);
 IF NOT EXISTS(SELECT 1 FROM owner_program_events WHERE review_id=r.id AND detail->'ownerUpdate'->>'owner_request_type'='action_payment' AND detail->'ownerUpdate'->>'owner_request_why'='Reviewed explanation for action_payment.') THEN RAISE EXCEPTION 'response request history missing'; END IF;
 IF NOT EXISTS(SELECT 1 FROM owner_reviews WHERE id=r.id AND status='awaiting_owner') THEN RAISE EXCEPTION 'action report certified fulfillment'; END IF;
 e:=log_owner_time_entry(jsonb_build_object('programId',r.program_id,'reviewId',r.id,'ticketId',r.ticket_id,'phase',r.phase,'entryDate',current_date,'minutes',15,'activity','Reviewed the requested action','confirmed',true,'ownerUpdateRevision',6,'owner_request_type','FORGED','owner_request_why','FORGED'),ARRAY[r.property_id]);
 IF NOT EXISTS(SELECT 1 FROM owner_time_entries WHERE id=e AND owner_update_snapshot->>'owner_request_type'='action_payment' AND owner_update_snapshot->>'owner_request_why'='Reviewed explanation for action_payment.') THEN RAISE EXCEPTION 'time request history missing'; END IF;
 IF EXISTS(SELECT 1 FROM owner_time_entries WHERE owner_update_snapshot::text LIKE '%FORGED%' OR owner_update_snapshot::text LIKE '%PRIVATE%') THEN RAISE EXCEPTION 'unreviewed request text copied'; END IF;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM work_orders WHERE id='77777777-7777-4777-8777-777777777778' AND approval_status='pending' AND approved_amount IS NULL AND final_cost IS NULL AND closed_at IS NULL)
  OR NOT EXISTS(SELECT 1 FROM approvals WHERE id='22222222-2222-4222-8222-222222222223' AND status='pending') THEN RAISE EXCEPTION 'participation response certified work or financial approval'; END IF;
END $$;
SELECT intent_save('information_only','Staff verified the response. No further owner action remains.');
SET LOCAL ROLE authenticated;
DO $$ DECLARE payload jsonb; BEGIN
 SELECT to_jsonb(u) INTO payload FROM read_owner_ticket_updates('55555555-5555-4555-8555-555555555555',ARRAY['33333333-3333-4333-8333-333333333333'::uuid],false) u;
 IF payload->>'revision'<>'9' OR payload->>'owner_request_type'<>'information_only' THEN RAISE EXCEPTION 'current request was not resolved by new reviewed revision'; END IF;
 IF payload::text LIKE '%PRIVATE%' THEN RAISE EXCEPTION 'private Ticket text leaked'; END IF;
 IF NOT EXISTS(SELECT 1 FROM owner_program_events WHERE kind='owner_participation_response' AND detail->'ownerUpdate'->>'owner_request_type'='action_payment') THEN RAISE EXCEPTION 'later publication rewrote response history'; END IF;
END $$;
RESET ROLE;
-- Corrections preserve the original request even after current enrollment is removed.
UPDATE owner_program_properties SET inclusion_status='removed' WHERE program_id='55555555-5555-4555-8555-555555555555';
DO $$ DECLARE source owner_time_entries; revised uuid; BEGIN
 SELECT * INTO source FROM owner_time_entries WHERE program_id='55555555-5555-4555-8555-555555555555';
 revised:=correct_owner_time_entry(source.id,'99999999-9999-4999-8999-999999999999',12,'Corrected the reported duration.');
 IF NOT EXISTS(SELECT 1 FROM owner_time_entries WHERE id=revised AND owner_update_snapshot=source.owner_update_snapshot AND owner_update_revision=6) THEN RAISE EXCEPTION 'correction changed request revision'; END IF;
END $$;
-- Current request access is revoked independently of historical receipts.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM read_owner_ticket_updates('55555555-5555-4555-8555-555555555555',ARRAY['33333333-3333-4333-8333-333333333333'::uuid],false)) THEN RAISE EXCEPTION 'removed property read request'; END IF;
END $$;
SELECT set_config('test.actor','77777777-7777-4777-8777-777777777777',true);
UPDATE owner_program_properties SET inclusion_status='included' WHERE program_id='55555555-5555-4555-8555-555555555555';
SELECT set_config('test.actor','88888888-8888-4888-8888-888888888888',true);
DO $$ DECLARE variant integer; BEGIN
 FOR variant IN 1..11 LOOP
  BEGIN
   CASE variant
    WHEN 1 THEN DELETE FROM user_roles WHERE user_id='88888888-8888-4888-8888-888888888888';
    WHEN 2 THEN INSERT INTO user_roles(user_id,role) VALUES('88888888-8888-4888-8888-888888888888','vendor');
    WHEN 3 THEN UPDATE auth.users SET banned_until=now()+interval '1 day' WHERE id='88888888-8888-4888-8888-888888888888';
    WHEN 4 THEN UPDATE properties SET owner_record_id='22222222-2222-4222-8222-222222222222' WHERE id='33333333-3333-4333-8333-333333333333';
    WHEN 5 THEN UPDATE owner_program_properties SET archived_at=now() WHERE program_id='55555555-5555-4555-8555-555555555555';
    WHEN 6 THEN UPDATE properties SET archived_at=now() WHERE id='33333333-3333-4333-8333-333333333333';
    WHEN 7 THEN UPDATE owner_programs SET is_demo=true WHERE id='55555555-5555-4555-8555-555555555555';
    WHEN 8 THEN UPDATE owner_programs SET archived_at=now() WHERE id='55555555-5555-4555-8555-555555555555';
    WHEN 9 THEN PERFORM set_config('test.actor','99999999-9999-4999-8999-999999999999',true);
    WHEN 10 THEN UPDATE property_owners SET active=false WHERE id='11111111-1111-4111-8111-111111111111';
    WHEN 11 THEN UPDATE auth.users SET deleted_at=now() WHERE id='88888888-8888-4888-8888-888888888888';
   END CASE;
   IF EXISTS(SELECT 1 FROM read_owner_ticket_updates('55555555-5555-4555-8555-555555555555',ARRAY['33333333-3333-4333-8333-333333333333'::uuid],false)) THEN RAISE EXCEPTION 'unsafe current request visibility %',variant; END IF;
   PERFORM expect_intent_failure($q$SELECT read_owner_review_update((SELECT id FROM owner_reviews WHERE ticket_id='66666666-6666-4666-8666-666666666666'),6)$q$,CASE WHEN variant IN(4,5,6) THEN 'The Ticket Property%' ELSE 'This reviewed opportunity is not available.' END);
   RAISE EXCEPTION 'restore variant';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'restore variant' THEN RAISE; END IF; END;
 END LOOP;
END $$;
ROLLBACK;
