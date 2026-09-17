BEGIN;
DO $$ DECLARE category text; BEGIN
 IF NOT EXISTS(SELECT 1 FROM owner_task_templates WHERE owner_action_type='document') THEN RAISE EXCEPTION 'legacy category was rewritten'; END IF;
 INSERT INTO owner_task_templates DEFAULT VALUES;
 IF NOT EXISTS(SELECT 1 FROM owner_task_templates WHERE owner_action_type='review_comment') THEN RAISE EXCEPTION 'new request default is not canonical'; END IF;
 FOREACH category IN ARRAY ARRAY['approve_only','review_comment','review_decide','provide_information','attend_respond','action_payment','information_only','research_recommend'] LOOP
  INSERT INTO owner_reviews(id,owner_action_type) VALUES(gen_random_uuid(),category);
  INSERT INTO owner_task_templates(owner_action_type) VALUES(category);
 END LOOP;
 BEGIN
  INSERT INTO owner_reviews(id,owner_action_type) VALUES(gen_random_uuid(),'invented');
  RAISE EXCEPTION 'invalid category accepted';
 EXCEPTION WHEN check_violation THEN NULL; END;
END $$;
ROLLBACK;
