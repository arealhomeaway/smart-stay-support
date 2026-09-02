ALTER TABLE public.playbooks DROP CONSTRAINT IF EXISTS playbooks_status_check;
ALTER TABLE public.playbooks ADD CONSTRAINT playbooks_status_check
  CHECK (status = ANY (ARRAY['draft'::text, 'in_review'::text, 'approved'::text, 'active'::text, 'retired'::text]));