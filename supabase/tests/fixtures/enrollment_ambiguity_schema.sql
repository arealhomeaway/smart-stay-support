-- Isolated checkpoint fixture. Canonical collaborators below are test doubles,
-- not a replacement for live enrollment or real email-delivery verification.
CREATE SCHEMA auth;
CREATE SCHEMA private;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '00000000-0000-4000-8000-000000000001'::uuid $$;
CREATE FUNCTION public.has_role(uuid,text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
CREATE FUNCTION public.is_onboarding_director(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
CREATE FUNCTION private.is_synthetic_account() RETURNS boolean LANGUAGE sql AS $$ SELECT false $$;
CREATE TABLE auth.users(id uuid PRIMARY KEY,deleted_at timestamptz,banned_until timestamptz);
CREATE TABLE profiles(id uuid PRIMARY KEY,email text);
CREATE TABLE user_roles(user_id uuid,role text,UNIQUE(user_id,role));
CREATE TABLE properties(id uuid PRIMARY KEY,owner_record_id uuid,archived_at timestamptz,is_demo boolean DEFAULT false,actual_closing_on date,planned_closing_on date);
CREATE TABLE property_owners(id uuid PRIMARY KEY,name text,email text,active boolean DEFAULT true);
CREATE TABLE owner_programs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_record_id uuid,owner_user_id uuid,is_demo boolean DEFAULT false,archived_at timestamptz,status text DEFAULT 'draft',report_version uuid DEFAULT gen_random_uuid(),dfy_confirmed boolean DEFAULT false);
CREATE TABLE owner_program_properties(program_id uuid,property_id uuid,closing_date date,closing_confirmed boolean,UNIQUE(program_id,property_id));
CREATE TABLE active_owner_enrollment_runs(id uuid PRIMARY KEY,actor_id uuid,property_id uuid,input jsonb,account_id uuid,program_id uuid,checkpoints jsonb DEFAULT '{}',updated_at timestamptz DEFAULT now());
CREATE TABLE owner_task_templates(id uuid PRIMARY KEY,phase text);
CREATE TABLE owner_reviews(id uuid DEFAULT gen_random_uuid(),program_id uuid,template_id uuid,property_id uuid,status text,phase text);
CREATE TABLE owner_program_events(program_id uuid,kind text,summary text,actor_id uuid,detail jsonb);
CREATE TABLE audit_log(actor_id uuid,action text,entity_type text,entity_id uuid,after_value jsonb,before_value jsonb);
CREATE TABLE app_settings(key text,value jsonb);
CREATE TABLE test_summaries(program_id uuid UNIQUE,n integer);
CREATE TABLE test_welcomes(program_id uuid,owner_user_id uuid,UNIQUE(program_id,owner_user_id));
CREATE FUNCTION public.create_owner_program(home_id uuid) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE owner_id uuid; pid uuid;
BEGIN
 SELECT owner_record_id INTO owner_id FROM properties WHERE id=home_id;
 SELECT id INTO pid FROM owner_programs WHERE owner_record_id=owner_id;
 IF pid IS NULL THEN INSERT INTO owner_programs(owner_record_id) VALUES(owner_id) RETURNING id INTO pid; END IF;
 INSERT INTO owner_program_properties VALUES(pid,home_id,NULL,false) ON CONFLICT DO NOTHING;
 RETURN jsonb_build_object('programId',pid);
END $$;
CREATE FUNCTION public.staff_link_owner_account(pid uuid,account uuid) RETURNS void LANGUAGE sql AS $$ UPDATE owner_programs SET owner_user_id=account WHERE id=pid $$;
CREATE FUNCTION public.activate_owner_program(pid uuid,version uuid,started date) RETURNS uuid LANGUAGE plpgsql AS $$ BEGIN UPDATE owner_programs SET status='active' WHERE id=pid; RETURN pid; END $$;
CREATE FUNCTION public.change_owner_program(pid uuid,version uuid,action text,_settings jsonb DEFAULT NULL,_phase text DEFAULT NULL) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE added int;
BEGIN
 IF action='seed_roadmap' THEN
 INSERT INTO owner_reviews(program_id,template_id,property_id,status,phase)
 SELECT pid,t.id,CASE WHEN _phase='onboarding' THEN e.property_id END,'prepared',_phase
 FROM owner_task_templates t JOIN owner_program_properties e ON e.program_id=pid
 WHERE t.phase=_phase AND NOT EXISTS(SELECT 1 FROM owner_reviews r WHERE r.program_id=pid AND r.template_id=t.id AND r.property_id IS NOT DISTINCT FROM CASE WHEN _phase='onboarding' THEN e.property_id END);
 GET DIAGNOSTICS added=ROW_COUNT;
 END IF;
 RETURN jsonb_build_object('added',coalesce(added,0));
END $$;
CREATE FUNCTION public.owner_release_batch_begin() RETURNS void LANGUAGE sql AS $$ SELECT set_config('resolve.owner_release_batch','on',true) $$;
CREATE FUNCTION public.owner_release_summary(pid uuid,n integer,homes uuid[]) RETURNS void LANGUAGE sql AS $$ INSERT INTO test_summaries VALUES(pid,n) ON CONFLICT DO NOTHING $$;
CREATE FUNCTION public.enroll_active_owner(home_id uuid,account uuid) RETURNS void LANGUAGE sql AS $$ INSERT INTO test_welcomes SELECT program_id,account FROM owner_program_properties WHERE property_id=home_id ON CONFLICT DO NOTHING $$;