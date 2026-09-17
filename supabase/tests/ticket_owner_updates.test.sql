BEGIN;
SELECT set_config('test.actor','88888888-8888-4888-8888-888888888888',true);
SELECT set_config('test.staff','true',true);
INSERT INTO property_owners(id) VALUES('11111111-1111-4111-8111-111111111111');
INSERT INTO properties(id,owner_record_id,is_demo) VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',false);
INSERT INTO owner_programs(id,property_id,owner_record_id,owner_user_id,status,is_demo) VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','88888888-8888-4888-8888-888888888888','active',false);
INSERT INTO owner_program_properties(program_id,property_id,inclusion_status) VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','included');
INSERT INTO tickets(id,property_id,is_demo,title,description) VALUES('66666666-6666-4666-8666-666666666666','33333333-3333-4333-8333-333333333333',false,'PRIVATE guest','PRIVATE code');
DO $$ DECLARE variant integer; expected text; BEGIN
 FOR variant IN 1..5 LOOP
  PERFORM set_config('test.staff',CASE WHEN variant=1 THEN 'false' ELSE 'true' END,true);
  expected:=CASE variant WHEN 1 THEN 'Only staff%' WHEN 2 THEN 'Review the update%' WHEN 3 THEN 'The Ticket changed%' WHEN 4 THEN 'Provide an issue%' ELSE 'The Ticket needs%' END;
  BEGIN
   PERFORM save_ticket_owner_update('66666666-6666-4666-8666-666666666666','99999999-9999-4999-8999-999999999999',CASE WHEN variant=3 THEN '2026-09-14T00:00:00Z'::timestamptz ELSE '2026-09-15T00:00:00Z'::timestamptz END,0,CASE WHEN variant=5 THEN NULL ELSE '11111111-1111-4111-8111-111111111111'::uuid END,CASE WHEN variant=4 THEN 'short' ELSE 'A water pipe was leaking.' END,'The pipe was repaired.','Leak testing passed.',variant<>2);
   RAISE EXCEPTION 'invalid owner update accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE expected THEN RAISE; END IF; END;
 END LOOP;
 IF EXISTS(SELECT 1 FROM ticket_owner_updates) THEN RAISE EXCEPTION 'failed update persisted'; END IF;
END $$;
SELECT save_ticket_owner_update('66666666-6666-4666-8666-666666666666','99999999-9999-4999-8999-999999999999','2026-09-15T00:00:00Z',0,'11111111-1111-4111-8111-111111111111','A water pipe was leaking.','The pipe was repaired.','Leak testing passed.',true);
DO $$ BEGIN
 BEGIN
  PERFORM save_ticket_owner_update('66666666-6666-4666-8666-666666666666','99999999-9999-4999-8999-999999999999','2026-09-15T00:00:00Z',0,'11111111-1111-4111-8111-111111111111','A water pipe was leaking.','The pipe was repaired.','Leak testing passed.',true);
  RAISE EXCEPTION 'stale revision accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Another owner update%' THEN RAISE; END IF; END;
 IF (SELECT count(*) FROM ticket_owner_updates)<>1 THEN RAISE EXCEPTION 'duplicate revision persisted'; END IF;
END $$;
SELECT save_ticket_owner_update('66666666-6666-4666-8666-666666666666','99999999-9999-4999-8999-999999999999','2026-09-15T00:00:00Z',1,'11111111-1111-4111-8111-111111111111','A water pipe was leaking.','The pipe was repaired and rechecked.','Follow-up testing passed.',true);
SELECT set_config('test.staff','false',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE payload jsonb; BEGIN
 SELECT to_jsonb(r) INTO payload FROM read_owner_ticket_updates('55555555-5555-4555-8555-555555555555',ARRAY['33333333-3333-4333-8333-333333333333'::uuid],false) r;
 IF payload IS NULL OR payload->>'revision'<>'2' OR payload->>'outcome'<>'Follow-up testing passed.' THEN RAISE EXCEPTION 'latest reviewed update unavailable'; END IF;
 IF payload::text LIKE '%PRIVATE%' THEN RAISE EXCEPTION 'raw Ticket copied'; END IF;
 IF EXISTS(SELECT 1 FROM ticket_owner_updates) THEN RAISE EXCEPTION 'owner directly read staff history'; END IF;
 IF has_table_privilege('authenticated','ticket_owner_updates','INSERT') OR has_table_privilege('authenticated','ticket_owner_updates','UPDATE') OR has_table_privilege('authenticated','ticket_owner_updates','DELETE') THEN RAISE EXCEPTION 'direct write bypass'; END IF;
 IF has_function_privilege('authenticated','save_ticket_owner_update(uuid,uuid,timestamptz,integer,uuid,text,text,text,boolean)','EXECUTE') THEN RAISE EXCEPTION 'owner can forge staff writer'; END IF;
END $$;
RESET ROLE;
DO $$ DECLARE variant integer; BEGIN
 IF (SELECT count(*) FROM ticket_owner_updates)<>2 OR NOT EXISTS(SELECT 1 FROM ticket_owner_updates WHERE revision=1 AND outcome='Leak testing passed.') THEN RAISE EXCEPTION 'prior context lost'; END IF;
 FOR variant IN 1..6 LOOP
  BEGIN
   CASE variant
    WHEN 1 THEN PERFORM set_config('test.actor','99999999-9999-4999-8999-999999999999',true);
    WHEN 2 THEN UPDATE owner_program_properties SET inclusion_status='excluded';
    WHEN 3 THEN UPDATE properties SET owner_record_id=NULL;
    WHEN 4 THEN UPDATE tickets SET is_demo=true;
    WHEN 5 THEN UPDATE property_owners SET active=false;
    WHEN 6 THEN UPDATE owner_programs SET archived_at=now();
   END CASE;
   IF EXISTS(SELECT 1 FROM read_owner_ticket_updates('55555555-5555-4555-8555-555555555555',ARRAY['33333333-3333-4333-8333-333333333333'::uuid],false)) THEN RAISE EXCEPTION 'unsafe update visibility %',variant; END IF;
   RAISE EXCEPTION 'restore variant';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'restore variant' THEN RAISE; END IF; END;
 END LOOP;
END $$;
ROLLBACK;
