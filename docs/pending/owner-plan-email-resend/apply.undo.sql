-- Undo: an email still waiting goes back to failed. An email already sent cannot be called back.
UPDATE public.owner_notifications SET email_status = 'failed'
 WHERE id IN ('161270b0-8c30-4f32-8884-22a90275ad90'::uuid, '17890bf3-7335-4345-a746-8633013a2d74'::uuid) AND email_status = 'pending';
INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_label, reason)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'COO', 'owner_email_resend_undone', 'owner_notification', 'Plan ready emails (2)',
        'docs/pending/owner-plan-email-resend/apply.undo.sql applied: any still waiting set back to failed.');
