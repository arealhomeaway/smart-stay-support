-- Isolated relations and auth identity adapter only. Access gates are loaded
-- byte-for-byte from pass2-live-reference.json, never stubbed here.
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
CREATE TABLE public.property_owners(id uuid PRIMARY KEY,active boolean);
CREATE TABLE public.owner_programs(id uuid PRIMARY KEY,owner_user_id uuid,property_id uuid,owner_record_id uuid,is_demo boolean,archived_at timestamptz);
CREATE TABLE public.properties(id uuid PRIMARY KEY,owner_record_id uuid,is_demo boolean,archived_at timestamptz);
CREATE TABLE public.owner_program_properties(program_id uuid,property_id uuid,inclusion_status text,archived_at timestamptz,is_demo boolean);
CREATE TABLE public.audit_log(entity_type text,entity_id uuid,action text,after_value jsonb,actor_id uuid,created_at timestamptz);
CREATE TABLE public.work_items(id uuid PRIMARY KEY,program_id uuid,kind text,status text,retired_at timestamptz);
CREATE TABLE public.owner_reviews(id uuid PRIMARY KEY,program_id uuid,archived_at timestamptz,status text);
CREATE TABLE public.owner_request_messages(id uuid PRIMARY KEY,review_id uuid,work_item_id uuid);
CREATE TABLE public.work_item_resources(id uuid PRIMARY KEY,work_item_id uuid,removed_at timestamptz);
CREATE TABLE public.approvals(id uuid,approver_role text,is_demo boolean,approver_id uuid,property_id uuid);
GRANT SELECT ON public.work_items,public.work_item_resources,public.owner_request_messages TO authenticated;
ALTER TABLE public.work_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_item_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owner_request_messages ENABLE ROW LEVEL SECURITY;