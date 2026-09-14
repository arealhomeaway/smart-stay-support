-- Extend the isolated fixture only.
ALTER TABLE approvals ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE approvals ADD amount numeric, ADD approver_role text, ADD kind text,
 ADD title text, ADD detail text, ADD requested_by uuid, ADD is_demo boolean;
ALTER TABLE financial_requests ADD authority_tier text, ADD kind text,
 ADD vendor text, ADD description text;
