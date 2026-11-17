-- Undo answer-read-all-staff: removes the staff read rule and restores the 0351 home-team rule exactly.
-- ao_contrib_read is untouched.
DROP POLICY IF EXISTS ao_contrib_read_staff ON public.ao_contributions;
CREATE OR REPLACE FUNCTION private.ao_answer_home_reader(_u uuid, _property_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'private'
AS $function$
  SELECT _u IS NOT NULL AND _property_id IS NOT NULL AND private.is_staff(_u) AND (
    EXISTS (
      SELECT 1 FROM public.onboarding_projects p
       WHERE p.property_id = _property_id AND p.status <> 'cancelled'
         AND (p.project_manager = _u OR p.utility_manager = _u
              OR coalesce(p.role_assignments->>'utilities', '') = _u::text))
    OR EXISTS (
      SELECT 1 FROM public.onboarding_tasks t
       WHERE t.property_id = _property_id AND t.assigned_to = _u AND t.archived_at IS NULL)
  )
$function$;
REVOKE ALL ON FUNCTION private.ao_answer_home_reader(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION private.ao_answer_home_reader(uuid, uuid) TO authenticated, service_role;
CREATE POLICY ao_contrib_read_home_team ON public.ao_contributions
  FOR SELECT TO authenticated
  USING (private.ao_answer_home_reader(auth.uid(), property_id));
INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'answer_read_all_staff_undone', 'policy',
  'Homeowner answers: all staff may read', 'Undo of answer-read-all-staff; home-team rule restored.');
