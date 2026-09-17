BEGIN;
INSERT INTO property_owners VALUES('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
INSERT INTO properties(id,owner_record_id) VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111'),('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222');
INSERT INTO owner_programs(id,property_id,owner_record_id,status,is_demo) VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','draft',false);
INSERT INTO owner_program_properties(program_id,property_id,inclusion_status) VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','included');
DO $$ BEGIN
 IF (SELECT owner_record_id FROM owner_programs WHERE id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa') IS NOT NULL THEN RAISE EXCEPTION 'legacy identity was guessed'; END IF;
 BEGIN
  INSERT INTO owner_program_properties(program_id,property_id,inclusion_status) VALUES('55555555-5555-4555-8555-555555555555','44444444-4444-4444-8444-444444444444','included');
  RAISE EXCEPTION 'cross-owner enrollment allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Enrollment requires%' THEN RAISE; END IF; END;
 BEGIN
  UPDATE owner_programs SET owner_record_id='22222222-2222-4222-8222-222222222222' WHERE id='55555555-5555-4555-8555-555555555555';
  RAISE EXCEPTION 'owner identity replaced';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'A program canonical%' THEN RAISE; END IF; END;
 BEGIN
  INSERT INTO owner_programs(id,property_id,status) VALUES(gen_random_uuid(),'33333333-3333-4333-8333-333333333333','draft');
  RAISE EXCEPTION 'unbound creation allowed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Link the canonical%' THEN RAISE; END IF; END;
 BEGIN
  INSERT INTO owner_programs(id,property_id,owner_record_id,status,is_demo) VALUES(gen_random_uuid(),'33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','draft',false);
  RAISE EXCEPTION 'duplicate active program allowed';
 EXCEPTION WHEN unique_violation THEN NULL; END;
END $$;
ROLLBACK;
