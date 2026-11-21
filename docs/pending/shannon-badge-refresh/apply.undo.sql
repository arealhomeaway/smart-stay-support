-- Undo shannon-badge-refresh: puts the three badge rows back exactly as they were before the refresh
-- (needs_review = false, same rule text, note and supporting facts), from the copy kept in the apply audit line.
-- The three badge_flagged history lines stay, because badge history cannot be changed; the audit line below records the undo.
-- Note: the next time her page opens, the existing refresh would flag them again while her hours stay below the rule.
UPDATE public.owner_badges b SET needs_review = false, review_note = s.review_note, trigger_rule = s.trigger_rule, supporting = s.supporting
FROM jsonb_to_recordset((SELECT before_value FROM public.audit_log WHERE action = 'shannon_badge_refresh.apply'
                         ORDER BY created_at DESC LIMIT 1)) AS s(code text, trigger_rule text, review_note text, supporting jsonb)
WHERE b.program_id = '579cb6ae-c5a5-4aa3-aac2-64eedd2faafe' AND b.code = s.code;
INSERT INTO public.audit_log(actor_id, actor_label, action, entity_type, entity_id, entity_label, reason)
VALUES ('98bd6696-4018-4965-b645-0471c5ae3925', 'Admin', 'shannon_badge_refresh.undo', 'owner_program', '579cb6ae-c5a5-4aa3-aac2-64eedd2faafe',
  'Matt & Shannon Linder badges', 'Undo of shannon-badge-refresh: the three badges are shown as earned again.');
