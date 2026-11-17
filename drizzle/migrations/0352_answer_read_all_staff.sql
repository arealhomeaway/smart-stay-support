-- answer-read-all-staff (Approved by the Admin, Nov 17): every staff member may read every
-- homeowner's saved plan card answers (text and file list) on every home. Read only.
-- Replaces the home-team rule from 0351 (policy ao_contrib_read_home_team and its helper
-- private.ao_answer_home_reader) with one staff read rule on private.is_staff.
-- The existing ao_contrib_read policy (Admin, Directors, the home's own homeowners) is unchanged.
-- No INSERT, UPDATE or DELETE policy is added.
DROP POLICY IF EXISTS ao_contrib_read_home_team ON public.ao_contributions;
DROP FUNCTION IF EXISTS private.ao_answer_home_reader(uuid, uuid);
GRANT SELECT ON public.ao_contributions TO authenticated;
GRANT ALL ON public.ao_contributions TO service_role;
CREATE POLICY ao_contrib_read_staff ON public.ao_contributions
  FOR SELECT TO authenticated
  USING (private.is_staff(auth.uid()));
INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'answer_read_all_staff_applied', 'policy',
  'Homeowner answers: all staff may read',
  'Approved by the Admin, Nov 17: every staff member may read every homeowner''s saved answers and their files on every home (read only). Replaces the home-team rule from answer-read-home-team. Undo: docs/pending/answer-read-all-staff/apply.undo.sql.');
