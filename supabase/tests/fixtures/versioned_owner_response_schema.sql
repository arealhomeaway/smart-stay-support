ALTER TABLE approvals ADD updated_at timestamptz NOT NULL DEFAULT now();
