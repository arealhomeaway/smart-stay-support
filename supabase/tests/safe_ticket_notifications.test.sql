BEGIN;
CREATE TRIGGER tickets_notify_owner AFTER INSERT OR UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION notify_owner_of_ticket();
INSERT INTO property_owners(id) VALUES('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
INSERT INTO properties(id,owner_record_id,is_demo) VALUES
 ('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',false),
 ('44444444-4444-4444-8444-444444444444','11111111-1111-4111-8111-111111111111',false);
INSERT INTO owner_programs(id,property_id,owner_record_id,status,is_demo,notify_email,notify_sms_p1) VALUES
 ('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','active',false,true,true);
INSERT INTO owner_program_properties(program_id,property_id,inclusion_status) VALUES
 ('55555555-5555-4555-8555-555555555555','44444444-4444-4444-8444-444444444444','included');
INSERT INTO tickets(id,property_id,title,description,resolution_notes,status,priority) VALUES
 ('66666666-6666-4666-8666-666666666666','44444444-4444-4444-8444-444444444444','PRIVATE guest','PRIVATE credential','PRIVATE note','open','p1');
DO $$ BEGIN
 IF (SELECT count(*) FROM owner_notifications)<>1 THEN RAISE EXCEPTION 'secondary property alert missing'; END IF;
 IF EXISTS(SELECT 1 FROM owner_notifications WHERE title LIKE '%PRIVATE%' OR body LIKE '%PRIVATE%' OR email_status<>'pending' OR sms_status<>'pending') THEN RAISE EXCEPTION 'unsafe alert or lost preferences'; END IF;
END $$;
UPDATE tickets SET description='PRIVATE changed' WHERE id='66666666-6666-4666-8666-666666666666';
UPDATE tickets SET status='resolved' WHERE id='66666666-6666-4666-8666-666666666666';
DO $$ BEGIN
 IF (SELECT count(*) FROM owner_notifications)<>2 THEN RAISE EXCEPTION 'incorrect stage notification count'; END IF;
 IF NOT EXISTS(SELECT 1 FROM owner_notifications WHERE kind='ticket_resolved' AND title='Property work marked resolved') THEN RAISE EXCEPTION 'resolution context missing'; END IF;
END $$;
UPDATE properties SET owner_record_id='22222222-2222-4222-8222-222222222222' WHERE id='44444444-4444-4444-8444-444444444444';
INSERT INTO tickets(id,property_id,status,priority) VALUES(gen_random_uuid(),'44444444-4444-4444-8444-444444444444','open','p1');
INSERT INTO tickets(id,property_id,status,priority) VALUES(gen_random_uuid(),'33333333-3333-4333-8333-333333333333','open','p1');
UPDATE properties SET owner_record_id='11111111-1111-4111-8111-111111111111' WHERE id='44444444-4444-4444-8444-444444444444';
INSERT INTO tickets(id,property_id,status,priority,is_demo) VALUES(gen_random_uuid(),'44444444-4444-4444-8444-444444444444','open','p1',true);
UPDATE owner_program_properties SET inclusion_status='removed';
INSERT INTO tickets(id,property_id,status,priority) VALUES(gen_random_uuid(),'44444444-4444-4444-8444-444444444444','open','p1');
DO $$ BEGIN
 IF (SELECT count(*) FROM owner_notifications)<>2 THEN RAISE EXCEPTION 'ownership, demo or enrollment boundary leaked'; END IF;
 IF has_function_privilege('authenticated','public.notify_owner_of_ticket()','EXECUTE') THEN RAISE EXCEPTION 'trigger became callable'; END IF;
END $$;
CREATE TRIGGER owner_reviews_notify_owner AFTER INSERT OR UPDATE ON owner_reviews FOR EACH ROW EXECUTE FUNCTION notify_owner_of_review();
UPDATE owner_program_properties SET inclusion_status='included';
INSERT INTO owner_reviews(id,program_id,property_id,ticket_id,status,title,recommendation,impact) VALUES(
 '77777777-7777-4777-8777-777777777777','55555555-5555-4555-8555-555555555555','44444444-4444-4444-8444-444444444444',
 '66666666-6666-4666-8666-666666666666','awaiting_owner','PRIVATE title','PRIVATE recommendation','PRIVATE impact');
UPDATE owner_reviews SET recommendation='PRIVATE updated';
DO $$ BEGIN
 IF (SELECT count(*) FROM owner_notifications)<>3 THEN RAISE EXCEPTION 'review alert missing or duplicated'; END IF;
 IF EXISTS(SELECT 1 FROM owner_notifications WHERE title LIKE '%PRIVATE%' OR body LIKE '%PRIVATE%') THEN RAISE EXCEPTION 'review internal text leaked'; END IF;
 IF has_function_privilege('authenticated','public.notify_owner_of_review()','EXECUTE') THEN RAISE EXCEPTION 'review trigger became callable'; END IF;
END $$;
INSERT INTO owner_reviews(id,program_id,property_id,ticket_id,status) VALUES(gen_random_uuid(),
 '55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','66666666-6666-4666-8666-666666666666','awaiting_owner');
DO $$ BEGIN
 IF (SELECT count(*) FROM owner_notifications)<>3 THEN RAISE EXCEPTION 'mismatched review property leaked'; END IF;
END $$;
ROLLBACK;
