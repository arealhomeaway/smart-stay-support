BEGIN;
SELECT set_config('test.actor','99999999-9999-4999-8999-999999999999',true);
SELECT set_config('test.staff','true',true);
INSERT INTO work_orders(id,title,scope,quote_amount,final_cost) VALUES('77777777-7777-4777-8777-777777777777','Repair','Initial scope',150,NULL);
GRANT SELECT,UPDATE ON work_orders TO authenticated;
GRANT INSERT ON work_order_events TO authenticated;
ALTER TABLE work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY isolated_staff_cost ON work_orders FOR ALL TO authenticated USING(is_internal_staff(auth.uid())) WITH CHECK(is_internal_staff(auth.uid()));
CREATE FUNCTION fail_cost_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced cost history failure'; END $$;
CREATE TRIGGER fail_cost_history BEFORE INSERT ON work_order_events FOR EACH ROW EXECUTE FUNCTION fail_cost_history();
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM save_work_order_costs('77777777-7777-4777-8777-777777777777','2026-09-15T00:00:00Z',150,175,140,'Initial scope','Recorded the invoice amount');
  RAISE EXCEPTION 'history failure ignored';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM<>'forced cost history failure' THEN RAISE; END IF; END;
 IF EXISTS(SELECT 1 FROM work_orders WHERE final_cost IS NOT NULL) THEN RAISE EXCEPTION 'cost saved without history'; END IF;
END $$;
RESET ROLE;
DROP TRIGGER fail_cost_history ON work_order_events;
SET LOCAL ROLE authenticated;
DO $$ DECLARE amount numeric; BEGIN
 FOREACH amount IN ARRAY ARRAY[-1,0.001,'NaN'::numeric,'Infinity'::numeric,10000000000] LOOP
  BEGIN
   PERFORM save_work_order_costs('77777777-7777-4777-8777-777777777777','2026-09-15T00:00:00Z',150,175,amount,'Initial scope','Recorded invoice amount');
   RAISE EXCEPTION 'invalid cost accepted';
  EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Enter valid non-negative costs%' THEN RAISE; END IF; END;
 END LOOP;
END $$;
SELECT save_work_order_costs('77777777-7777-4777-8777-777777777777','2026-09-15T00:00:00Z',150,175,140,'Initial scope','Recorded the invoice amount');
DO $$ BEGIN
 BEGIN
  PERFORM save_work_order_costs('77777777-7777-4777-8777-777777777777','2026-09-15T00:00:00Z',150,175,120,'Initial scope','Stale edit');
  RAISE EXCEPTION 'stale costs accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The Work Order changed%' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM work_orders WHERE final_cost=140 AND quote_amount=150 AND second_quote_amount=175) THEN RAISE EXCEPTION 'cost values incorrect'; END IF;
 IF NOT EXISTS(SELECT 1 FROM work_order_events WHERE detail->'previous'->>'quote_amount'='150' AND detail->'current'->>'final_cost'='140' AND detail->>'reason'='Recorded the invoice amount') THEN RAISE EXCEPTION 'prior cost evidence lost'; END IF;
END $$;
UPDATE work_orders SET approval_id='22222222-2222-4222-8222-222222222222',approval_status='approved';
SET LOCAL ROLE authenticated;
DO $$ DECLARE viewed timestamptz; BEGIN
 SELECT updated_at INTO viewed FROM work_orders;
 BEGIN
  PERFORM save_work_order_costs('77777777-7777-4777-8777-777777777777',viewed,200,175,140,'Initial scope','Change requested quote');
  RAISE EXCEPTION 'linked quote changed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'An approval is linked%' THEN RAISE; END IF; END;
 BEGIN
  PERFORM save_work_order_costs('77777777-7777-4777-8777-777777777777',viewed,150,175,140,'Different scope','Change approved work');
  RAISE EXCEPTION 'linked scope changed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'An approval is linked%' THEN RAISE; END IF; END;
 PERFORM save_work_order_costs('77777777-7777-4777-8777-777777777777',viewed,150,175,800,'Initial scope','Record actual overrun for staff review');
 IF NOT EXISTS(SELECT 1 FROM work_orders WHERE final_cost=800 AND quote_amount=150 AND approval_status='approved') THEN RAISE EXCEPTION 'actual costs changed the recorded approval'; END IF;
END $$;
RESET ROLE;
UPDATE work_orders SET approval_id=NULL,approval_status='not_required',supervisor_approval_id='33333333-3333-4333-8333-333333333333',supervisor_approval_status='pending';
SET LOCAL ROLE authenticated;
DO $$ DECLARE viewed timestamptz; BEGIN
 SELECT updated_at INTO viewed FROM work_orders;
 BEGIN
  PERFORM save_work_order_costs('77777777-7777-4777-8777-777777777777',viewed,200,175,800,'Initial scope','Change supervisor quote');
  RAISE EXCEPTION 'supervisor quote changed';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'An approval is linked%' THEN RAISE; END IF; END;
END $$;
RESET ROLE;
UPDATE work_orders SET supervisor_approval_id=NULL,supervisor_approval_status='not_required',authority_level='owner';
SET LOCAL ROLE authenticated;
DO $$ DECLARE viewed timestamptz; BEGIN
 SELECT updated_at INTO viewed FROM work_orders;
 PERFORM save_work_order_costs('77777777-7777-4777-8777-777777777777',viewed,200,175,800,'Initial scope','New unapproved quote');
 IF EXISTS(SELECT 1 FROM work_orders WHERE authority_level IS NOT NULL) THEN RAISE EXCEPTION 'stale authority label retained'; END IF;
END $$;
RESET ROLE;
SELECT set_config('test.staff','false',true);
SET LOCAL ROLE authenticated;
DO $$ BEGIN
 BEGIN
  PERFORM save_work_order_costs('77777777-7777-4777-8777-777777777777','2026-09-15T00:00:00Z',150,175,0,'Initial scope','Owner forged cost');
  RAISE EXCEPTION 'nonstaff cost edit accepted';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'Only staff may record%' THEN RAISE; END IF; END;
 IF has_function_privilege('anon','save_work_order_costs(uuid,timestamptz,numeric,numeric,numeric,text,text)','EXECUTE') THEN RAISE EXCEPTION 'anonymous cost access'; END IF;
END $$;
RESET ROLE;
ROLLBACK;
