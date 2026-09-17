CREATE FUNCTION public.is_internal_staff(uuid) RETURNS boolean LANGUAGE sql AS
 $$ SELECT coalesce(current_setting('test.staff',true),'false')='true' $$;
CREATE TABLE work_orders(id uuid PRIMARY KEY,ticket_id uuid,property_id uuid,title text,scope text,
 quote_amount numeric,policy_version text DEFAULT 'test policy',closed_at timestamptz,
 approval_id uuid,approval_status text DEFAULT 'not_required',approval_requested_at timestamptz,
 approval_requested_by uuid,is_demo boolean DEFAULT false,updated_at timestamptz DEFAULT '2026-09-15T00:00:00Z');
CREATE TABLE work_order_events(work_order_id uuid,author_id uuid,event_type text,body text,detail jsonb,is_demo boolean);
