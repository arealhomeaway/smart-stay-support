-- Undo answer-read-home-team: removes the added policy and helper; ao_contrib_read is untouched.
DROP POLICY IF EXISTS ao_contrib_read_home_team ON public.ao_contributions;
DROP FUNCTION IF EXISTS private.ao_answer_home_reader(uuid, uuid);
INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'answer_read_home_team_undone', 'policy',
  'Homeowner answers: home team may read', 'Undo of answer-read-home-team.');
