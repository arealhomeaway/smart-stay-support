ALTER TABLE work_orders ADD COLUMN phase text DEFAULT 'permanent',
 ADD COLUMN contractual_exception boolean DEFAULT false, ADD COLUMN emergency_reason text;
