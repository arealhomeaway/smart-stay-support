ALTER TABLE work_orders ADD COLUMN second_quote_amount numeric(12,2), ADD COLUMN quote_received_at timestamptz,
 ADD COLUMN supervisor_approval_id uuid, ADD COLUMN supervisor_approval_status text DEFAULT 'not_required';
ALTER TABLE work_orders ADD COLUMN authority_level text;
