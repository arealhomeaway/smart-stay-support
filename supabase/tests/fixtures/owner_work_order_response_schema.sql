ALTER TABLE work_orders ADD approved_amount numeric, ADD approval_decided_at timestamptz, ADD approval_note text;
CREATE TABLE audit_log(actor_id uuid,action text,entity_type text,entity_id uuid,reason text,before_value jsonb,after_value jsonb);
