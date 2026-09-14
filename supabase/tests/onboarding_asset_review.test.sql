BEGIN;
SELECT set_config('test.actor','11111111-1111-4111-8111-111111111111',true);
SELECT set_config('test.staff','true',true);
INSERT INTO properties(id) VALUES('22222222-2222-4222-8222-222222222222'),('55555555-5555-4555-8555-555555555555');
INSERT INTO property_assets(id,property_id,name,kind,model,is_demo) VALUES('33333333-3333-4333-8333-333333333333','22222222-2222-4222-8222-222222222222','QA refrigerator','appliance','old-model',true);
INSERT INTO property_fact_proposals(id,property_id,asset_id,field_key,field_label,current_value,proposed_value)
 VALUES('44444444-4444-4444-8444-444444444444','22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333','model','Refrigerator model','old-model','verified-model');
UPDATE property_assets SET model='newer-model';
DO $$ BEGIN
 BEGIN
  PERFORM review_onboarding_fact('44444444-4444-4444-8444-444444444444',true,'Checked model plate');
  RAISE EXCEPTION 'stale asset overwrite';
 EXCEPTION WHEN raise_exception THEN IF SQLERRM NOT LIKE 'The asset changed%' THEN RAISE; END IF; END;
 IF (SELECT status FROM property_fact_proposals) <> 'pending' THEN RAISE EXCEPTION 'failed review persisted'; END IF;
END $$;
UPDATE property_assets SET model='old-model';
ALTER TABLE property_fact_proposals ADD CONSTRAINT simulate_asset_review_failure CHECK(status <> 'accepted');
DO $$ BEGIN
 BEGIN
  PERFORM review_onboarding_fact('44444444-4444-4444-8444-444444444444',true,'Checked model plate');
  RAISE EXCEPTION 'review failure ignored';
 EXCEPTION WHEN check_violation THEN NULL; END;
 IF (SELECT model FROM property_assets) <> 'old-model' THEN RAISE EXCEPTION 'asset change survived failed review'; END IF;
END $$;
ALTER TABLE property_fact_proposals DROP CONSTRAINT simulate_asset_review_failure;
SELECT review_onboarding_fact('44444444-4444-4444-8444-444444444444',true,'Checked model plate');
DO $$ BEGIN
 IF (SELECT model FROM property_assets) <> 'verified-model' THEN RAISE EXCEPTION 'canonical asset not updated'; END IF;
 IF (SELECT current_value FROM property_fact_proposals) <> 'old-model' OR (SELECT reviewed_by FROM property_fact_proposals) IS NULL THEN RAISE EXCEPTION 'prior value or reviewer lost'; END IF;
 BEGIN
  UPDATE property_fact_proposals SET property_id='55555555-5555-4555-8555-555555555555';
  RAISE EXCEPTION 'cross-property asset link accepted';
 EXCEPTION WHEN foreign_key_violation THEN NULL; END;
END $$;
ROLLBACK;
