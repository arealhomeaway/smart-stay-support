-- Isolated contract fixture only; no external delivery or real records.
CREATE SCHEMA auth;
CREATE SCHEMA private;
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.actor',true),'')::uuid $$;
CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.role',true)=$2 $$;
CREATE FUNCTION public.is_onboarding_director(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT current_setting('test.role',true)='onboarding_director' $$;
CREATE TABLE owner_programs(id uuid PRIMARY KEY,status text,report_version uuid,owner_user_id uuid,is_demo boolean DEFAULT false);
CREATE TABLE properties(id uuid PRIMARY KEY,name text,nickname text);
CREATE TABLE owner_program_properties(program_id uuid,property_id uuid,inclusion_status text,archived_at timestamptz,closing_date date);
CREATE TABLE owner_task_templates(id uuid PRIMARY KEY,phase text,active boolean);
CREATE TABLE owner_reviews(id uuid DEFAULT gen_random_uuid(),program_id uuid,template_id uuid,property_id uuid,status text);
CREATE TABLE test_actions(action text);
CREATE TABLE owner_notifications(id uuid DEFAULT gen_random_uuid(),program_id uuid,n int);
CREATE FUNCTION private.owner_lifecycle_program(uuid,uuid,boolean) RETURNS owner_programs LANGUAGE plpgsql AS $$
DECLARE p owner_programs;
BEGIN
 SELECT * INTO p FROM owner_programs WHERE id=$1 FOR UPDATE;
 IF p.id IS NULL OR p.report_version IS DISTINCT FROM $2 THEN RAISE EXCEPTION 'Stale version'; END IF;
 RETURN p;
END $$;
CREATE FUNCTION public.activate_owner_program(uuid,uuid,date) RETURNS uuid LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO test_actions VALUES('activate');
 UPDATE owner_programs SET status='active',report_version=gen_random_uuid() WHERE id=$1;
 RETURN $1;
END $$;
CREATE FUNCTION public.change_owner_program(_program_id uuid,_expected_version uuid,_action text,_phase text) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE t owner_task_templates; h uuid; added int:=0;
BEGIN
 INSERT INTO test_actions VALUES('seed_'||_phase);
 FOR t IN SELECT * FROM owner_task_templates WHERE active AND phase=_phase LOOP
  FOR h IN SELECT property_id FROM owner_program_properties WHERE program_id=_program_id AND inclusion_status='included' AND t.phase='onboarding'
   UNION ALL SELECT NULL::uuid WHERE t.phase='ongoing' LOOP
   IF NOT EXISTS(SELECT 1 FROM owner_reviews WHERE program_id=_program_id AND template_id=t.id AND property_id IS NOT DISTINCT FROM h) THEN
    INSERT INTO owner_reviews(program_id,template_id,property_id,status) VALUES(_program_id,t.id,h,'prepared'); added:=added+1;
   END IF;
  END LOOP;
 END LOOP;
 UPDATE owner_programs SET report_version=gen_random_uuid() WHERE id=_program_id;
 RETURN jsonb_build_object('added',added);
END $$;
CREATE FUNCTION public.owner_release_batch_begin() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO test_actions VALUES('batch_begin');
 PERFORM set_config('resolve.owner_release_batch','on',true);
END $$;
CREATE FUNCTION public.owner_release_summary(uuid,int,uuid[]) RETURNS uuid LANGUAGE plpgsql AS $$
DECLARE nid uuid;
BEGIN
 INSERT INTO test_actions VALUES('summary');
 PERFORM set_config('resolve.owner_release_batch','off',true);
 IF NOT (SELECT is_demo FROM owner_programs WHERE id=$1) THEN
  INSERT INTO owner_notifications(program_id,n) VALUES($1,$2) RETURNING id INTO nid;
 END IF;
 RETURN nid;
END $$;
CREATE FUNCTION test_review_alert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='awaiting_owner' AND current_setting('resolve.owner_release_batch',true) IS DISTINCT FROM 'on' THEN
  INSERT INTO owner_notifications(program_id,n) VALUES(NEW.program_id,1);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER test_individual_alert AFTER UPDATE ON owner_reviews FOR EACH ROW EXECUTE FUNCTION test_review_alert();