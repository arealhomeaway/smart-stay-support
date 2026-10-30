-- Isolated relations for pass 3A. Every access function under test is loaded
-- byte-for-byte from pass3a-live-reference.json. The only stub is the staff
-- notification side effect, which is not an access gate.
CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE ROLE service_role;
CREATE SCHEMA auth;
CREATE SCHEMA private;
GRANT USAGE ON SCHEMA public, private, auth TO authenticated;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
 SELECT nullif(current_setting('request.test_uid',true),'')::uuid
$$;
CREATE TYPE public.app_role AS ENUM ('admin','manager','tech','vendor','owner','onboarding');
CREATE TABLE public.user_roles(user_id uuid,role public.app_role);
CREATE TABLE public.functional_roles(code text,current_seat_holder uuid);
CREATE TABLE auth.users(id uuid PRIMARY KEY,deleted_at timestamptz,banned_until timestamptz,email_confirmed_at timestamptz,email text);
CREATE TABLE public.profiles(id uuid PRIMARY KEY,full_name text);
CREATE TABLE public.property_owners(id uuid PRIMARY KEY,active boolean);
CREATE TABLE public.owner_programs(id uuid PRIMARY KEY,owner_user_id uuid,property_id uuid,owner_record_id uuid,is_demo boolean,archived_at timestamptz,
 status text,started_on date,completed_at timestamptz);
CREATE TABLE public.properties(id uuid PRIMARY KEY,owner_record_id uuid,is_demo boolean,archived_at timestamptz,name text);
CREATE TABLE public.owner_program_properties(program_id uuid,property_id uuid,inclusion_status text,archived_at timestamptz,is_demo boolean,
 closing_confirmed boolean,closing_date date);
CREATE TABLE public.audit_log(entity_type text,entity_id uuid,entity_label text,action text,before_value jsonb,after_value jsonb,actor_id uuid,created_at timestamptz DEFAULT now());
CREATE TABLE public.work_items(id uuid PRIMARY KEY,program_id uuid,property_id uuid,kind text,status text,retired_at timestamptz,viewed_at timestamptz,
 responded_at timestamptz,source text,source_task_id uuid,response_types text[],title text,owner_response jsonb DEFAULT '[]',is_demo boolean DEFAULT false,
 library_template_id uuid,assigned_to uuid);
CREATE TABLE public.onboarding_tasks(id uuid PRIMARY KEY,property_id uuid,archived_at timestamptz,requires_owner_approval boolean,owner_approval_status text);
CREATE TABLE public.approvals(id uuid PRIMARY KEY,entity_type text,entity_id uuid,property_id uuid,status text,created_at timestamptz DEFAULT now(),
 decision_note text,decided_at timestamptz,responded_at timestamptz,response_channel text);
CREATE TABLE public.owner_opportunity_library(id uuid PRIMARY KEY,active boolean);
CREATE TABLE public.owner_time_entries(id uuid PRIMARY KEY,program_id uuid,owner_user_id uuid,minutes int,activity text,is_demo boolean DEFAULT false,owner_update_snapshot jsonb);
CREATE TABLE public.owner_time_entry_properties(entry_id uuid,property_id uuid);
CREATE TABLE public.owner_notifications(id uuid PRIMARY KEY,program_id uuid,owner_user_id uuid,kind text,priority text,ticket_id uuid,review_id uuid,
 read_at timestamptz,created_at timestamptz DEFAULT now(),title text,body text,action_path text,email_status text);
CREATE TABLE public.owner_reviews(id uuid PRIMARY KEY,program_id uuid);
CREATE TABLE public.tickets(id uuid PRIMARY KEY,property_id uuid,is_demo boolean);
CREATE TABLE public.documents(id uuid PRIMARY KEY,uploaded_by uuid,deleted_at timestamptz,property_id uuid,owner_category text,work_item_id uuid);
CREATE TABLE public.str_participation_reports(id uuid PRIMARY KEY,program_id uuid,property_id uuid,status text,version int,period_start date,period_end date,
 generated_at timestamptz,released_at timestamptz,snapshot jsonb);
-- Side effect only (staff in-app alert). Not an access gate.
CREATE FUNCTION private.notify_opportunity_staff(_id uuid,_verb text) RETURNS void LANGUAGE sql AS $$ SELECT $$;
CREATE FUNCTION private.str_program_properties(_program_id uuid) RETURNS TABLE(property_id uuid) LANGUAGE sql AS $$
 SELECT property_id FROM public.owner_program_properties WHERE program_id=_program_id $$;
CREATE FUNCTION public.format_property_label(_p jsonb) RETURNS jsonb LANGUAGE sql AS $$ SELECT jsonb_build_object('primary',_p->>'name') $$;
