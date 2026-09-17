-- Local fixture additions only.
ALTER TABLE onboarding_tasks ADD title text, ADD detail text, ADD due_on date,
 ADD is_demo boolean DEFAULT true, ADD requires_owner_approval boolean DEFAULT true,
 ADD owner_approval_status text;
ALTER TABLE approvals ADD due_on date;
