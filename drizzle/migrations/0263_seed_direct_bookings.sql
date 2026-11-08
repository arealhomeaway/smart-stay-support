-- Direct Bookings: starting settings and the two editable reply templates.
-- Data only. Staged, not applied. Apply after 01. Undo: 02_undo_seed_direct_bookings.sql
-- Rates: 3 bedroom 189, 4 bedroom 199. 2 and 5 bedroom are not set on purpose.

INSERT INTO public.app_settings(key, value, updated_at)
VALUES ('direct_booking_settings', jsonb_build_object(
  'approvalStart', '2026-11-09',
  'approvalEnd', '2026-11-23',
  'requireApprovalAfterEnd', false,
  'approvalWaitMinutes', 2,
  'replyTargetMinutes', 3,
  'nightlyRates', jsonb_build_object('3', 189, '4', 199),
  'discountSources', jsonb_build_array('MyMetis', 'Owl Marketplace', 'Travelers Haven'),
  'discountPercent', 5,
  'ccRoles', jsonb_build_array('ops_supervisor', 'director_ops')
), now())
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.email_templates(name, audience, contexts, subject, body, active)
SELECT 'Direct booking reply', 'guest', ARRAY['direct_booking'],
  'Homes for {{dates}}',
  E'Hello {{contact_name}},\n\nThank you for thinking of A Real Home Away. Here are the homes we can offer for {{dates}}:\n\n{{homes}}\n\n{{fees}}\n\nPlease let us know which home works best, and we will hold it for you.\n\nKind regards,\n{{sender_name}}\nA Real Home Away',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE name = 'Direct booking reply');

INSERT INTO public.email_templates(name, audience, contexts, subject, body, active)
SELECT 'Direct booking follow-up', 'guest', ARRAY['direct_booking'],
  'Following up: homes for {{dates}}',
  E'Hello {{contact_name}},\n\nI wanted to follow up on the homes we shared for {{dates}}. They are still available today. Would you like us to hold one for your family?\n\nKind regards,\n{{sender_name}}\nA Real Home Away',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.email_templates WHERE name = 'Direct booking follow-up');
