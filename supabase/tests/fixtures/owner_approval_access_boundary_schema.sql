-- Reproduce the exact legacy approval grants/policies before migration49 removes them.
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
 ADD COLUMN IF NOT EXISTS due_on date,ADD COLUMN IF NOT EXISTS evidence_url text,
 ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE approvals ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE ON approvals TO authenticated;
GRANT ALL ON approvals,work_orders,work_order_events,audit_log TO service_role;
GRANT SELECT,INSERT,UPDATE ON work_orders TO authenticated;
GRANT INSERT ON work_order_events TO authenticated;
CREATE POLICY approvals_read_staff ON approvals FOR SELECT TO authenticated USING(public.is_staff(auth.uid()));
CREATE POLICY approvals_insert_staff ON approvals FOR INSERT TO authenticated WITH CHECK(public.is_staff(auth.uid()) AND requested_by=auth.uid());
CREATE POLICY approvals_update_decider ON approvals FOR UPDATE TO authenticated
 USING(public.is_supervisor(auth.uid()) OR approver_id=auth.uid()) WITH CHECK(public.is_supervisor(auth.uid()) OR approver_id=auth.uid());
CREATE POLICY "Owners read their own approvals" ON approvals FOR SELECT TO authenticated
 USING(property_id IS NOT NULL AND EXISTS(SELECT 1 FROM owner_programs p WHERE p.owner_user_id=auth.uid() AND p.property_id=approvals.property_id));
CREATE POLICY "Owners decide their own pending approvals" ON approvals FOR UPDATE TO authenticated
 USING(status='pending' AND approver_id=auth.uid() AND property_id IS NOT NULL)
 WITH CHECK(approver_id=auth.uid() AND property_id IS NOT NULL);
CREATE POLICY "Staff withdraw pending onboarding approvals" ON approvals FOR UPDATE TO authenticated
 USING(public.is_staff(auth.uid()) AND status='pending' AND entity_type='onboarding_task')
 WITH CHECK(public.is_staff(auth.uid()) AND entity_type='onboarding_task' AND status IN('pending','withdrawn'));
CREATE FUNCTION approval_boundary_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at=clock_timestamp(); RETURN NEW; END $$;
CREATE TRIGGER approvals_updated BEFORE UPDATE ON approvals FOR EACH ROW EXECUTE FUNCTION approval_boundary_updated_at();
