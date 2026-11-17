-- answer-read-home-team (Approved by the Admin, Nov 17): Project Managers, Utilities and anyone
-- assigned a Task on a home may read that home's saved homeowner answers (text and file list).
-- Read only. Adds one helper and one SELECT policy; the existing ao_contrib_read policy is unchanged.
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
GRANT SELECT ON public.ao_contributions TO authenticated;
GRANT ALL ON public.ao_contributions TO service_role;
CREATE POLICY ao_contrib_read_home_team ON public.ao_contributions
  FOR SELECT TO authenticated
  USING (private.ao_answer_home_reader(auth.uid(), property_id));
INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'answer_read_home_team_applied', 'policy',
  'Homeowner answers: home team may read',
  'Approved by the Admin, Nov 17: Project Managers, Utilities and Task assignees on a home may read that home''s saved homeowner answers (read only). Undo: docs/pending/answer-read-home-team/apply.undo.sql.');