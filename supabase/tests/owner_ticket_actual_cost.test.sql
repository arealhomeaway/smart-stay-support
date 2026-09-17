BEGIN;
SELECT set_config('test.actor','88888888-8888-4888-8888-888888888888',true);
INSERT INTO property_owners(id) VALUES('11111111-1111-4111-8111-111111111111');
INSERT INTO properties(id,owner_record_id,is_demo) VALUES('33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111',false);
INSERT INTO owner_programs(id,property_id,owner_record_id,owner_user_id,status,is_demo) VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','11111111-1111-4111-8111-111111111111','88888888-8888-4888-8888-888888888888','active',false);
INSERT INTO owner_program_properties(program_id,property_id,inclusion_status) VALUES('55555555-5555-4555-8555-555555555555','33333333-3333-4333-8333-333333333333','included');
INSERT INTO tickets(id,property_id,is_demo,title) VALUES('66666666-6666-4666-8666-666666666666','33333333-3333-4333-8333-333333333333',false,'PRIVATE guest');
INSERT INTO approvals(id,entity_type,entity_id,property_id,approver_role,status,amount,is_demo,title,detail)
 VALUES('22222222-2222-4222-8222-222222222222','work_order','77777777-7777-4777-8777-777777777777','33333333-3333-4333-8333-333333333333','owner','pending',650,false,'PRIVATE title','PRIVATE approval');
INSERT INTO work_orders(id,ticket_id,property_id,title,scope,quote_amount,approval_id,approval_status,emergency_reason)
 VALUES('77777777-7777-4777-8777-777777777777','66666666-6666-4666-8666-666666666666','33333333-3333-4333-8333-333333333333','PRIVATE title','PRIVATE code',650,'22222222-2222-4222-8222-222222222222','pending','PRIVATE emergency');
UPDATE work_orders SET final_cost=625,invoice_reference='PRIVATE invoice';
-- Exercise the real definer boundary with an owner role lacking Work Order SELECT.
SET LOCAL ROLE authenticated;
DO $$ DECLARE payload jsonb; BEGIN
 SELECT to_jsonb(r) INTO payload FROM read_owner_ticket_financial_context('55555555-5555-4555-8555-555555555555',ARRAY['33333333-3333-4333-8333-333333333333'::uuid],false) r;
 IF payload IS NULL OR payload->>'receipt_status'<>'pending' OR (payload->>'quote_amount')::numeric<>650 OR (payload->>'final_cost')::numeric<>625 THEN RAISE EXCEPTION 'authority unavailable to owner'; END IF;
 IF payload::text LIKE '%PRIVATE%' THEN RAISE EXCEPTION 'private text exposed'; END IF;
 BEGIN PERFORM 1 FROM work_orders; RAISE EXCEPTION 'raw Work Order SELECT granted'; EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 IF EXISTS(SELECT 1 FROM read_owner_ticket_financial_context('55555555-5555-4555-8555-555555555555',ARRAY['33333333-3333-4333-8333-333333333333'::uuid],true)) THEN RAISE EXCEPTION 'owner forged preview'; END IF;
END $$;
RESET ROLE;
DO $$ DECLARE variant integer; BEGIN
 FOR variant IN 1..9 LOOP
  -- Each denied variant rolls back, retaining the valid baseline for the next check.
  BEGIN
   CASE variant
    WHEN 1 THEN PERFORM set_config('test.actor','99999999-9999-4999-8999-999999999999',true);
    WHEN 2 THEN UPDATE owner_program_properties SET inclusion_status='excluded';
    WHEN 3 THEN UPDATE properties SET owner_record_id=NULL;
    WHEN 4 THEN UPDATE property_owners SET active=false;
    WHEN 5 THEN UPDATE owner_programs SET archived_at=now();
    WHEN 6 THEN UPDATE work_orders SET is_demo=true;
    WHEN 7 THEN UPDATE tickets SET is_demo=true;
    WHEN 8 THEN UPDATE work_orders SET property_id=NULL;
    WHEN 9 THEN UPDATE owner_programs SET owner_user_id=NULL;
   END CASE;
   IF EXISTS(SELECT 1 FROM read_owner_ticket_financial_context('55555555-5555-4555-8555-555555555555',ARRAY['33333333-3333-4333-8333-333333333333'::uuid],false)) THEN RAISE EXCEPTION 'unauthorized authority variant %',variant; END IF;
   RAISE EXCEPTION 'restore variant';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'restore variant' THEN RAISE; END IF;
  END;
 END LOOP;
 UPDATE approvals SET approver_role='manager';
 IF EXISTS(SELECT 1 FROM read_owner_ticket_financial_context('55555555-5555-4555-8555-555555555555',ARRAY['33333333-3333-4333-8333-333333333333'::uuid],false) WHERE receipt_id IS NOT NULL) THEN RAISE EXCEPTION 'staff receipt exposed'; END IF;
 UPDATE owner_programs SET status='completed';
 IF NOT EXISTS(SELECT 1 FROM read_owner_ticket_financial_context('55555555-5555-4555-8555-555555555555',ARRAY['33333333-3333-4333-8333-333333333333'::uuid],false)) THEN RAISE EXCEPTION 'completed history lost'; END IF;
 IF has_function_privilege('anon','public.read_owner_ticket_financial_context(uuid,uuid[],boolean)','EXECUTE') THEN RAISE EXCEPTION 'anonymous access granted'; END IF;
END $$;
CREATE OR REPLACE FUNCTION public.has_role(_actor uuid,_role text) RETURNS boolean LANGUAGE sql AS $$
 SELECT _actor='99999999-9999-4999-8999-999999999999'::uuid AND _role='admin'
$$;
SELECT set_config('test.actor','99999999-9999-4999-8999-999999999999',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM read_owner_ticket_financial_context('55555555-5555-4555-8555-555555555555',ARRAY['33333333-3333-4333-8333-333333333333'::uuid],true)) THEN RAISE EXCEPTION 'authorized admin preview denied'; END IF;
 IF EXISTS(SELECT 1 FROM read_owner_ticket_financial_context('55555555-5555-4555-8555-555555555555',ARRAY['33333333-3333-4333-8333-333333333333'::uuid],false)) THEN RAISE EXCEPTION 'admin normal mode bypasses ownership'; END IF;
 IF EXISTS(SELECT 1 FROM read_owner_ticket_financial_context('55555555-5555-4555-8555-555555555555',ARRAY['44444444-4444-4444-8444-444444444444'::uuid],true)) THEN RAISE EXCEPTION 'preview bypasses enrollment'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
