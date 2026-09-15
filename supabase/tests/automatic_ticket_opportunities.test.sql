BEGIN;
INSERT INTO property_owners(id) VALUES('11111111-1111-4111-8111-111111111111');
INSERT INTO properties(id,owner_record_id,is_demo) VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',false);
INSERT INTO owner_programs(id,property_id,owner_record_id,status,is_demo) VALUES
 ('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','active',false);
INSERT INTO tickets(id,property_id,title,description,status,is_demo) VALUES
 ('66666666-6666-4666-8666-666666666666','33333333-3333-4333-8333-333333333333','PRIVATE title','PRIVATE description','open',false);
INSERT INTO owner_program_properties(program_id,property_id,inclusion_status) VALUES
 ('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','included');
DO $$ BEGIN
 IF (SELECT count(*) FROM owner_reviews)<>1 OR (SELECT count(*) FROM owner_review_properties)<>1 THEN RAISE EXCEPTION 'enrollment failed to cover existing Ticket'; END IF;
 IF EXISTS(SELECT 1 FROM owner_reviews WHERE title LIKE '%PRIVATE%' OR recommendation LIKE '%PRIVATE%' OR NOT auto_ticket) THEN RAISE EXCEPTION 'unsafe automatic projection'; END IF;
 IF EXISTS(SELECT 1 FROM owner_notifications) THEN RAISE EXCEPTION 'automatic opportunity added notification fanout'; END IF;
END $$;
UPDATE owner_reviews SET status='answered',owner_response='Preserved decision';
UPDATE tickets SET status='resolved';
UPDATE tickets SET status='open';
DO $$ BEGIN
 IF (SELECT count(*) FROM owner_reviews)<>1 OR NOT EXISTS(SELECT 1 FROM owner_reviews WHERE status='answered' AND owner_response='Preserved decision') THEN RAISE EXCEPTION 'stage update replaced opportunity or decision'; END IF;
 IF (SELECT count(*) FROM owner_review_properties)<>1 THEN RAISE EXCEPTION 'duplicate property links'; END IF;
END $$;
INSERT INTO tickets(id,property_id,status,is_demo) VALUES(gen_random_uuid(),'33333333-3333-4333-8333-333333333333','closed',false);
INSERT INTO tickets(id,property_id,status,is_demo) VALUES(gen_random_uuid(),'33333333-3333-4333-8333-333333333333','open',true);
UPDATE owner_program_properties SET inclusion_status='removed';
INSERT INTO tickets(id,property_id,status,is_demo) VALUES(gen_random_uuid(),'33333333-3333-4333-8333-333333333333','open',false);
DO $$ BEGIN
 IF (SELECT count(*) FROM owner_reviews)<>2 THEN RAISE EXCEPTION 'closed coverage or demo/enrollment exclusion failed'; END IF;
 IF has_function_privilege('authenticated','public.sync_ticket_opportunities(uuid,uuid)','EXECUTE') THEN RAISE EXCEPTION 'sync exposed to owner calls'; END IF;
END $$;
UPDATE owner_program_properties SET inclusion_status='included';
CREATE FUNCTION fail_auto_opportunity_link() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced link failure'; END $$;
CREATE TRIGGER fail_auto_link BEFORE INSERT ON owner_review_properties FOR EACH ROW EXECUTE FUNCTION fail_auto_opportunity_link();
DO $$ DECLARE before_count integer; BEGIN
 SELECT count(*) INTO before_count FROM owner_reviews;
 BEGIN
   INSERT INTO tickets(id,property_id,status,is_demo) VALUES('88888888-8888-4888-8888-888888888888','33333333-3333-4333-8333-333333333333','open',false);
   RAISE EXCEPTION 'link failure was ignored';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'forced link failure' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM tickets WHERE id='88888888-8888-4888-8888-888888888888') OR (SELECT count(*) FROM owner_reviews)<>before_count THEN
   RAISE EXCEPTION 'partial Ticket/opportunity persisted after link failure';
 END IF;
END $$;
ROLLBACK;
