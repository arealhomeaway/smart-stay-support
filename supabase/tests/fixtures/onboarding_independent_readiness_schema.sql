-- Minimal local representation of existing canonical financial and field tables.
ALTER TABLE financial_requests ADD COLUMN IF NOT EXISTS task_id uuid, ADD COLUMN IF NOT EXISTS emergency boolean DEFAULT false, ADD COLUMN IF NOT EXISTS emergency_reason text;
ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS closed_at timestamptz;
CREATE TABLE IF NOT EXISTS breezeway_outbound_tasks(id uuid PRIMARY KEY,property_id uuid,source_type text,onboarding_task_id uuid,ticket_id uuid,work_order_id uuid,breezeway_task_id bigint,status text,title text);
CREATE TABLE IF NOT EXISTS breezeway_work_orders(id uuid PRIMARY KEY,property_id uuid,breezeway_task_id bigint,linked_ticket_id uuid,name text,stage text,status text);
GRANT SELECT,INSERT,UPDATE,DELETE ON financial_requests,breezeway_outbound_tasks,breezeway_work_orders TO service_role;
ALTER TABLE onboarding_tasks ADD COLUMN IF NOT EXISTS linked_ticket_id uuid;
CREATE TABLE IF NOT EXISTS app_settings(key text PRIMARY KEY,value jsonb NOT NULL DEFAULT '{}');
ALTER TABLE financial_requests ADD COLUMN IF NOT EXISTS kind text DEFAULT 'other', ADD COLUMN IF NOT EXISTS vendor text, ADD COLUMN IF NOT EXISTS description text, ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE financial_requests ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS owner_email_to text, ADD COLUMN IF NOT EXISTS owner_email_sent_at timestamptz;
ALTER TABLE property_owners ADD COLUMN IF NOT EXISTS email text;
-- Existing internal financial/approval access, used to exercise the direct boundary.
GRANT SELECT,UPDATE ON financial_requests,approvals TO authenticated;
GRANT SELECT ON onboarding_project_events TO authenticated;
ALTER TABLE onboarding_tasks ADD COLUMN IF NOT EXISTS schedule_anchor text, ADD COLUMN IF NOT EXISTS schedule_offset_days integer;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS planned_closing_on date, ADD COLUMN IF NOT EXISTS actual_closing_on date, ADD COLUMN IF NOT EXISTS actual_access_on date;
CREATE TABLE IF NOT EXISTS approval_email_responses(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),approval_id uuid,status text NOT NULL DEFAULT 'matched',from_address text,web_link text,linked_by uuid,linked_at timestamptz,is_demo boolean NOT NULL DEFAULT false);
