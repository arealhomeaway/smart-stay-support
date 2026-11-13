-- One-time resend: the two failed plan ready emails go back to waiting; the five-minute job sends each once.
-- NOT applied. Apply only after "Approved: apply owner-plan-email-resend", in one transaction:
-- BEGIN; \i 00_preflight.sql \i apply.sql COMMIT;
DO $$
DECLARE n int;
BEGIN
  UPDATE public.owner_notifications SET email_status = 'pending'
   WHERE id IN ('161270b0-8c30-4f32-8884-22a90275ad90'::uuid, '17890bf3-7335-4345-a746-8633013a2d74'::uuid) AND kind = 'ao_plan_ready' AND email_status = 'failed' AND NOT is_demo;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 2 THEN RAISE EXCEPTION 'Changed since the check: % of 2 emails were still failed. Nothing kept.', n; END IF;
  INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason, after_value)
  VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'COO', 'owner_email_resend_queued', 'owner_notification', 'Plan ready emails (2)',
          'docs/pending/owner-plan-email-resend/apply.sql applied: two plan ready emails that failed with mail provider errors 502 and 504 set to send once more. Undo: apply.undo.sql',
          jsonb_build_object('ids', jsonb_build_array('161270b0-8c30-4f32-8884-22a90275ad90', '17890bf3-7335-4345-a746-8633013a2d74')));
END $$;
